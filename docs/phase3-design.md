# Phase 3 MVP design and remaining verification

The MVP now implements one guarded automatic click per verified page when explicitly enabled. It does not synthesize a second click, retry after an unconfirmed outcome, or interact with ad tabs. A real automatic click and browser download correlation have not yet been verified. The preconditions below remain relevant for extending the workflow.

## Before extending the MVP

- Complete a real automatic-click smoke test and inspect at least two more sanitized file pages, including the site's ad and countdown states.
- Manually observe what the first and second legitimate control activations do, including tab openings, htmx requests, DOM changes, and whether a browser download starts.
- Check current Chrome extension and user-activation rules before choosing an interaction method. A scripted sequence of two synthetic clicks must not be assumed equivalent to two real user clicks.

## MVP flow and future checks

1. Keep the user in control with a stored OFF-by-default setting and a per-page stop control.
2. Require the strict Phase 2 detector to return exactly one visible candidate for the current file ID. Revalidate immediately before any future activation.
3. Use a finite state machine with a bounded wait for a meaningful site change after an allowed interaction. Treat a new ad tab or popup as a stop condition, never as a target to close or interact with.
4. Stop on ambiguity, CAPTCHA, access-control prompts, unexpected navigation, errors, or any step that requires a real user gesture.
5. Prevent repeat requests and duplicate downloads with per-file and per-tab state. Reconcile that state with actual `chrome.downloads` events in Phase 4 before claiming success.

The current implementation uses a worker claim before clicking and matches download events only when a unique pending attempt has a matching page referrer in a short window. It stores only a hash of the page origin and path in session state. Missing or ambiguous correlation stays unconfirmed and offers manual fallback.
