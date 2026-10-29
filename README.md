# FitGirl-FuckingFast Auto Downloader

A Chrome Manifest V3 extension for manually opened FuckingFast file pages. When the user explicitly turns Auto Download ON, it makes at most one automatic click on a strictly verified control per document. Each tab/document has independent automation state; pending confirmation in one tab never blocks another. Auto Download defaults to OFF.

## Current implementation

- `manifest.json` scopes content scripts to `https://fuckingfast.co/*` and requests `storage`, `downloads`, and `alarms` permissions. The alarm is needed to release a pending queue after the service worker sleeps.
- `src/hosts/fuckingfast.js` checks the exact HTTPS host, file-page route, and candidate DOM control. URLs with or without a filename fragment, and with optional query parameters, are accepted if the file ID matches the control's POST path.
- `src/content/index.js` coordinates bounded detection and a one-click engine. It never clicks ads, retries, sends a direct POST, or performs a second click.
- `src/background/` records claims before clicking and keeps independent per-tab/document confirmation state. A pending or missing download event in one tab does not block another. Its session state stores hashes of the page path and, when available, the verified page filename; it does not store a full URL, raw filename, or local download path. An alarm and content-script timeout release stale attempts after about 15 seconds, including after a service worker restart.
- `src/popup/` provides the OFF-by-default toggle and status for detection, attempt, matching download, errors, and manual fallback.
- `tests/fixtures/` and `tests/browser/` use mock HTML and fake download events. The suite never downloads a real file.

## Evidence and detector rules

One supplied saved HTML page identifies the hostname `fuckingfast.co`, a page URL shaped like `https://fuckingfast.co/<FILE_ID>#<FILENAME>`, and an anchor with classes `link-button text-5xl gay-button`, text `DOWNLOAD`, `hx-post="/f/<FILE_ID>/go"`, `hx-swap="none"`, and `rel="noopener"`. The page shows a filename and size, includes htmx-related behavior, warns about ad download buttons, and says the first click opens ads while the second starts a download. These are observations from one saved page; the actual results of clicking and the stability of the markup have **not** been verified.

The detector requires an exact HTTPS hostname, a single-segment file ID, an `a` element with all observed attributes and exact `DOWNLOAD` text, no `href`, a root-relative `hx-post` path shaped `/f/<FILE_ID>/go`, a matching page and POST file ID, and a visible, enabled element. It resolves the POST destination against the page and checks the origin. It returns `candidate` only for one valid control; multiple valid controls are `ambiguous`. Other `hx-post` elements are counted as invalid and never activated. Query parameters and the optional filename fragment do not affect the file-ID check.

**Fragment regression:** Older detection code required a nonempty URL fragment and therefore returned `unsupported-page` for `https://fuckingfast.co/<FILE_ID>`. The current parser extracts `<FILE_ID>` only from the pathname; the fragment is optional and query parameters do not change that ID. If Chrome still reports `unsupported-page` for a single-ID path, turn Auto Download OFF, reload the unpacked extension at `chrome://extensions`, then refresh the file page before retesting detection.

The file ID grammar remains a conservative interpretation of the sample. The fixtures use placeholder IDs and filenames; they contain no external scripts or real download tokens. Countdown and error fixtures are synthetic and unverified.

## Reload and test independent downloads in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project directory (the folder containing `manifest.json`).
4. After code changes, click **Reload** on the extension card and refresh or reopen the test file page. New permissions may require Chrome approval. Open the popup and confirm Auto Download is **OFF**.
5. Turn Auto Download **ON**, then manually open one authorized FuckingFast file page. Enabling it on an already loaded page does not trigger an immediate click; reload that page to test.
6. Check the page Console for `[FFAD]` detection and `attempt-started` or `clicked`. Confirm the browser download in `chrome://downloads`.
7. While that download is still active, manually open a **different** valid file link in a new tab. The second page should receive its own `clicked` attempt without waiting for the first page's download event. Repeat with additional independent tabs if desired; the extension never opens links for you.
8. If a page shows `download-unconfirmed` or a manual fallback, the extension will not retry that document. You may click its verified control manually. Do not interact with ad tabs or bypass browser prompts.
9. Turn Auto Download **OFF** after testing. Reload a page if you want to verify OFF behavior. Check `chrome://extensions` for worker or content-script errors.

The user confirmed live detection as `candidate; valid=1; invalid=0`. After the FIFO fix, three different manually opened file pages each started an automatic download with no manual button click. The service worker reported download events about 0.5–1.3 seconds after click reports, but each event lacked a referrer, so the queue advanced only after the 15-second timeout. The filename fallback described below has **not** yet been tested with live Chrome downloads. The [Phase 2.5 checklist](docs/phase2-live-test.md) records additional manual observations.

## Diagnose independent-download timing

The controller handles each tab/document independently and does not wait for another tab's download completion. Live diagnostics showed that the previous referrer-only matcher rejected prompt download events because their referrer was missing. The fallback can match a filename when enough independent evidence is available.

