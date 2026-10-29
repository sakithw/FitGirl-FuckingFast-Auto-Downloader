# Roadmap

## Phase 1 — Setup

- [x] Add project conventions, README, ignore rules, and this roadmap.
- [x] Add a valid Manifest V3 manifest, inert content script, basic service worker, and initial popup.
- [x] Document how to load the unpacked extension and run structural checks.

## Phase 2 — Page detection

- Build a testable FuckingFast host adapter and local mock HTML fixtures.
- Inspect real download pages before defining production selectors. Capture sanitized HTML for initial, countdown, ready, and error states; URL patterns; timing; and evidence distinguishing the genuine download control from ads.
- Detect supported pages and report a clear unsupported or unverified state.

## Phase 3 — Auto-clicking

- Add a stored ON/OFF preference and activate only a verified control when enabled.
- Handle dynamic rendering and ordinary countdowns with bounded observation and retries.
- Prevent repeated clicks; ignore advertisements, popups, CAPTCHAs, and access controls.

## Phase 4 — Download confirmation

- Add the `downloads` permission only when implementing download event monitoring.
- Correlate a user-opened supported page with a real `chrome.downloads` event, handle errors, and avoid duplicate counts.
- Keep counters and status in extension storage without collecting browsing history or transmitting data.

## Phase 5 — Popup UI

- Provide a working ON/OFF toggle, current status, counters, and actionable errors.
- Persist preferences and display status from the worker consistently across popup openings.

## Phase 6 — Testing and release

- Test against fixtures and inspected live pages, including countdowns, dynamic buttons, ads, duplicate events, errors, and disabled state.
- Review permissions, privacy behavior, and Chrome extension loading before packaging.
