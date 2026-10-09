# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Muduck — a Markdown reader/editor for macOS and Windows aimed at AI-generated reports (callouts, Mermaid, KaTeX, code highlighting, live reload when an external tool rewrites the open file). React 18 + Vite + Tailwind frontend, **Tauri v2** (Rust) shell.

## Backend

The renderer talks to the Tauri v2 backend (`src-tauri/`) only through `src/renderer/utils/tauriBridge.ts` (`invoke` + `listen`). (An earlier Electron shell was removed on 2026-10-09.)

When adding a backend capability: add a `#[tauri::command]` in `src-tauri/src/lib.rs`, register it in `generate_handler![...]`, wrap it in `tauriBridge.ts`, and if it needs plugin permissions, update `src-tauri/capabilities/default.json`. Any JS window API (`startDragging`, `toggleMaximize`, `destroy`, …) also needs its explicit `core:window:allow-*` entry there; `core:default` only grants getters, and a missing one fails silently. Rust structs serialize with snake_case field names (`FileData.last_modified`), and the TS `FileData` in `tauriBridge.ts` mirrors that.

Keep the npm `@tauri-apps/*` packages on the same major.minor as their Rust crates (`@tauri-apps/api` ↔ `tauri`, `plugin-opener` ↔ `tauri-plugin-opener`, …). `tauri build` refuses to run on a mismatch, and a plain `npm install <plugin>@latest` drags `@tauri-apps/api` ahead; that's why they are pinned with `~` in package.json.

## Commands

No tests, no linter configured. Type-checking happens as part of the renderer build.

```bash
npm run dev                 # Vite dev server on :5173 (browser; isTauri=false, file I/O disabled)
npm run build:renderer      # tsc (noEmit, strict, noUnusedLocals) + vite build → dist/renderer
npx tsc --noEmit            # type-check only
npx @tauri-apps/cli dev     # Tauri dev window (loads devUrl http://localhost:5173)
npx @tauri-apps/cli build --bundles app   # macOS release → src-tauri/target/release/bundle/macos/Muduck.app
bash scripts/install-mac-app.sh   # copy that bundle to /Applications, lsregister for .md, install ~/.local/bin/muduck CLI
npm run build:quicklook && bash scripts/build-quicklook.sh   # Quick Look page / extension alone
cargo check --manifest-path src-tauri/Cargo.toml   # fast Rust check
```

Windows build (cross-compiled from macOS; needs `rustup target add x86_64-pc-windows-msvc`, `brew install nsis lld llvm`, `cargo install cargo-xwin`):

```bash
export PATH="$HOME/.cargo/bin:/opt/homebrew/opt/llvm/bin:$PATH"
cargo xwin check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc   # fast Windows check
npx @tauri-apps/cli build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
# → src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Muduck_<ver>_x64-setup.exe
```

The installer is per-user (no admin rights) and pulls in WebView2 if it is missing. Code that only exists on one OS must be `#[cfg]`-gated: `RunEvent::Opened` is macOS/iOS only, `tauri-plugin-single-instance` is Windows/Linux only. A plain `cargo check` on the Mac won't catch a break in the Windows-only code; run the `cargo xwin check` above.

Caveat on `tauri dev`: `beforeDevCommand` is `npm run build:renderer` (a one-shot build), not the Vite server, yet `devUrl` points to `:5173` — run `npm run dev` in another terminal first, or the window will be blank.

`scripts/muduck` is the CLI launcher (`muduck report.md`); it opens `/Applications/Muduck.app`, falling back to the bundle in `src-tauri/target`. `install-mac-app.sh` copies it to `~/.local/bin`.

## Architecture

