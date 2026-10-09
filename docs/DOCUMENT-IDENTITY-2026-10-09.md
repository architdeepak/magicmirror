# Legitimate actions on a newly observed document

## Failure and change

The repeated-activation guard remembered only click coordinates. It therefore rejected a legitimate same-position click on a new page, even after observing that page. A new agent-tools unit case reproduces the failure on the previous source.

Managed-browser screenshots now carry an opaque document identity based on web-contents identity plus its main-frame navigation revision. Ordinary screenshot capture keeps this identity stable; new main-frame documents/history transitions change it. Both Codex and live-voice tool adapters retain the observed identity with the last activation. A fresh, known different document permits another same-coordinate activation. Same-document or missing identity retains the duplicate guard. One-use snapshots, navigation invalidation, coordinate validation, cancellation and visible-result checks remain enforced.

For native Windows screenshots, a browser identity is attached only when the managed browser is focused and its native window handle matches the inspected foreground window. A background browser or focus flag alone cannot grant a native application a new document identity. Arbitrary native apps retain the existing conservative behavior; actual Windows validation remains open.

## Verification

- Full `npm test`, agent/voice/desktop unit cases, packaging and whitespace checks pass. Cases include changed/same/missing identity, stable identity through capture, native foreground mismatch/match, Stop/late capture, one-use snapshots and repeated double-click protection.
- [Final packaged Chromium/agent-tools cases](DOCUMENT-IDENTITY-UI-2026-10-09.json): six cases. Same-URL reload/history still reject stale snapshots; hidden subframe navigation retains valid input; fresh snapshots are single-use. The agent path blocks same-document repetition, accepts fresh same-position input after reload, then blocks repetition on that new document. This exercises real screenshot/native IPC input, not mocked clicks.
- [Installed Codex two-page journey](DOCUMENT-IDENTITY-CODEX-2026-10-09.json): **eight tool calls**, exactly one BEGIN click followed by one CONTINUE click at the same page position on a newly observed document; the randomized `OPAL 718` result was read from the screen. No tool errors. [Result display](media/document-identity-codex.jpg). Local synthetic pages; no production account or Windows input proof.
- [Final archive/source/tool hashes](DOCUMENT-IDENTITY-BUILD-2026-10-09.json). Archive `2fb7111929331fe7b123bf1d24781551630e59d36899aea030450f59989abd6c`.

## Resource ownership and remaining work

No new polling, observer loop, worker or growing history is added. The browser holds one numeric revision; each adapter retains one observation and one last activation. Identity is context metadata, not authorization or proof that a requested target was reached. Models must still inspect the result and respect task ownership.

DOM-only changes without navigation, arbitrary native application transitions, broader tasks/account recovery, and final Windows/TV behavior remain open. The conservative native-app guard may still need a verified user-intent route for legitimate repeated controls. G4 remains open.

The earlier frozen utterance-camera/speech cohort finished with **579 samples and zero recorded errors**; [final record](UTTERANCE-CAMERA-MONITOR-FINAL.json). It predates lip-contact and navigation/identity changes, so it does not qualify this build or the full release.
