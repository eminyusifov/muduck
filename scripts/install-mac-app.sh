#!/usr/bin/env bash
set -e

SOURCE_APP="/Users/eminyusifov/Desktop/Programming/Muduck/src-tauri/target/release/bundle/macos/Muduck.app"

if [ ! -d "$SOURCE_APP" ]; then
  echo "Error: Tauri Muduck.app not found. Building first..."
  export PATH="$HOME/.cargo/bin:$PATH"
  npx @tauri-apps/cli build
fi

echo "Installing ultra-light Tauri Muduck to /Applications/Muduck.app..."
rm -rf "/Applications/Muduck.app"
cp -R "$SOURCE_APP" "/Applications/Muduck.app"

echo "Registering Muduck with macOS LaunchServices for Markdown files..."
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/Muduck.app

mkdir -p "$HOME/.local/bin"
cp scripts/muduck "$HOME/.local/bin/muduck"
chmod +x "$HOME/.local/bin/muduck"

echo "✅ Ultra-light Muduck (Tauri, 13MB) successfully installed to /Applications/Muduck.app!"
echo "✅ CLI command updated at $HOME/.local/bin/muduck"
