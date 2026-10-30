# Changelog

## 1.0.0 — proposed release candidate (unreleased)

This entry describes the prepared candidate. No public v1.0.0 release has been created.

### Features

- Strict FuckingFast URL and verified htmx download-control detection.
- Optional one-click automation per eligible document, OFF by default.
- Independent per-tab attempts without a global busy/FIFO confirmation scheduler.
- Chrome download-event monitoring, bounded unconfirmed states, and manual fallback.
- Compact popup with persistent Enable/Disable, accurate page/activity states, accessible controls, and manifest-derived version text.
- Transparent Circle Arrow icons at 16, 32, 48, 128, and 512 pixels.

### Reliability and release preparation

- Restored important detection, observer, automation, and metadata regressions removed during earlier test-runner simplification.
- Explicit registered/executed/passed/failed/skipped test accounting.
- Security and privacy review with documented local/session data handling.
- Runtime-only ZIP packaging with manifest.json at the archive root and extracted-package validation.
- Prepared installation instructions and GitHub release notes.

### Verification

- Automated release-candidate result: 82 registered, 82 executed, 82 passed, 0 failed, 0 skipped.
- User reports successful Chrome UI testing and 6–7 independently opened automatic file downloads.
- Newly extracted ZIP load through Chrome's actual UI: **NOT TESTED**.
- Download correlation remains conservative and is not guaranteed for every download.

## 0.1.0 — development scaffold

- Added the Manifest V3 scaffold, service worker, popup, and content script.
- Established project conventions, mock fixtures, host adapter architecture, and development documentation.
- Continued development under 0.1.0 through the automation and popup phases before the proposed 1.0.0 candidate.
