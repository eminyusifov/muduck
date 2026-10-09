# Muduck

A small, fast Markdown reader and editor for macOS and Windows, made for reading the reports AI tools write: tables, callouts, math, diagrams and code, with live reload while the file is being rewritten.

## Features

- **Reader, Split and Editor views**, an outline sidebar, zen mode and find in document
- **GitHub-style callouts** (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`)
- **Math** with KaTeX (`$…$`, `$$…$$`) and **Mermaid diagrams**
- **Syntax highlighting** for code blocks, with copy and collapse buttons
- **Live reload:** when another program rewrites the open file, Muduck shows the new version. If you have unsaved edits, they are kept.
- **Five themes** (Paper, Light, Midnight, Nord, Obsidian), three fonts, adjustable width and zoom
- **Quick Look on macOS:** select a `.md` file in Finder and press Space to see it rendered
- Documents are treated as untrusted: HTML is sanitized and scripts in a document never run

## Download

Get the latest version from [Releases](../../releases).

### macOS (Apple Silicon)

1. Download `Muduck_<version>_macOS_arm64.zip`, unzip it and move **Muduck.app** to **Applications**.
2. The app is not notarized by Apple, so the first launch is blocked. Right-click Muduck.app → **Open** → **Open**. If macOS still refuses, run:
   ```bash
   xattr -cr /Applications/Muduck.app
   ```
3. To use **Quick Look**, open Muduck once. Then check System Settings → General → Login Items & Extensions → Quick Look and make sure Muduck is enabled. Only one Markdown previewer can be active at a time, so turn off any other one there (for example QLMarkdown).

Intel Macs are not supported by the prebuilt app yet; build from source instead.

### Windows (x64)

1. Download `Muduck_<version>_x64-setup.exe` and run it. It installs for the current user (no admin rights needed) and associates `.md` files with Muduck.
2. The installer is not code-signed, so SmartScreen may warn about an unknown publisher: click **More info** → **Run anyway**.
3. Muduck needs Microsoft Edge WebView2, which Windows 10/11 already include. If it is missing, the installer downloads it.

The Windows version is new. Please [open an issue](../../issues) if something doesn't work.

## Keyboard shortcuts

`Cmd` on macOS, `Ctrl` on Windows.

| Shortcut | Action |
| --- | --- |
| `Cmd+O` / `Cmd+S` | Open / Save |
| `Cmd+F` | Find in document |
| `Cmd+T` | Toggle outline |
| `Cmd+P` | Print / export to PDF |
| `Cmd+Shift+F` | Zen mode (`Esc` to leave) |
| `Cmd+=` / `Cmd+-` / `Cmd+0` | Zoom in / out / reset |
| `Cmd+B` / `Cmd+I` / `Cmd+K` | Bold / italic / link (in the editor) |

## Build from source

Requirements: Node.js 20+, Rust (via [rustup](https://rustup.rs)), and on macOS Xcode (for the Quick Look extension).

```bash
npm install
npx @tauri-apps/cli dev                      # run in development (start `npm run dev` first)
npx @tauri-apps/cli build --bundles app      # macOS: src-tauri/target/release/bundle/macos/Muduck.app
bash scripts/install-mac-app.sh              # macOS: install to /Applications + `muduck` CLI
```

Windows installers can be cross-compiled from a Mac (`cargo-xwin` + NSIS) or built natively on Windows with `npx @tauri-apps/cli build`. See [CLAUDE.md](CLAUDE.md) for the details and the architecture notes.

## License

[MIT](LICENSE)
