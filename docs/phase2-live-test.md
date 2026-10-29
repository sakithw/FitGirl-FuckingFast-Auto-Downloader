# Phase 2.5 live Chrome verification

## Status

**Update from the user:** live Chrome detection succeeded with `candidate; valid=1; invalid=0`, and manual clicking previously started a download. The exact first-click/second-click sequence, request behavior, and automatic-click outcome remain unverified. The earlier headless command-line load attempt was inconclusive.

The saved page says the **first click opens ads** and the **second click starts a download**. These are claims printed by that page. Neither outcome has been observed in a live browser yet. The extension never performs either click.

## Before testing

- Use two different file links that you are authorized to open. Record them as **File A** and **File B**; keep real IDs, filenames, query strings, session data, and download URLs out of shared notes.
- Use a separate Chrome profile if practical. Keep normal popup and security settings in place. Do not disable protections or interact with advertisement tabs.
- Decide whether you are willing to start a real download manually. If not, stop before the second click and mark download confirmation **NOT TESTED**.
- Keep DevTools open on the original file-page tab. In **Network**, enable **Preserve log** and select **Fetch/XHR**; in **Console**, filter for `[FFAD]`.

## Load the unpacked extension

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select the project folder containing `manifest.json`.
2. Confirm the extension card appears, is enabled, and shows no load errors. Open **Errors** if present and record sanitized error messages.
3. Open the card's **service worker** inspection link. Check its console for startup errors. The worker currently performs only the install lifecycle log; no download monitoring exists.
4. Open the extension popup. It must say automation is unavailable and clicking/downloads are disabled. Reload the extension and the file page after any code edits.

## Read-only detection on each file

1. Manually open File A. Confirm the address is HTTPS on the exact hostname `fuckingfast.co` and follows the observed single-ID path plus filename fragment. Do not paste the full address into notes.
2. In the original tab's DevTools Console, confirm `[FFAD] Supported host detected` and `Observer active for up to 10 seconds` appear. Record whether an initial detection state appears and whether `DOM changed; detection rechecked` appears. The observer should end after at most 10 seconds.
3. Record the reported **state**, **valid count**, **invalid count**, and short **reason code**. Expected state for one matching visible control is `candidate; valid=1`. `missing`, `invalid`, `ambiguous`, `unsupported-page`, or `error` need investigation; do not infer a safe click target from them.
4. Inspect the page DOM around the displayed control. Confirm it is a visible `a` element with `DOWNLOAD` text, classes `link-button text-5xl gay-button`, `hx-post` shaped `/f/<FILE_ID>/go`, `hx-swap="none"`, `rel="noopener"`, and no `href`. Confirm the page ID and POST ID match, and note nearby ad controls without clicking them. Redact the ID in shared evidence.
5. Before any manual click, confirm the extension has not opened a tab, sent a request, or started a download. Check both the page Network panel and `chrome://downloads` if needed.

## Observe manual clicks on each file

1. If the detector reports exactly one candidate and the page allows it, manually click the genuine control **once**. Record whether an ad tab or popup appears, whether Chrome blocks it, whether the original page changes, and any htmx Fetch/XHR request. Do not open, close, or interact with an ad tab as part of the extension test. If a CAPTCHA, access-control prompt, or security warning appears, stop and record that state.
2. Record only sanitized request facts: method, whether the request targets the same origin, whether the path has `/f/<FILE_ID>/go` shape, response status class, and whether page DOM changes. Do not save request bodies, response bodies, cookies, tokens, or full URLs.
3. If continuing is authorized and you are willing to start a real download, manually click the same genuine control **a second time**. Record any new tab, original-page change, htmx request, and whether Chrome shows a download in `chrome://downloads`. Note whether it starts reliably; do not equate a page message with a browser download event.
4. Repeat the same steps with File B. Do not assume the two files behave alike. If the second click was skipped, record that explicitly.

## Evidence record for File A and File B

| Item | File A | File B |
| --- | --- | --- |
| Exact HTTPS hostname and page shape verified (no full URL) | NOT TESTED | NOT TESTED |
| Chrome extension card, worker, and popup error status | NOT TESTED | NOT TESTED |
| Initial and final detection state, valid/invalid counts | NOT TESTED | NOT TESTED |
| Observed DOM attributes and nearby ad controls | NOT TESTED | NOT TESTED |
| First manual click: ad/tab/popup behavior | NOT TESTED | NOT TESTED |
| First manual click: htmx method, path shape, status class | NOT TESTED | NOT TESTED |
| Second manual click: tab/page/network behavior | NOT TESTED | NOT TESTED |
| Real browser download started and stayed started | NOT TESTED | NOT TESTED |
| Original page unchanged or changed after each click | NOT TESTED | NOT TESTED |
| Evidence of a required real user gesture | NOT TESTED | NOT TESTED |

## Phase 3 decision gate

Before selecting any automation method, obtain real Chrome detector output and the first-click, second-click, network, popup, page-change, user-activation, and download results for **both** files. Verify whether the observed two-click claim is true and whether the genuine control remains stable between clicks. Stop the design if ads, access controls, CAPTCHA, or browser gesture restrictions make safe automation uncertain. A synthetic click must not be treated as equivalent to a manual click without browser evidence.
