#!/usr/bin/env bash
# Builds (if needed) and installs Muduck into /Applications, registers it for Markdown files
# and installs the `muduck` command into ~/.local/bin.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_APP="$ROOT/src-tauri/target/release/bundle/macos/Muduck.app"

if [ ! -d "$SOURCE_APP" ]; then
  echo "Muduck.app not found. Building first..."
  export PATH="$HOME/.cargo/bin:$PATH"
  (cd "$ROOT" && npx @tauri-apps/cli build --bundles app)
fi

echo "Installing Muduck to /Applications/Muduck.app..."
rm -rf "/Applications/Muduck.app"
cp -R "$SOURCE_APP" "/Applications/Muduck.app"

echo "Registering Muduck with macOS LaunchServices for Markdown files..."
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/Muduck.app

mkdir -p "$HOME/.local/bin"
cp "$ROOT/scripts/muduck" "$HOME/.local/bin/muduck"
chmod +x "$HOME/.local/bin/muduck"

echo "✅ Muduck installed to /Applications/Muduck.app"
echo "✅ CLI command installed at $HOME/.local/bin/muduck"
