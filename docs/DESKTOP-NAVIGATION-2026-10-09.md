# Screen observations across managed navigation

## Failure and fix

Desktop actions previously compared the screenshot URL, display identity, dimensions and browser bounds. A reload or same-URL history transition can replace the document without changing any of those. The old packaged app actually accepted both stale screenshots and clicked the new page.

The managed browser now invalidates observations and aborts pending preparation when its main frame begins or commits navigation, including same-document history transitions. A retired browser cannot invalidate its successor. Subframe navigation does not invalidate the main document. There is no new polling loop or worker.

Event signatures were checked against the installed Electron declarations (`node_modules/electron/electron.d.ts`), including the structured `did-start-navigation` event and main-frame flag. The official web documentation fetch timed out; no web result was used as evidence.

## Verification

- New unit regression fails on the old source. Full `npm test`, native-source desktop tests, packaging and whitespace checks pass. Unit cases cover start/commit, main versus subframes, retired-window isolation, action abort, concurrent navigation/capture cancellation, DPI/display checks and one-use snapshots.
- [Real old-build result](DESKTOP-NAVIGATION-BEFORE-2026-10-09.json): both stale actions delivered, with new-page click counts increasing. This is a negative control, explicitly `passed:false`.
- [Real current-build result](DESKTOP-NAVIGATION-AFTER-2026-10-09.json): same-URL reload and same-URL `history.pushState` both reject the old screenshot; no clicks reach the changed page. Hidden iframe navigation retains valid main-page input. A fresh screenshot permits one real Chromium click; reuse fails. Inputs go through production IPC, not CDP input or injected callbacks. [Captured portrait display](media/desktop-navigation-display.jpg).
- [Actual installed Codex journey](DESKTOP-NAVIGATION-CODEX-2026-10-09.json): eight tool calls; screenshots → one FEATHER click → visible randomized `OPAL 944` result; no tool errors. Local page only, real subscription agent and production screenshot/input callbacks. The harness now isolates its app copy, records archive hash, and uses bounded profile-removal retries.
- [Exact archive/source/tool hashes](DESKTOP-NAVIGATION-BUILD-2026-10-09.json): final archive `5526020a5a4e377591c37789633cd773226582f7f5e3cf009434ced895fe8e14`. The negative-control archive is older, but its main-process source matches the immediate previous checkpoint byte-for-byte; recorded hashes establish this.

## Remaining work

Arbitrary DOM/layout mutations without navigation are not comprehensively detected by these events. Native Windows app state changes need their own final qualification. The current repeated-click guard can also reject legitimate same-coordinate activation after a newly observed document; audit and scope that guard to verified document identity next, preserving protection against blind repetition.

The real Codex test proves one visible-result journey, not broad task coverage, sign-in/account recovery or all requested app integrations. The Linux screenshot shows a managed window, not final Windows kiosk framing. G4 remains open. The running 30-minute recorded-camera/speech monitor is an older frozen build, separate from this navigation change.
