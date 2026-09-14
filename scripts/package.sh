#!/bin/sh
set -eu

node scripts/check.mjs
version=$(node -p "require('./manifest.json').version")
mkdir -p dist
archive="dist/autodl-gpu-monitor-extension-v${version}.zip"

zip -qr "$archive" \
  manifest.json background.js content.js content.css popup.html popup.js popup.css \
  icon.svg icons README.md README_EN.md PRIVACY.md LICENSE CHANGELOG.md

unzip -t "$archive"
printf '%s\n' "Created $archive"
