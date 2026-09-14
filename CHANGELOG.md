# Changelog

## [1.0.1] - 2026-09-14

### Fixed

- Move alarm playback from the AutoDL page to an extension offscreen document, avoiding Chromium autoplay-policy errors after automatic refreshes
- Use a fully resolved extension URL for the notification icon and handle notification creation failures

## [1.0.0] - 2026-09-14

### Added

- Multi-instance monitoring by name or instance ID
- Configurable refresh and audible-alert intervals
- One-shot and repeating alerts
- Chromium system notifications
- In-page status and log panel
- Per-instance diagnostics and copyable reports
- Automatic alarm reset after an unavailable → available cycle
- Chrome, Edge, and Arc support
