# FitGirl-FuckingFast Auto Downloader

A Chrome Manifest V3 extension intended to assist with legitimate download-button interactions on FuckingFast file pages that users open manually. The current implementation is **Phase 1 scaffolding**: it does not detect buttons, click anything, or monitor downloads.

## Current files

- `manifest.json`: Manifest V3 configuration with a narrowly scoped FuckingFast content-script match. No optional API permissions are requested yet.
- `src/content/index.js`: inert content script.
- `src/background/service-worker.js`: basic extension lifecycle worker.
- `src/popup/`: initial status popup.
- `ROADMAP.md`: phased implementation plan.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project directory (the folder containing `manifest.json`).
4. Pin the extension if desired and open its popup. It should show that automation is unavailable in Phase 1.
5. After editing extension files, select **Reload** on the extension card. Reopen any test page to reload its content script.

The manifest currently matches `https://fuckingfast.co/*` only. Confirm the actual supported host and URL patterns from inspected pages before expanding or relying on that match.

## Verification

With Node.js installed, run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest JSON OK')"
node --check src/background/service-worker.js
node --check src/content/index.js
node --check src/popup/popup.js
```

Chrome must still validate and load the extension for a complete Manifest V3 check.

## Evidence needed for integration

Before implementing production detection, provide or inspect sanitized FuckingFast page samples covering the initial state, any countdown, ready download control, and errors. Each sample should include its URL shape, relevant DOM around the genuine control, distinguishing attributes or text, rendering timing, and the action's resulting navigation or download behavior. Remove personal data, access tokens, and full download URLs. Local mock HTML fixtures will be built from this evidence in Phase 2.

The extension will not bypass CAPTCHAs, access controls, or browser security mechanisms, and it will not interact with advertisements or arbitrary popups.
