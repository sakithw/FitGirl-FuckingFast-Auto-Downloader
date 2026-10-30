# FitGirl-FuckingFast Auto Downloader v1.0.0

The first stable release of a Chrome Manifest V3 extension that makes one guarded click on verified DOWNLOAD controls on supported FuckingFast file pages.

## Highlights

- Independent one-click operation across multiple tabs and documents.
- OFF-by-default Enable/Disable control with persistent local preference.
- Compact dark popup with neutral, honest page and download states.
- Transparent Circle Arrow icon set.
- Conservative Chrome download-event monitoring and manual fallback.
- No global busy lock, FIFO confirmation queue, automatic second click, ad interaction, CAPTCHA bypass, or mass link opening.

## Installation

1. Download `FitGirl-FuckingFast-Auto-Downloader-v1.0.0.zip` and extract it.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the extracted folder containing `manifest.json`.
4. Open the popup, enable Auto Download, and manually open a supported file link.

## Limitations

Only the configured HTTPS `fuckingfast.co` host is supported. Users open individual file links themselves. Some downloads may remain unconfirmed when Chrome omits usable referrer or filename metadata; browser security prompts and user-activation requirements may still require manual action. This is an independent project and is not affiliated with FitGirl Repacks, FuckingFast, or the Chrome Web Store.
