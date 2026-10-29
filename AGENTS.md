# Project conventions

## Scope and structure

- Build a Chrome Manifest V3 extension with vanilla JavaScript, HTML, and CSS. Avoid build tooling unless a later phase needs it.
- Keep responsibilities separate: `src/hosts/` for host-specific detection, `src/content/` for page interaction, `src/background/` for download monitoring and worker coordination, and `src/popup/` for the user interface.
- Phase 3 permits one automatic click on a verified control per file page when the user has explicitly enabled Auto Download. Keep the preference OFF by default, revalidate before clicking, and never synthesize a second click or retry after an unconfirmed download.
- Support FuckingFast only. Users open individual file pages themselves.

## Safety and privacy

- Use only narrowly scoped FuckingFast page matches. Add Chrome permissions only when a feature requires them.
- Never guess production selectors or infer a download target from ad-like elements. Require inspected real-page evidence before activating a control.
- Do not click advertisements, popups, redirects, or controls outside a verified download flow.
- Do not bypass CAPTCHAs, access controls, countdowns, or browser security checks. Wait for ordinary page behavior where appropriate.
- Bound retries and prevent duplicate activation and duplicate download handling.
- Never collect browsing history, transmit user data, or add analytics.

## Testing standards

- Run JSON validation and JavaScript syntax checks after changes.
- Test host detection and interaction logic against local mock HTML fixtures before testing on a real page.
- Record the real-page URL shape, relevant sanitized HTML, button states, timing, and resulting browser download behavior before writing production selectors. Do not include tokens, personal data, or download URLs in fixtures or logs.
- Verify popup state persistence, duplicate prevention, and download confirmation in Chrome before release.
- Keep manual test instructions and known limitations in `README.md`.
