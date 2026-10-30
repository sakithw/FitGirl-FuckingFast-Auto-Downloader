# FitGirl-FuckingFast Auto Downloader

A Chrome Manifest V3 extension that makes one guarded download-control click on each manually opened, supported FuckingFast file page when the user enables automation.

**v1.0.0 release candidate.** The user reports that the compact popup, Enable/Disable setting, transparent icon, and automatic clicking across 6–7 independent file pages work in Chrome.

## Features

- Exact HTTPS host support for fuckingfast.co.
- One automatic click per eligible document, with a fresh control validation immediately before the click.
- Independent per-tab attempts: a pending or unconfirmed download in one tab never holds up another manually opened tab.
- OFF-by-default automation with a saved Enable/Disable setting.
- A compact 340px popup with separate automation, page, attempt, download, error, and manual-fallback states.
- A transparent Circle Arrow icon at 16, 32, 48, 128, and 512 pixels.
- Chrome download-event monitoring with conservative correlation and a bounded unconfirmed state.

The extension does not open file links, perform a second click, retry failed attempts, interact with advertisements, or bypass CAPTCHA, access controls, or Chrome security protections.

## Requirements

- Chrome 102 or newer for the extension. Use a current Chrome build for development checks.
- A FuckingFast file link that you are authorized to download.
- Node.js 22 or newer and Chrome installed to run the developer test and packaging commands. Node.js is not needed to use the extension.

## Install the release candidate

1. Obtain the local candidate ZIP: [FitGirl-FuckingFast-Auto-Downloader-v1.0.0.zip](dist/FitGirl-FuckingFast-Auto-Downloader-v1.0.0.zip).
2. Extract it to a persistent folder. The extracted folder must contain manifest.json directly, alongside src/ and assets/.
3. Open chrome://extensions and enable **Developer mode**.
4. Click **Load unpacked** and select that extracted folder.
5. Open the popup and check the saved automation setting.

For development, select this repository's root folder instead. After changing source files, click **Reload** on the extension card and refresh or reopen supported file pages. Existing content-script documents keep their earlier code until refreshed. Chrome may preserve your saved Enable/Disable preference across an extension reload.

The ZIP is a local release candidate. No GitHub release or Chrome Web Store publication has been created.

## Enable and disable automation

Click **Enable Auto Download** in the popup, then manually open one supported file page. Enabling the setting on a page that is already loaded does not trigger an immediate click; reload that page to test.

Click **Disable Auto Download** to pause automation. Close and reopen the popup to check persistence. The supported-site checkmark identifies the configured host, not the current page or a successful download. Unknown or unrelated contexts show neutral guidance; actual page and download errors remain visible.

Chrome internal pages such as chrome://extensions cannot be automated. The popup shows guidance to open a file link rather than presenting that context as a generic error.

## How automatic clicking works

1. The adapter accepts only HTTPS on the exact fuckingfast.co hostname and a single-segment file path. A filename fragment is optional, and a query does not change the pathname file identifier.
2. Detection requires exactly one visible, enabled DOWNLOAD anchor with the inspected classes and htmx attributes. Its root-relative hx-post endpoint must be /f/&lt;FILE_ID&gt;/go and match the file identifier in the page pathname.
3. The content script waits for ordinary DOM rendering for a bounded period, checks the saved setting, and asks the worker to record the document's attempt before clicking.
4. The engine revalidates the same control, confirms that automation is still enabled, and clicks it once.
5. The worker observes Chrome's download events. Confirmation is separate from the click attempt. Missing evidence ends as unconfirmed with manual fallback; it does not block independent tabs.

The host markup and filename extraction are based on supplied saved-page evidence. Additional host states and future site changes may require new evidence and adapter updates. The fixtures use placeholder file identifiers and never contain live download tokens.

## Download confirmation and limitations

An exact supported-page referrer is preferred. When referrer data is absent or insufficient, a unique matching expected filename and click/start timing can provide fallback evidence. The expected filename comes from the verified file page, not solely from a URL fragment. Download filenames are compared by basename after conservative Unicode normalization; case differences and Chrome collision suffixes such as “(1)” are not silently treated as exact matches.

Chrome may supply filename metadata later. The worker can retain a bounded candidate and inspect a later event or retrieve metadata for that specific observed download ID. It does not perform an unrestricted download-history query. Timing alone is not enough to confirm a download.

Known limitations:

