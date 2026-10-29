# Roadmap

## Phase 1 — Setup

- [x] Add project conventions, README, ignore rules, and this roadmap.
- [x] Add a valid Manifest V3 manifest, inert content script, basic service worker, and initial popup.
- [x] Document how to load the unpacked extension and run structural checks.

## Phase 2 — Page detection

- [x] Build a testable FuckingFast host adapter and local mock HTML fixtures.
- [x] Detect the exact hostname and observed file-page shape supplied from one saved HTML page.
- [x] Add evidence-based, read-only control detection, sanitized fixtures, diagnostics, and bounded observer tests.
- [ ] Verify the observed control against additional real page samples, including initial, countdown, ready, and error states and nearby ads.
- [x] Complete an unpacked-extension Chrome detection check on a real supported page. User reported `candidate; valid=1; invalid=0`.

## Phase 2.5 — Live browser verification

- [x] Review host, endpoint, file ID, visibility, and duplicate-control checks; prepare privacy-safe diagnostics.
- [x] Add `docs/phase2-live-test.md` with a two-file manual Chrome procedure and evidence checklist.
- [x] Run the automated browser fixture suite, including fragment-free URL regressions: 43 passed in headless Chrome.
- [x] Confirm real Chrome content-script detection. User reported `candidate; valid=1; invalid=0`; the earlier headless command-line load attempt remains inconclusive.
- [ ] Observe the first and second manual clicks on two authorized file pages and record ads, htmx requests, and browser download events. **NOT TESTED.**

## Phase 3 — Auto-clicking

- [x] Accept verified file-page URLs with or without a filename fragment and with optional query parameters.
- [x] Add an OFF-by-default toggle and a single guarded click on one verified control.
- [x] Use bounded dynamic detection, an atomic worker claim, duplicate prevention, and manual fallback. No automatic second click or retry.
- [x] Observe matching `chrome.downloads` events and display detection, attempt, download, and error states in the popup.
- [x] Cover the MVP with mock browser tests; no real files are downloaded by the suite.
- [x] User confirmed that one automatically clicked file started downloading in Chrome.
- [x] Replace the one-shot `busy` rejection with a bounded FIFO queue for independently opened file pages. Queue state persists across service worker restarts; matching download-start events release the next page without waiting for file completion.
- [x] Retest three successive file pages in real Chrome. User reported all three automatic downloads started, with about ten seconds between successive starts.
- [ ] Verify whether the site's second-click claim and browser user-activation behavior affect future design.

## Phase 4 — Download confirmation

- [x] Add the `downloads` permission for MVP start and interruption monitoring.
- [x] Add privacy-safe relative timing and unmatched-event reason codes across queueing, clicking, download correlation, timeout, and queue release. The expanded mock suite passes 63 tests.
- [ ] Measure a new real Chrome run with the timing diagnostics; identify the cause of the observed roughly ten-second gaps before changing correlation or timeout policy. **NOT TESTED.**
- [ ] Validate referrer-based correlation on live downloads and investigate missing referrers or redirects before claiming broad reliability.
- [ ] Correlate a user-opened supported page with real events across more site states, handle errors, and avoid duplicate counts.
- Keep counters and status in extension storage without collecting browsing history or transmitting data.

## Phase 5 — Popup UI

- [x] Provide a working ON/OFF toggle and MVP detection, attempt, download, error, and manual-fallback status.
- [ ] Add counters and finish UI validation across popup openings and tab changes.
- [x] Persist the preference locally and show session status from the worker.

## Phase 6 — Testing and release

- Test against fixtures and inspected live pages, including countdowns, dynamic buttons, ads, duplicate events, errors, and disabled state.
- Review permissions, privacy behavior, and Chrome extension loading before packaging.
