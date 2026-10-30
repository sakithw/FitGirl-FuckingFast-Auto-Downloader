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
- [x] Remove the global `busy`/FIFO scheduling behavior. Each tab/document now claims and confirms independently; a missing event never blocks another tab.
- [ ] Retest three successive file pages in real Chrome with overlapping attempts. User-reported prior downloads do not validate this new architecture.
- [ ] Verify whether the site's second-click claim and browser user-activation behavior affect future design.

## Phase 4 — Download confirmation

- [x] Add the `downloads` permission for MVP start and interruption monitoring.
- [x] Add privacy-safe relative timing and unmatched-event reason codes across clicking, download correlation, and per-document timeout.
- [x] Identify the earlier live delay: prompt download-start events lacked referrers and were rejected by the old matcher.
- [x] Add a bounded filename fallback using the verified page title, click timing, unique download ID, and `downloads.onChanged` for delayed filename metadata. The current browser suite includes independent-tab filename matching.
- [ ] Retest three different file pages in real Chrome and verify independent `download-matched-filename` handling. **NOT TESTED.**
- [ ] Validate referrer-based correlation on live downloads and investigate missing referrers or redirects before claiming broad reliability.
- [ ] Correlate a user-opened supported page with real events across more site states, handle errors, and avoid duplicate counts.
- Keep counters and status in extension storage without collecting browsing history or transmitting data.

## Phase 5 — Popup UI

- [x] Replace the checkbox with the Minimal One-Click dark popup and semantic Enable/Disable button.
- [x] Show automation readiness separately from page detection, click activity, download observation, and manual fallback.
- [x] Preserve the existing `autoEnabled` storage key and OFF-by-default behavior.
- [x] Add mock popup tests for loading, enable/disable persistence, reopening-compatible state, unsupported pages, and unconfirmed downloads.
- [x] Phase 5.2: compact the popup to 340px with a 40px icon, one status card, one button, and a supported-site row; hide idle activity and redundant rows.
- [x] Export transparent RGBA Circle Arrow icons at 16/32/48/128/512px and preview them on white, dark, and checkerboard backgrounds.
- [x] Replace indefinite page checking with bounded requests and terminal states; keep saved preference controls available when page status fails.
- [x] Run 28 browser tests, including icon alpha/dimensions, popup overflow, async failure recovery, persistence, and existing independent-tab/duplicate-click regressions.
- [x] Phase 5.3: distinguish restricted/unrelated/unknown contexts from actual supported-page failures; preserve genuine error messages in valid worker status replies.
- [x] Add the horizontal icon/status layout, explicit 14px semibold 46px power button, and helpful footer with the manifest version. Preserve the selected transparent icon files.
- [x] Run the expanded 35-test browser suite, including internal pages, real status errors, error-only replies, footer version, typography, and content-driven dimensions.
- [ ] Validate the popup manually in Chrome across popup reopening and tab changes.

## Phase 6 — Testing and release

- Test against fixtures and inspected live pages, including countdowns, dynamic buttons, ads, duplicate events, errors, and disabled state.
- Review permissions, privacy behavior, and Chrome extension loading before packaging.