- Browser download events have no reliable initiating tab ID. Referrer, filename, and timing evidence can remain missing or ambiguous.
- A matching download event does not prove that the synthetic click caused it; an unrelated same-name download in the same window is a remaining attribution limitation.
- A real download can start while the popup still reports **Download not confirmed**.
- The DOM observer is bounded, the confirmation window is about 15 seconds, and Chrome can delay alarms or page timers.
- Synthetic clicks may differ from manual user clicks when the host or browser requires user activation. The extension offers manual fallback and never bypasses that requirement.
- Refreshing a page creates a new eligible document. One-click protection is per document, not a promise to deduplicate the same file across intentional reloads.
- Only FuckingFast is supported. This is not a mass downloader or a link-opening tool.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Automation Paused | Enable Auto Download, then open or reload a supported file page. |
| No click | Check that the URL is HTTPS on exactly fuckingfast.co, and that the adapter sees one valid control. Missing, hidden, invalid, or ambiguous controls stop automation. |
| Open a file link to begin | The current context is unrelated, restricted, or not yet identified. Open a supported file link manually. |
| Page details are not available | The page-status request failed or timed out. The saved toggle remains usable. Check extension errors and reopen the popup. |
| Download not confirmed | Check chrome://downloads. The file may have started without usable metadata. The extension will not retry that document automatically. |
| Old UI or selectors | Reload the unpacked extension at chrome://extensions, then refresh the file page. |

Inspect the extension card's **Errors** and **service worker** links at chrome://extensions and the supported page's Console for sanitized [FFAD] reason codes and relative durations. Do not share full URLs, file names, local paths, cookies, or tokens in bug reports.

## Privacy and permissions

This extension stores data locally; it does not claim that nothing is stored.

| Location | Data |
| --- | --- |
| chrome.storage.local | The autoEnabled preference. It defaults to false when no value is saved. |
| chrome.storage.session | Per-tab/document detection and attempt state, counts/reason codes, timestamps, download IDs, metadata-candidate bookkeeping, and SHA-256 fingerprints of the page origin/path and expected filename when available. |
| Transient runtime memory/messages | Supported-page DOM details and filename evidence, sender URLs, and Chrome download metadata needed to evaluate a match. Raw values are not intentionally written to the session record or console. |

The **storage** permission persists the preference and session state. **downloads** receives browser download metadata; Chrome can supply events for downloads unrelated to this extension, and the controller rejects events that it cannot associate safely. **alarms** supports bounded confirmation cleanup after the service worker sleeps. Content-script access is limited to https://fuckingfast.co/*; there is no all_urls, history, or broad tabs permission.

The extension does not read downloaded file contents, run analytics, upload browsing data, fetch remote executable code, or send private information to an extension-operated server. Clicking the verified host control allows that page to perform its normal requests; the host's own behavior is outside the extension's control.

The [security and privacy audit](docs/security-privacy-audit.md) records the source audit and remaining limits.

## Interface and artwork

The selected transparent Circle Arrow artwork is preserved. See the [white, dark, and checkerboard icon preview](docs/phase5.2-icon-preview.png) and [icon editing notes](docs/phase5.2-icon-notes.md). A new release popup screenshot has not been captured.

The popup uses a horizontal status card, a readable 14px semibold power button, a single supported-site row, and a footer whose version comes from manifest.json. Activity is hidden when idle, and enabled automation is never used as proof of download success.

## Development and verification

Run from the repository root:

    node tests/run.mjs
    node scripts/package.mjs

Set CHROME_PATH if Chrome is outside the common locations detected by the browser test runner. Automated checks use mocks and local fixtures and never start real downloads.

Current release-candidate automated result: **82 registered, 82 executed, 82 passed, 0 failed, 0 skipped**. See [test-history audit](docs/test-history-audit.md) for the explanation of earlier test totals and restored coverage. The package validator writes dist/package-validation.json and validates the ZIP structure and extracted runtime files.

User-reported real Chrome UI and 6–7 independent-file automation tests passed. **Loading the newly extracted candidate ZIP through Chrome's actual UI is NOT TESTED** until the user completes that separate check.

## Release preparation and publication

Version 1.0.0 is a proposed release-candidate version. It is not a statement that a public release exists. See [CHANGELOG.md](CHANGELOG.md) and the [prepared release notes](docs/release-notes-v1.0.0.md).

After approval, review the working tree and test/package results, commit the approved changes, and push the existing branch to the existing repository. Create a GitHub release for tag v1.0.0 using the prepared title and notes; attach the validated ZIP and review the draft before publishing. No repository rename or Chrome Web Store publication is part of this task.

## Affiliation and license

This is an independent, unofficial third-party project. It is not affiliated with, endorsed by, or maintained by FitGirl Repacks or FuckingFast.

No software license has been selected. A license requires explicit project-owner approval before one is added.
