# Prepared GitHub release

**Proposed title:** v1.0.0 — release candidate

**Proposed tag:** v1.0.0

**Status:** Release notes for the v1.0.0 publication.

## Summary

FitGirl-FuckingFast Auto Downloader is an independent Chrome Manifest V3 extension for manually opened FuckingFast file pages. Enable automation to make one guarded click on each eligible page. Each tab/document works independently; a missing download confirmation in one tab does not hold up another.

## Features

- Exact HTTPS support for fuckingfast.co and evidence-based DOWNLOAD-control validation.
- OFF-by-default, persistent Enable/Disable control.
- One automatic click per eligible document with duplicate-attempt protection.
- Separate click-attempt and download-observation states, bounded confirmation, and manual fallback.
- Compact dark popup with a transparent Circle Arrow icon and neutral page-status messaging.
- No mass link opening, automatic second clicks, ad-tab interaction, CAPTCHA bypass, or broad host access.

## Installation

1. Download FitGirl-FuckingFast-Auto-Downloader-v1.0.0.zip from the release assets once approved and published.
2. Extract it to a persistent folder. manifest.json must be directly inside that folder.
3. Open chrome://extensions, enable Developer mode, and choose Load unpacked.
4. Select the extracted folder.
5. Open the popup, enable Auto Download, and manually open a supported file link.

To update an unpacked installation, replace its files, reload the extension card, and refresh existing file pages. The saved preference can persist across reloads.

## Validation status

- Automated checks: 82 registered, 82 executed, 82 passed, 0 failed, 0 skipped.
- The user reports that Chrome UI testing and automatic clicking across 6–7 independently opened file pages passed.
- The candidate ZIP contains only the manifest, runtime source files, and required icon assets, with manifest.json at its root.
- Loading the newly extracted candidate through Chrome's actual UI: **NOT TESTED**.
- Automated tests use local fixtures and mocks and never start real downloads.

## Known limitations

- FuckingFast only; users open each file page themselves.
- One automatic click per document; no automatic retry or second click.
- Some browser download events cannot be associated confidently because referrer or filename metadata is missing or ambiguous.
- Download confirmation is not guaranteed and does not prove synthetic-click causation. A file may download while the popup reports unconfirmed.
- Chrome user-activation rules, host markup changes, CAPTCHA, and access controls may require manual interaction.
- This is an independent, unofficial project, not affiliated with or endorsed by FitGirl Repacks or FuckingFast.
- No software license has been chosen; adding one requires owner approval.

## Candidate artifacts

- dist/FitGirl-FuckingFast-Auto-Downloader-v1.0.0.zip
- dist/package-validation.json
- CHANGELOG.md

## Publication checklist for the owner

The publication steps below are retained as a reproducible checklist.

1. Complete the extracted-ZIP Chrome UI load check and record its result.
2. Review the entire working tree and the final test, security, privacy, and package reports.
3. Run the candidate checks again from the approved tree:

       node tests/run.mjs
       node scripts/package.mjs
       git diff --check
       git status --short

4. Review and stage the approved files, then create the local commit. Do not use a blanket add without reviewing the existing uncommitted work:

       git add <reviewed-files>
       git commit -m "Prepare v1.0.0 release candidate"

5. Push the approved branch to the existing repository:

       git push origin main

   Use the actual reviewed branch if it is not main. Keep the repository's existing name.

6. In the repository's GitHub Releases page, choose Draft a new release. Use tag v1.0.0 at the reviewed commit, paste the proposed title and the Summary through Known limitations above, and upload the validated ZIP. Check that the asset matches the approved candidate.
7. Review the draft and make the final publishing decision. Chrome Web Store publication is a separate task.

If the owner prefers an explicitly marked prerelease tag, select that policy before creating the tag or release. The manifest version remains the proposed 1.0.0 candidate until the owner approves a different version.
