#!/bin/bash
# Builds Troskovi for Apple Silicon and Intel Macs and publishes the disk images, together with
# the installer script, as a release on PUBLIC github.com.
#
# Usage:  scripts/release.sh OWNER/REPO [tag]
# Needs:  the GitHub CLI logged in to github.com   (gh auth login --hostname github.com)
set -euo pipefail

REPO="${1:?Usage: scripts/release.sh OWNER/REPO [tag]}"
cd "$(dirname "$0")/.."
VERSION="$(node -p "require('./package.json').version")"
TAG="${2:-v$VERSION}"

# publish to github.com only, never to another GitHub host the CLI may be logged in to
export GH_HOST=github.com
gh auth status --hostname github.com >/dev/null 2>&1 || {
  echo "Log in to github.com first:  gh auth login --hostname github.com" >&2
  exit 1
}

npx electron-vite build
npx electron-builder --mac --arm64 --x64

sed "s#__REPO__#${REPO}#" scripts/install.sh > dist/install.sh
chmod +x dist/install.sh

gh release create "$TAG" \
  --repo "$REPO" \
  --title "Troskovi $TAG" \
  --notes "Install: curl -fsSL https://github.com/${REPO}/releases/latest/download/install.sh | bash" \
  dist/Troskovi-arm64.dmg dist/Troskovi-x64.dmg dist/install.sh

echo
echo "Send this to your friend (paste into Terminal):"
echo "  curl -fsSL https://github.com/${REPO}/releases/latest/download/install.sh | bash"