After reloading the extension, open the service worker console from `chrome://extensions` and the Console for each file page. With Auto Download ON, manually open two or three different authorized file pages in new tabs. Compare these sanitized log codes and durations:

- Page Console: `click-attempted` shows the instant before the verified DOM control is activated; `queue-grant-received` and `queueWaitMs` show how long a queued page waited before its grant arrived.
- Worker Console: `attempt-queued`, `attempt-claimed`, `click-reported`, `download-event-received`, `download-matched-referrer` or `download-matched-filename`, `download-match-pending-metadata`, `download-unmatched-filename`, `download-unmatched-ambiguous`, or `download-unmatched-insufficient-evidence`, `attempt-confirmed` or `attempt-timed-out`, and `next-attempt-released`. Worker `tMs` is relative to that worker instance's start. `sinceClaimMs`, `sinceClickMs`, and `queueWaitMs` are relative durations in milliseconds; `sinceClickMs` can be absent if the event arrived before the click report.
- Compare worker `click-reported` with `download-event-received`. A prompt event followed by `download-match-pending-metadata` means Chrome has not supplied a usable filename yet; `downloads.onChanged` may later supply one. `download-matched-filename` followed by `next-attempt-released` demonstrates prompt queue advancement. `download-unmatched-insufficient-evidence` or `download-unmatched-ambiguous` means the queue still waits for the original timeout. Compare each page's own timestamps separately; page and worker clocks have different origins.

Share only reason codes and relative durations. Do not copy full URLs, referrers, file IDs, filenames, network responses, or tokens into a report. The 15-second confirmation window remains unchanged. [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms) are a recovery mechanism and may fire late; a content-script message also prompts expiry after about 16 seconds. A matching download-start event still releases the next page immediately, even while the first file continues downloading. **Reduced live latency has not yet been verified.**

## Download confirmation limits

Chrome's [`downloads.onCreated` event](https://developer.chrome.com/docs/extensions/reference/api/downloads) reports a browser download start, but its documented download item has no reliable initiating tab ID. An exact supported-page referrer match remains the preferred method. When the referrer is absent, the fallback requires exactly one pending attempt, a reported automatic click, a download start within 15 seconds after that click, one unique download ID, no competing no-referrer download events, and an exact normalized basename match between Chrome's download filename and the single visible `main h1` on the verified file page. A nonempty filename URL fragment must also agree with that page title. Filename matching is case sensitive and uses Unicode NFC; it does not remove Chrome's collision suffixes. The extension hashes the expected filename in session storage and never logs it or the local path. If the filename is absent on `onCreated`, it waits for a `filename` change in `downloads.onChanged`. A wrong, ambiguous, or late filename remains **unconfirmed**; the queue then advances after timeout. The download's `url` and `finalUrl` are not used as positive evidence because file delivery may use a different host. The extension does not query download history with `downloads.search`. A matching event is evidence that a browser download started, not proof that the synthetic click caused it. The extension does not call `chrome.downloads.download()` or collect browsing history.

The queue holds up to 16 other file pages for at most five minutes. Queued pages are delivered to the original Chrome document; closed or navigated tabs are removed, and switching Auto Download OFF cancels queued attempts. The `alarms` permission is used to wake the worker for timeouts after it has gone idle. Chrome may delay an alarm, so a queued page can wait longer than 15 seconds if no matching download event arrives and its original page no longer sends the timeout message. A failed or expired attempt is never clicked again automatically.

## Automated verification

With Node.js and Chrome installed, run:

```powershell
node tests/run.mjs
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest JSON OK')"
node --check src/background/service-worker.js
node --check src/background/controller.js
node --check src/hosts/fuckingfast.js
node --check src/content/observer.js
node --check src/content/auto-click.js
node --check src/content/index.js
node --check src/popup/popup.js
node --check tests/browser/runner.js
node --check tests/run.mjs
```

Set `CHROME_PATH` if Chrome is outside the common locations checked by the test runner. The suite includes FIFO, referrer and filename correlation, delayed metadata, ambiguity, timeout, tab lifecycle, and worker restart mocks. A real three-file Chrome retest of filename matching is still required.

## Evidence still needed

- At least two more sanitized file-page samples with distinct IDs and filenames, including nearby advertisement controls and any differences in classes or attributes.
- Sanitized DOM and timing for initial, countdown, ready, error, and dynamically rendered states. The countdown and error fixtures currently model possibilities, not observed site behavior.
- Real automatic-click observations for one file: whether the click opens an ad tab, whether Chrome blocks a popup, whether a matching download event appears, and whether the original page changes. Redact IDs, query strings, tokens, and full download URLs.
- Manual observations of first and second clicks, htmx requests, and whether the browser requires a real user gesture. A synthetic click may behave differently.
- Confirmation that the file ID grammar and no-`href` rule hold across more files.

See `docs/phase3-design.md` for the MVP design and remaining verification.
