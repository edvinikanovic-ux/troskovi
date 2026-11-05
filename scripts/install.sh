#!/bin/bash
# Installs Troskovi from the latest GitHub release.
#
# Downloading with curl leaves no "downloaded from the internet" flag on the file, so macOS does not
# show the "damaged and can't be opened" warning that an unsigned app gets when it comes from a browser.
#
# Optional overrides (used for testing): TROSKOVI_DMG, INSTALL_DIR, TROSKOVI_NO_OPEN
set -euo pipefail

REPO="__REPO__"
APP_NAME="Troskovi"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Troskovi runs on macOS only." >&2
  exit 1
fi

case "$(uname -m)" in
  arm64) ARCH="arm64" ;;
  x86_64) ARCH="x64" ;;
  *) echo "Unsupported processor: $(uname -m)" >&2; exit 1 ;;
esac

# /Applications when the user may write there, otherwise ~/Applications
INSTALL_DIR="${INSTALL_DIR:-/Applications}"
if [ ! -w "$INSTALL_DIR" ]; then
  INSTALL_DIR="$HOME/Applications"
  mkdir -p "$INSTALL_DIR"
fi

TMP="$(mktemp -d)"
MOUNT="$TMP/mount"
cleanup() {
  hdiutil detach "$MOUNT" -quiet 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
  echo "$APP_NAME is running. Quit it (Cmd+Q) and run this again." >&2
  exit 1
fi

if [ -n "${TROSKOVI_DMG:-}" ]; then
  DMG="$TROSKOVI_DMG"
else
  URL="https://github.com/${REPO}/releases/latest/download/Troskovi-${ARCH}.dmg"
  echo "Downloading $APP_NAME ($ARCH)..."
  curl -fL --progress-bar "$URL" -o "$TMP/app.dmg"
  DMG="$TMP/app.dmg"
fi

mkdir -p "$MOUNT"
hdiutil attach "$DMG" -nobrowse -readonly -quiet -mountpoint "$MOUNT"
APP="$(find "$MOUNT" -maxdepth 1 -name '*.app' | head -n 1)"
if [ -z "$APP" ]; then
  echo "No app found in the download." >&2
  exit 1
fi

echo "Installing to $INSTALL_DIR..."
rm -rf "${INSTALL_DIR:?}/${APP_NAME}.app"
ditto "$APP" "$INSTALL_DIR/${APP_NAME}.app"
# belt and braces: make sure no quarantine flag is left
xattr -cr "$INSTALL_DIR/${APP_NAME}.app" 2>/dev/null || true

echo "Done: $INSTALL_DIR/${APP_NAME}.app"
if [ -z "${TROSKOVI_NO_OPEN:-}" ]; then
  open "$INSTALL_DIR/${APP_NAME}.app"
fi
