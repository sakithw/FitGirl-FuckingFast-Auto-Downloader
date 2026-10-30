# FitGirl-FuckingFast Auto Downloader

A free extension for desktop Google Chrome that attempts to click the verified DOWNLOAD button when you manually open a supported FuckingFast file page. It saves repetitive clicking, while you still open each file link yourself.

**Version 1.0.0 is available on GitHub.** The project owner reports successful Chrome testing across multiple independently opened file pages. This extension is for desktop Google Chrome.

> **[Download FitGirl-FuckingFast Auto Downloader v1.0.0](https://github.com/sakithw/FitGirl-FuckingFast-Auto-Downloader/releases/tag/v1.0.0)**

It saves repetitive clicking on the verified **DOWNLOAD** button. You still open each file link yourself; the extension does not find or open links for you.

## Download

1. Open the [v1.0.0 release page](https://github.com/sakithw/FitGirl-FuckingFast-Auto-Downloader/releases/tag/v1.0.0).
2. Scroll to **Assets** near the bottom of the page. Click **Assets** if the list is collapsed.
3. Select **FitGirl-FuckingFast-Auto-Downloader-v1.0.0.zip** and wait for it to finish downloading.

Choose the named extension ZIP under **Assets**. Do not choose GitHub's **Source code (zip)** or **Source code (tar.gz)** archive; those are repository snapshots, not the ready-to-load extension package.

## Install on Windows

1. Open **File Explorer**, select **Downloads**, and find `FitGirl-FuckingFast-Auto-Downloader-v1.0.0.zip`.
2. Right-click the ZIP and choose **Extract All...**, then choose **Extract**. Keep the extracted folder somewhere permanent; do not move or delete it after installation.
3. Open **Google Chrome** on your computer.
4. Enter `chrome://extensions` in Chrome's address bar and press **Enter**.
5. Turn on **Developer mode** using the switch near the top-right corner.
6. Click **Load unpacked** near the top-left of the page.
7. Browse to the extracted folder. Select the folder where `manifest.json` is directly visible—not the ZIP or a parent folder—and click **Select Folder**.
8. Confirm **FitGirl-FuckingFast Auto Downloader** appears in Chrome's extensions list.
9. To keep the icon visible, click Chrome's puzzle-piece icon and click the pin next to the extension.
10. Click the Circle Arrow extension icon, then click **Enable Auto Download**. The popup should say **Automation Enabled**.

These steps are for desktop Chrome on Windows. You do not need VS Code, Git, a command prompt, or coding knowledge. Only install extensions from sources you trust. Developer mode is Chrome's manual installation method; it does not mean Chrome reviewed the extension.

## Use the extension

1. Make sure the popup says **Automation Enabled**.
2. Manually open an individual file page on the supported `https://fuckingfast.co` host.
3. The extension checks for the verified DOWNLOAD button and attempts one automatic click on that page.
4. Check Chrome's download indicator or press **Ctrl+J** to view downloads. If the site or Chrome requires an action, follow its prompt or click the site's button yourself.
5. Open other file links manually as needed. Independently opened tabs can each make their own attempt; one active download does not hold up another tab.

A click attempt does not guarantee that a download will start or be confirmed. The extension does not retry or make a second automatic click.

## Common problems

| Problem | What to do |
| --- | --- |
| I cannot find the correct ZIP | Open the [v1.0.0 release page](https://github.com/sakithw/FitGirl-FuckingFast-Auto-Downloader/releases/tag/v1.0.0), expand **Assets**, and choose the named extension ZIP. |
| Load unpacked will not accept the ZIP | Choose **Extract All** first, then load the extracted folder containing `manifest.json`. |
| Chrome says the folder is not an extension | In the folder picker, select the inner extracted folder where `manifest.json` is visible. |
| The extension icon is not visible | Click Chrome's puzzle-piece icon and pin the extension. |
| The popup says Automation Paused | Click **Enable Auto Download** in the popup. |
| A download does not start | Check that the page is on `https://fuckingfast.co`, automation is enabled, and the page shows its normal download button. Check **Ctrl+J**. If needed, click the site's button manually and follow normal site or Chrome prompts. |
| Chrome asks about multiple downloads | Read Chrome's prompt. Allow it only if you trust the site and expect the downloads; the extension does not change Chrome's security settings. |
| I moved or deleted the extracted folder | Restore it, or extract the release ZIP again and load the new folder from `chrome://extensions`. |
| I am using Chrome on a phone | This unpacked-extension guide is for desktop Chrome; mobile Chrome does not provide the same installation workflow. |

## Important information

- The extension is free to download and use. It is not listed on the Chrome Web Store and is installed manually with Developer mode.
- It supports only the configured `https://fuckingfast.co` file pages. You must open each file link yourself.
- The unpacked installation does not update automatically from GitHub. Check the release page for updates and repeat the installation steps for a newer version.
- Use it only for downloads you are authorized to access. Review Chrome's permission information before installing.
- This is an independent project. It is not affiliated with, endorsed by, or maintained by FitGirl Repacks or FuckingFast.

## Privacy

The extension saves the Enable/Disable preference and temporary page and download-matching state locally in Chrome storage. It does not send browsing data to an extension-operated server, collect browsing history, or read downloaded file contents. Chrome download metadata is used to try to confirm whether a download started. Its permissions are `storage`, `downloads`, and `alarms`, and its page access is limited to `https://fuckingfast.co/*`.

## Get help

Report a problem on [GitHub Issues](https://github.com/sakithw/FitGirl-FuckingFast-Auto-Downloader/issues). Include your Chrome version, what you expected, and what happened. Do not post passwords, cookies, download tokens, or private file URLs.

## Developer documentation

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

## Install from the GitHub release

1. Download [FitGirl-FuckingFast-Auto-Downloader-v1.0.0.zip](https://github.com/sakithw/FitGirl-FuckingFast-Auto-Downloader/releases/tag/v1.0.0) from the release page's **Assets** section.
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

The privacy details above describe the data the extension stores and the permissions declared in manifest.json.

## Interface and artwork

The selected transparent Circle Arrow artwork is preserved. See the [white, dark, and checkerboard icon preview](docs/phase5.2-icon-preview.png) and [icon editing notes](docs/phase5.2-icon-notes.md). A new release popup screenshot has not been captured.

The popup uses a horizontal status card, a readable 14px semibold power button, a single supported-site row, and a footer whose version comes from manifest.json. Activity is hidden when idle, and enabled automation is never used as proof of download success.

## Development and verification

Run from the repository root:

    node tests/run.mjs
    node scripts/package.mjs

Set CHROME_PATH if Chrome is outside the common locations detected by the browser test runner. Automated checks use mocks and local fixtures and never start real downloads.

Automated verification for v1.0.0: **82 registered, 82 executed, 82 passed, 0 failed, 0 skipped**. See [test-history audit](docs/test-history-audit.md) for the explanation of earlier test totals and restored coverage. The package validator writes dist/package-validation.json and validates the ZIP structure and extracted runtime files.

The project owner reports successful real Chrome UI testing and automatic attempts across 6–7 independently opened file pages. Loading the published ZIP through Chrome's actual UI was not recorded as a separate test.

## Affiliation and license

This is an independent, unofficial third-party project. It is not affiliated with, endorsed by, or maintained by FitGirl Repacks or FuckingFast.

No software license has been selected. A license requires explicit project-owner approval before one is added.