**Rust side (`src-tauri/src/lib.rs`, single file):**
- `AppState` holds `pending_file` (path from macOS `RunEvent::Opened`, i.e. Finder double-click / Open With, kept until the frontend asks) and `watched_file` (one file at a time).
- File watching is a polling thread (`muduck-watcher`, every 400 ms). It compares a `(mtime, size)` signature and emits `file-changed` (with the full content) only after it sees the same new signature on two polls in a row, so a file that is still being written isn't emitted. Every read/save re-points the watcher. `save_file` holds the watcher lock across the write, so your own save is never echoed back.
- Paths go through `canonical()` (`dunce`, no `\\?\` prefix on Windows). The frontend compares the path in `file-changed` with its current `filePath` by string, so every path handed to the frontend must be canonical; `save_file` returns its canonical path for that reason.
- Startup file resolution in `get_initial_file`: pending Opened-event file first, then CLI args (also how Windows passes a double-clicked file). On Windows, a second launch is caught by the single-instance plugin and becomes an `open-file-data` event in the running window.
- Recent files: JSON at `dirs::data_local_dir()/muduck/recent_files.json`, capped at 30, entries for missing files dropped on load. Every `read_file_internal` call adds to recents.
- Events to the frontend: `open-file-data` (file opened while app is running) and `file-changed`. `open-file-data` does not move the watcher. The frontend may refuse the switch (unsaved edits) and calls `watch_file` only after it accepts.
- File commands are `async`, which keeps disk I/O off the main thread. The watcher thread reads files without holding the lock, then re-checks that the entry is unchanged before emitting.
- macOS: the stock Quit item is replaced by a custom `muduck-quit` item (`install_quit_menu`) that closes the window, so Cmd+Q goes through the frontend's unsaved-changes guard (`onCloseRequested`).

**Renderer (`src/renderer/`):**
- `App.tsx` owns all state (content, path, dirty flag, view mode `reader|split|editor`, zen mode, sidebar, search) and all keyboard shortcuts (Cmd on macOS / Ctrl elsewhere: O/S/P/F/T, +Shift+F zen, +/−/0 zoom). Child components must not handle these shortcuts again: a React `preventDefault` doesn't stop the window listener, so Cmd+S used to fire twice. Preferences (theme/font/width/zoom) persist in `localStorage` under `muduck-*` keys.
- Async callbacks (Tauri events, dialogs, the close guard) read current state through refs (`contentRef`, `filePathRef`, `isDirtyRef`), not through state captured in a closure. Every way of opening a file (dialog, drop, recent list, Finder or second launch, relative `.md` link) goes through `confirmDiscard()` + `loadDocument()`. `file-changed` is ignored if it is for a different path, and it never overwrites unsaved edits.
- Drag & drop: native Tauri `onDragDropEvent` in Tauri; HTML5 `FileReader` fallback only when not in Tauri.
- `utils/markdownParser.ts` → `renderMarkdown(md)` returns `{ html, toc }` in one pass.
  - It is a `Marked` instance with KaTeX block and inline extensions. Because they are tokenizer extensions, `$` inside code is never touched. The inline rule follows Pandoc, so "$5 and $10" stays text.
  - Callouts are detected in the `blockquote` renderer.
  - The TOC is collected in the `heading` renderer, so outline ids and page ids can't drift apart.
  - Output goes through DOMPurify (`SANITIZE_DOM: false`, so heading ids like `title` survive). The documents are untrusted AI output, and the webview can call file-writing commands.
- `components/MarkdownViewer.tsx` gets that HTML.
  - Copy, collapse and link clicks are handled by delegation on `data-action` / `<a>`. Inline `onclick` would be stripped by DOMPurify and blocked by the CSP in `tauri.conf.json` (`script-src 'self'`).
  - Links: `#` scrolls, http(s)/mailto open in the system browser (opener plugin), relative `.md` links open in the app, everything else is swallowed. The webview must never navigate away.
  - Mermaid is imported lazily (most of the bundle), runs with `securityLevel: 'strict'`, renders one diagram at a time, and caches SVGs by theme+font+code.
  - Rendering runs on `useDeferredValue(content)`, so typing in split view isn't blocked.
- `highlight.js/lib/common` (about 35 languages) is imported instead of the full build. Unlabeled blocks are auto-detected only among `AUTO_LANGS`.
- PDF export is just `window.print()`; `@media print` in `index.css` hides elements with `.no-print`.
- The title bar's 72px left padding for the traffic lights is macOS-only (`utils/platform.ts`). On Windows the native title bar stays.

**Finder Quick Look (space bar), macOS only:**
- `src-tauri/quicklook/` holds a Swift preview extension (`.appex`, sandboxed, ad-hoc signed). It shows `dist/quicklook/index.html` in a WKWebView and calls `window.muduckRender(text)`.
- `src/quicklook/main.ts` is that page. It reuses `renderMarkdown` and `utils/mermaidRender.ts` (shared with the viewer, so a rendering change applies to both). The theme follows the system appearance (paper/midnight).
- The page is built by `vite.quicklook.config.ts` as a classic IIFE plus `style.css`, not ES modules: WKWebView blocks module scripts from `file://`. Mermaid is loaded from `mermaid.min.js` with a `<script>` tag only when the document has diagrams.
- Build: `tauri build` runs `beforeBundleCommand` = `scripts/build-quicklook.sh` (it skips non-darwin targets). `bundle.macOS.files` copies the result into `Contents/PlugIns`. `signingIdentity: "-"` then signs the app ad-hoc around it; Tauri leaves the extension's own signature and entitlements alone.
- Only one Quick Look extension per content type wins. If another Markdown previewer is installed (e.g. QLMarkdown), it must be disabled: `pluginkit -e ignore -i <its id>`; `pluginkit -e use -i com.muduck.reader.quicklook`; `qlmanage -r`. Test with `qlmanage -p file.md`.
- Themes (`paper | light | midnight | nord | obsidian`) are CSS variables in `styles/themes.css`, applied as `theme-<name>` on `<body>`; components use `var(--bg-surface)`, `var(--text-main)` etc. rather than Tailwind colors.

`sample-report.md` and `test-second.md` are manual test documents (callouts, tables, Mermaid, KaTeX, Cyrillic headings).
