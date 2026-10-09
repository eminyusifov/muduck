use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State, AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileData {
    pub path: String,
    pub name: String,
    pub content: String,
    pub last_modified: u64,
}

/// (mtime in ms, size in bytes). Size catches rewrites within one mtime tick
/// (1-second mtime on HFS+/exFAT/SMB).
type Signature = (u64, u64);

pub struct WatchedFile {
    path: PathBuf,
    sig: Signature,
    /// A changed signature seen once; the file is read only when it is seen again
    /// on the next poll, so half-written files are not emitted.
    pending: Option<Signature>,
}

#[derive(Clone)]
pub struct AppState {
    pub pending_file: Arc<Mutex<Option<String>>>,
    pub watched_file: Arc<Mutex<Option<WatchedFile>>>,
    /// Set once the frontend has asked for its initial file; after that, files are emitted.
    pub frontend_ready: Arc<AtomicBool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            pending_file: Arc::new(Mutex::new(None)),
            watched_file: Arc::new(Mutex::new(None)),
            frontend_ready: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Absolute path without the `\\?\` prefix `fs::canonicalize` adds on Windows.
fn canonical(p: &Path) -> String {
    dunce::canonicalize(p).unwrap_or_else(|_| p.to_path_buf()).to_string_lossy().to_string()
}

fn signature(p: &Path) -> Option<Signature> {
    let metadata = fs::metadata(p).ok()?;
    let mtime = metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Some((mtime, metadata.len()))
}

fn get_recent_file_path() -> PathBuf {
    let mut dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("muduck");
    let _ = fs::create_dir_all(&dir);
    dir.push("recent_files.json");
    dir
}

fn load_recent_files_internal() -> Vec<String> {
    let path = get_recent_file_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(files) = serde_json::from_str::<Vec<String>>(&content) {
            return files.into_iter().filter(|f| Path::new(f).exists()).collect();
        }
    }
    Vec::new()
}

fn save_recent_files_internal(files: &[String]) {
    let path = get_recent_file_path();
    let to_save: Vec<String> = files.iter().take(30).cloned().collect();
    if let Ok(json) = serde_json::to_string_pretty(&to_save) {
        let _ = fs::write(path, json);
    }
}

fn add_recent_file_internal(file_path: &str) {
    let mut files = load_recent_files_internal();
    files.retain(|f| f != file_path);
    files.insert(0, file_path.to_string());
    save_recent_files_internal(&files);
}

fn read_file_internal(path: &str) -> Result<FileData, String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let content = fs::read_to_string(p).map_err(|e| e.to_string())?;
    let last_modified = signature(p).map(|s| s.0).unwrap_or(0);

    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("Untitled.md").to_string();
    let abs_path = canonical(p);

    add_recent_file_internal(&abs_path);

    Ok(FileData {
        path: abs_path,
        name,
        content,
        last_modified,
    })
}

fn watch_file_internal(state: &AppState, path: &str) {
    let p = PathBuf::from(path);
    if let Some(sig) = signature(&p) {
        if let Ok(mut watched) = state.watched_file.lock() {
            *watched = Some(WatchedFile { path: p, sig, pending: None });
        }
    }
}

// File commands are async so disk I/O (and waiting on the watcher lock) stays off the main thread.
#[tauri::command]
async fn read_file(state: State<'_, AppState>, path: String) -> Result<FileData, String> {
    let data = read_file_internal(&path)?;
    watch_file_internal(&state, &data.path);
    Ok(data)
}

/// Writes the file and returns its canonical path.
#[tauri::command]
async fn save_file(state: State<'_, AppState>, path: String, content: String) -> Result<String, String> {
    let p = Path::new(&path);
    // Hold the watcher lock across the write so the watcher can't echo our own save back.
    let mut watched = state.watched_file.lock().map_err(|e| e.to_string())?;
    fs::write(p, &content).map_err(|e| e.to_string())?;
    let abs_path = canonical(p);
    if let Some(sig) = signature(p) {
        *watched = Some(WatchedFile { path: PathBuf::from(&abs_path), sig, pending: None });
    }
    drop(watched);

    add_recent_file_internal(&abs_path);
    Ok(abs_path)
}

#[tauri::command]
fn get_recent_files() -> Result<Vec<String>, String> {
    Ok(load_recent_files_internal())
}

#[tauri::command]
fn remove_recent_file(path: String) -> Result<Vec<String>, String> {
    let mut files = load_recent_files_internal();
    files.retain(|f| f != &path);
    save_recent_files_internal(&files);
    Ok(files)
}

#[tauri::command]
fn clear_recent_files() -> Result<(), String> {
    save_recent_files_internal(&[]);
    Ok(())
}

/// First non-flag argument that is an existing file, resolved against `cwd`.
fn file_from_args(args: &[String], cwd: &Path) -> Option<String> {
    args.iter().skip(1).filter(|a| !a.starts_with('-')).find_map(|arg| {
        let p = Path::new(arg);
        let full = if p.is_absolute() { p.to_path_buf() } else { cwd.join(p) };
        full.is_file().then(|| full.to_string_lossy().to_string())
    })
}

#[tauri::command]
async fn get_initial_file(state: State<'_, AppState>) -> Result<Option<FileData>, String> {
    // 1. Pending file from the macOS Opened event (Finder double click / Open With)
    let pending = state.pending_file.lock().ok().and_then(|mut p| {
        state.frontend_ready.store(true, Ordering::SeqCst);
        p.take()
    });

    // 2. CLI args (e.g. `muduck report.md`, or a Windows file-association launch)
    let from_args = || {
        let args: Vec<String> = std::env::args().collect();
        let cwd = std::env::current_dir().unwrap_or_default();
        file_from_args(&args, &cwd)
    };

    for path in pending.into_iter().chain(from_args()) {
        if let Ok(data) = read_file_internal(&path) {
            watch_file_internal(&state, &data.path);
            return Ok(Some(data));
        }
    }
    Ok(None)
}

#[tauri::command]
async fn open_file_dialog(app: AppHandle, state: State<'_, AppState>) -> Result<Option<FileData>, String> {
    let state_inner = state.inner().clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Markdown Documents", &["md", "markdown", "mdown", "mkd", "txt"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Some(path) = picked {
        let path_str = path.to_string();
        let data = read_file_internal(&path_str)?;
        watch_file_internal(&state_inner, &data.path);
        Ok(Some(data))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn save_file_dialog(
    app: AppHandle,
    state: State<'_, AppState>,
    default_name: String,
    content: String
) -> Result<Option<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_file_name(&default_name)
            .add_filter("Markdown Documents", &["md", "markdown", "mdown"])
            .blocking_save_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Some(path) = picked {
        Ok(Some(save_file(state, path.to_string(), content).await?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn watch_file(state: State<'_, AppState>, path: String) -> Result<(), String> {
    watch_file_internal(&state, &path);
    Ok(())
}

/// Offers a file to the already-running app (Finder on macOS, a second launch on Windows/Linux).
/// The watcher is not switched here: the frontend may still refuse (unsaved edits) and
/// calls `watch_file` once it has accepted.
fn open_in_running_app(app_handle: &AppHandle, path: &str) {
    if let Ok(file_data) = read_file_internal(path) {
        let _ = app_handle.emit("open-file-data", file_data);
    }
}

/// One poll of the watched file; emits `file-changed` once a change has settled.
/// The file is read without holding the lock, so `save_file` never waits on disk I/O.
fn poll_watched(app_handle: &AppHandle, watched: &Mutex<Option<WatchedFile>>) {
    let (path, base_sig, pending) = {
        let Ok(guard) = watched.lock() else { return };
        let Some(w) = guard.as_ref() else { return };
        (w.path.clone(), w.sig, w.pending)
    };
    let Some(cur) = signature(&path) else { return };

    // Applies `f` only if nobody (a save, a switch to another file) touched the entry meanwhile.
    let update = |f: &mut dyn FnMut(&mut WatchedFile)| -> bool {
        let Ok(mut guard) = watched.lock() else { return false };
        match guard.as_mut() {
            Some(w) if w.path == path && w.sig == base_sig && w.pending == pending => {
                f(w);
                true
            }
            _ => false,
        }
    };

    if cur == base_sig {
        if pending.is_some() {
            update(&mut |w| w.pending = None);
        }
        return;
    }
    if pending != Some(cur) {
        update(&mut |w| w.pending = Some(cur));
        return;
    }
    // Same new signature on two polls in a row: the writer is done.
    let Ok(content) = fs::read_to_string(&path) else { return };
    if signature(&path) != Some(cur) {
        return;
    }
    if update(&mut |w| {
        w.sig = cur;
        w.pending = None;
    }) {
        let _ = app_handle.emit("file-changed", serde_json::json!({
            "path": path.to_string_lossy(),
            "content": content,
        }));
    }
}

/// macOS: the stock Quit item (Cmd+Q) terminates without a close request, skipping the
/// frontend's unsaved-changes prompt. Replace it with one that closes the window instead.
#[cfg(target_os = "macos")]
fn install_quit_menu(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, MenuItemKind};

    let menu = Menu::default(app.handle())?;
    if let Some(MenuItemKind::Submenu(app_menu)) = menu.items()?.into_iter().next() {
        for item in app_menu.items()? {
            if let MenuItemKind::Predefined(p) = &item {
                if p.text()?.starts_with("Quit") {
                    app_menu.remove(p)?;
                    let quit = MenuItem::with_id(app, "muduck-quit", p.text()?, true, Some("CmdOrCtrl+Q"))?;
                    app_menu.append(&quit)?;
                }
            }
        }
    }
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id() == "muduck-quit" {
            match app.get_webview_window("main") {
                Some(window) => {
                    let _ = window.close();
                }
                None => app.exit(0),
            }
        }
    });
    Ok(())
}

pub fn run() {
    let app_state = AppState::new();
    let watcher_state = app_state.watched_file.clone();

    let builder = tauri::Builder::default();

    // Windows/Linux start a new process per opened file; hand it to the running window instead.
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        if let Some(path) = file_from_args(&args, Path::new(&cwd)) {
            open_in_running_app(app, &path);
        }
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            install_quit_menu(app)?;

            let app_handle = app.handle().clone();

            std::thread::Builder::new()
                .name("muduck-watcher".into())
                .spawn(move || loop {
                    std::thread::sleep(Duration::from_millis(400));
                    poll_watched(&app_handle, &watcher_state);
                })
                .expect("failed to spawn watcher thread");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            save_file,
            get_recent_files,
            remove_recent_file,
            clear_recent_files,
            get_initial_file,
            open_file_dialog,
            save_file_dialog,
            watch_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = _event {
                for url in urls {
                    if let Ok(file_path) = url.to_file_path() {
                        if let Some(path_str) = file_path.to_str() {
                            let Some(state) = _app_handle.try_state::<AppState>() else { continue };
                            // Hold the lock while checking readiness so get_initial_file can't slip in between.
                            if let Ok(mut pending) = state.pending_file.lock() {
                                if !state.frontend_ready.load(Ordering::SeqCst) {
                                    // Frontend not up yet: get_initial_file will pick it up.
                                    *pending = Some(path_str.to_string());
                                    continue;
                                }
                            }
                            open_in_running_app(_app_handle, path_str);
                        }
                    }
                }
            }
        });
}
