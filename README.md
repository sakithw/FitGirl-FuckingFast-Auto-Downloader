# FitGirl-FuckingFast Auto Downloader

A Chrome Manifest V3 extension intended to assist with legitimate download-button interactions on FuckingFast file pages that users open manually. **Phase 2 is read only**: it checks the host and reports that production download controls are unverified. It does not click, navigate, or monitor downloads.

## Current files

- `manifest.json`: Manifest V3 configuration with a narrowly scoped FuckingFast content-script match. No optional API permissions are requested yet.
- `src/hosts/fuckingfast.js`: exact-host URL check and pure DOM candidate selection. No production selector is configured.
- `src/content/index.js`: read-only diagnostics; `src/content/observer.js` is a bounded, debounced helper tested with fixtures but not used on live pages yet.
- `src/background/service-worker.js`: basic extension lifecycle worker.
- `src/popup/`: initial status popup.
- `tests/fixtures/` and `tests/browser/`: synthetic HTML and automated browser tests. Fixture attributes are test-only and are never used for production detection.
- `ROADMAP.md`: phased implementation plan.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project directory (the folder containing `manifest.json`).
4. Pin the extension if desired and open its popup. It should show that automation is unavailable in Phase 2.
5. After editing extension files, select **Reload** on the extension card. Reopen any test page to reload its content script.

The manifest and adapter accept the exact HTTPS hostname `fuckingfast.co` only. This is the hostname already present in Phase 1; no additional hostname or file-page route has been verified. An unrelated site receives no content script because the manifest excludes it.

## Manual Chrome detection check

1. Load the unpacked extension as above and open a page under `https://fuckingfast.co/` that you are authorized to inspect.
2. Open that tab's DevTools **Console** and filter for `[FFAD]`.
3. Expect: `[FFAD] Supported host; download control unverified. No action taken.` No control should be activated and no download should start from the extension.
4. Check `chrome://extensions` for manifest or service-worker errors. If the site's actual host differs, record it; do not widen the match until it is verified.

**Outstanding smoke test:** The unpacked extension has not been loaded into the Chrome UI or checked on a real FuckingFast page in this environment. The automated suite does run in headless Chrome against local fixtures.

## Verification

With Node.js and Chrome installed, run:

```powershell
node tests/run.mjs
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest JSON OK')"
node --check src/background/service-worker.js
node --check src/hosts/fuckingfast.js
node --check src/content/index.js
node --check src/content/observer.js
node --check src/popup/popup.js
```

Set `CHROME_PATH` if Chrome is installed outside the common locations checked by the test runner. Chrome must still validate and load the unpacked extension for a complete Manifest V3 smoke test.

## Evidence needed for integration

Before implementing production detection, provide or inspect:

- The exact HTTPS hostname and file-page URL shape, with file IDs and query values redacted.
- Sanitized DOM around the genuine control in the initial, countdown, ready, and error states, plus nearby ad and popup controls that could be confused with it.
- Evidence that distinguishes the genuine control from ads, including stable attributes, text variations, disabled states, and whether it is an anchor or button.
- Timing and DOM changes when the control appears, and the ordinary transition after a manual click. Describe resulting navigation or browser download behavior without sharing tokens or full download URLs.
- At least two independent page samples to check that any selector is stable across files.

The supplied anchor snippet shows a `DOWNLOAD` link with an `hx-post` attribute, but does not establish its page context, authenticity, other page states, or download outcome. Its path contains a file-specific identifier, so it is not copied into fixtures or used as a production selector. The current fixtures are synthetic test cases, not evidence of the live site's DOM.

The extension will not bypass CAPTCHAs, access controls, or browser security mechanisms, and it will not interact with advertisements or arbitrary popups.
