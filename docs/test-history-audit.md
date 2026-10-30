# Test-count audit for the proposed v1.0.0 candidate

The changing totals reflect different source snapshots and a substantial test-runner replacement. They do not show that the same fixed suite repeatedly changed its result. Current registered/executed/passed/failed/skipped totals must come from the final Phase 6 runner output.

## Reachable Git snapshots

| Revision | Registered test cases identifiable in the source | Scope |
| --- | ---: | --- |
| `26e5877` | 10 | Initial read-only host adapter and observer fixtures. |
| `5b73a7a` | 43 | URL/DOM detection, observer, single-click MVP, controller lifecycle/download events, popup. |
| `6d7838b` | 63 | Earlier coverage plus FIFO and queue timing regressions. |
| `79ed9d1` | 8 | Reduced independent-tab suite; six `test()` call sites expand to eight cases because a loop registers 3-, 10-, and 16-tab scenarios. |

These are source-registration counts, not claims that historical code was rerun during Phase 6. The old helper executed each case immediately, counted passes, and collected failure strings. It did not separately report registered, executed, or skipped counts. Counting textual `test()` occurrences also undercounts parameterized loops.

Commit `79ed9d1` replaced most of the runner (93 inserted lines, 920 removed lines in that file). Removing FIFO assertions was appropriate after independent-tab attempts replaced that architecture. The replacement also dropped useful host-spoofing, URL-form, DOM-attribute, observer cleanup, timeout, and lifecycle/error regression coverage. A green eight-test result therefore represented a smaller coverage set.

## Development-session totals

- The reported 11-test suite followed the eight-case independent-tab baseline plus three popup cases. Those popup tests were initially nested within a click-engine test and were subsequently made independent.
- The 28-test and 35-test reports came from later uncommitted UI/icon/status expansions in this workspace. Phase 5.3's final report recorded 35 passing cases.
- An 80-test snapshot is not present in reachable Git history. Its exact registered/executed/skipped breakdown cannot be reconstructed from an earlier session's total alone. It must not be presented as the current suite size.

## Restored detection coverage

Phase 6 adds 22 independently registered cases in `tests/browser/detection-tests.js`. They cover exact host restrictions; credentials, ports and lookalikes; file routes, optional query/fragment forms and matching POST IDs; unverified control attributes and destinations; missing/ambiguous/hidden/disabled/ad controls; filename evidence; dynamic insertion; debouncing; and observer timeout/manual cleanup.

Obsolete FIFO behavior is not restored. Current independent-tab, controller lifecycle, popup, and icon cases remain part of the final suite. The release validation report records the final complete execution totals.
