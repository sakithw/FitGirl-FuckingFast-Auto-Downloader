# FitGirl-FuckingFast Auto Downloader

A Chrome Manifest V3 extension for manually opened FuckingFast file pages. **Phase 3 MVP:** when the user explicitly turns Auto Download ON, it makes at most one automatic click on a strictly verified download control. It observes browser download events and shows a manual fallback if no matching event appears. Auto Download defaults to OFF.

## Current implementation

- `manifest.json` scopes content scripts to `https://fuckingfast.co/*` and requests only `storage` and `downloads` permissions.
- `src/hosts/fuckingfast.js` checks the exact HTTPS host, file-page route, and candidate DOM control. URLs with or without a filename fragment, and with optional query parameters, are accepted if the file ID matches the control's POST path.
- `src/content/index.js` coordinates bounded detection and a one-click engine. It never clicks ads, retries, sends a direct POST, or performs a second click.
- `src/background/` records the claim before clicking, holds only one pending automatic attempt at a time, and observes download events. Its session state stores a hash of the page origin and path, not a full URL or filename.
- `src/popup/` provides the OFF-by-default toggle and status for detection, attempt, matching download, errors, and manual fallback.
- `tests/fixtures/` and `tests/browser/` use mock HTML and fake download events. The suite never downloads a real file.

## Evidence and detector rules

One supplied saved HTML page identifies the hostname `fuckingfast.co`, a page URL shaped like `https://fuckingfast.co/<FILE_ID>#<FILENAME>`, and an anchor with classes `link-button text-5xl gay-button`, text `DOWNLOAD`, `hx-post="/f/<FILE_ID>/go"`, `hx-swap="none"`, and `rel="noopener"`. The page shows a filename and size, includes htmx-related behavior, warns about ad download buttons, and says the first click opens ads while the second starts a download. These are observations from one saved page; the actual results of clicking and the stability of the markup have **not** been verified.

The detector requires an exact HTTPS hostname, a single-segment file ID, an `a` element with all observed attributes and exact `DOWNLOAD` text, no `href`, a root-relative `hx-post` path shaped `/f/<FILE_ID>/go`, a matching page and POST file ID, and a visible, enabled element. It resolves the POST destination against the page and checks the origin. It returns `candidate` only for one valid control; multiple valid controls are `ambiguous`. Other `hx-post` elements are counted as invalid and never activated. Query parameters and the optional filename fragment do not affect the file-ID check.

**Fragment regression:** Older detection code required a nonempty URL fragment and therefore returned `unsupported-page` for `https://fuckingfast.co/<FILE_ID>`. The current parser extracts `<FILE_ID>` only from the pathname; the fragment is optional and query parameters do not change that ID. If Chrome still reports `unsupported-page` for a single-ID path, turn Auto Download OFF, reload the unpacked extension at `chrome://extensions`, then refresh the file page before retesting detection.

The file ID grammar remains a conservative interpretation of the sample. The fixtures use placeholder IDs and filenames; they contain no external scripts or real download tokens. Countdown and error fixtures are synthetic and unverified.

## Reload and test one automatic download in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project directory (the folder containing `manifest.json`).
4. After code changes, click **Reload** on the extension card and refresh or reopen the test file page. New permissions may require Chrome approval. Open the popup and confirm Auto Download is **OFF**.
5. Turn Auto Download **ON**, then open or reload **one** authorized FuckingFast file page. Enabling it on an already loaded page does not trigger an immediate click; reload that page to test.
6. Check the page Console for `[FFAD]` detection and one automatic-attempt message. The popup should show a verified candidate and `Clicked once`, then either `Matching download started`, `Download complete`, `Download interrupted`, or `No matching download` with manual fallback. Check `chrome://downloads` before treating a download as real.
7. If no matching download appears after about 15 seconds, the extension will not retry. You may click the verified control manually. Do not interact with ad tabs or bypass browser prompts.
8. Turn Auto Download **OFF** in the popup after the one-file test. Reload the page if you want to verify the OFF behavior. Check `chrome://extensions` for worker or content-script errors.

The user confirmed live Chrome detection as `candidate; valid=1; invalid=0` and reported that manual clicking previously started a download. **Automatic clicking on a real file has not been tested in this environment.** The site's two-click statement and popup behavior remain unverified. The [Phase 2.5 checklist](docs/phase2-live-test.md) records additional manual observations.

## Download confirmation limits

Chrome's [`downloads.onCreated` event](https://developer.chrome.com/docs/extensions/reference/api/downloads) reports a browser download start, but its documented download item has no reliable initiating tab ID. This MVP matches only a unique pending attempt with a referrer on the same verified file-page path, within 15 seconds. A missing referrer, different referrer, competing download, or later start remains **unconfirmed**. A matching event is evidence that a browser download started, not proof that the synthetic click caused it. The extension does not call `chrome.downloads.download()` or collect browsing history.

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

Set `CHROME_PATH` if Chrome is outside the common locations checked by the test runner. The latest local run passed 43 browser fixture tests. A real automatic-click smoke test is still required.

## Evidence still needed

- At least two more sanitized file-page samples with distinct IDs and filenames, including nearby advertisement controls and any differences in classes or attributes.
- Sanitized DOM and timing for initial, countdown, ready, error, and dynamically rendered states. The countdown and error fixtures currently model possibilities, not observed site behavior.
- Real automatic-click observations for one file: whether the click opens an ad tab, whether Chrome blocks a popup, whether a matching download event appears, and whether the original page changes. Redact IDs, query strings, tokens, and full download URLs.
- Manual observations of first and second clicks, htmx requests, and whether the browser requires a real user gesture. A synthetic click may behave differently.
- Confirmation that the file ID grammar and no-`href` rule hold across more files.

See `docs/phase3-design.md` for the MVP design and remaining verification.
