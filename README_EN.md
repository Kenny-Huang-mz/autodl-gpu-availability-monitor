# AutoDL GPU Availability Monitor

[简体中文](README.md) · [Privacy Policy](PRIVACY.md) · [Changelog](CHANGELOG.md)

An open-source Chromium extension that monitors rented AutoDL instances and alerts you when a stopped instance shows **GPU available** (`GPU充足`).

This is an independent community project, not an official AutoDL product. It never starts an instance or makes a purchase.

## Features

- Monitor multiple rented instances by name or instance ID
- In-page banner, audible alarm, and system notification
- One-shot or repeating alarm with a configurable interval
- In-page status panel with recent checks and logs
- Per-row matching to prevent status leakage from adjacent instances
- Recognition diagnostics that can be copied into an issue report
- No AutoDL password, cookie, or access-token storage
- Supports Chrome, Edge, Arc, and other Chromium browsers

## Install

1. Download and extract the ZIP from GitHub Releases.
2. Open `chrome://extensions`, `edge://extensions`, or `arc://extensions`.
3. Enable Developer mode.
4. Select **Load unpacked** and choose the extracted directory.
5. Open and refresh the AutoDL container-instances page.
6. Open the extension popup, enter instance names or IDs, and save.

## How it works

The extension reads the visible state of the signed-in AutoDL instance page. When a monitored row changes to `GPU充足`, it alerts you. The tab must remain open so the extension can periodically refresh it.

## Permissions

- `storage`: saves monitoring preferences
- `notifications`: shows a system notification
- AutoDL host access: reads visible instance status and renders the status panel

No analytics, advertising, remote code, or account credentials are collected. See [PRIVACY.md](PRIVACY.md).

## Development

No build step is required. Run `npm run check` and `npm run package`.

## License

[MIT](LICENSE)
