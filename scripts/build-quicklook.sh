#!/usr/bin/env bash
# Builds the Finder Quick Look extension into src-tauri/target/quicklook/MuduckQuickLook.appex.
# Runs as Tauri's beforeBundleCommand; tauri.conf.json (bundle.macOS.files) copies the result
# into Muduck.app/Contents/PlugIns.
set -euo pipefail

# Tauri runs this for every target; only macOS bundles carry the extension.
if [ -n "${TAURI_ENV_PLATFORM:-}" ] && [ "${TAURI_ENV_PLATFORM}" != "darwin" ]; then
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src-tauri/quicklook"
OUT="$ROOT/src-tauri/target/quicklook"
APPEX="$OUT/MuduckQuickLook.appex"
VERSION="$(node -p "require('$ROOT/src-tauri/tauri.conf.json').version")"
ARCH="$(uname -m)"

(cd "$ROOT" && npm run build:quicklook --silent)

rm -rf "$APPEX"
mkdir -p "$APPEX/Contents/MacOS" "$APPEX/Contents/Resources"

xcrun swiftc \
  -module-name MuduckQuickLook \
  -target "$ARCH-apple-macos11.0" \
  -sdk "$(xcrun --sdk macosx --show-sdk-path)" \
  -application-extension -parse-as-library -O \
  -framework Cocoa -framework QuickLookUI -framework WebKit \
  -Xlinker -e -Xlinker _NSExtensionMain \
  "$SRC/PreviewViewController.swift" \
  -o "$APPEX/Contents/MacOS/MuduckQuickLook"

sed "s/__VERSION__/$VERSION/g" "$SRC/Info.plist" > "$APPEX/Contents/Info.plist"
cp -R "$ROOT/dist/quicklook" "$APPEX/Contents/Resources/preview"

# Ad-hoc signature ("Sign to Run Locally"); the extension is sandboxed via its entitlements.
codesign --force --sign - --entitlements "$SRC/QuickLook.entitlements" "$APPEX"
echo "Quick Look extension: $APPEX"
