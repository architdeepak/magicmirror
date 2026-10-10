# Owned lookbook camera startup — 2026-10-09

Lookbook preparation previously started the camera without the capture's cancellation signal. The corrected packaged baseline on frozen source `c14aa05`, archive `5c78a0c7931b7b0f30b0c73b669cbd096afaa9a4456553f10194e39f9e09b85b`, reproduces **active camera and one live track after both Stop and hard mute** when permission arrives late.

Look capture now owns an AbortController and races preparation against cancellation. Preparation checks the signal after desktop closure and forwards it to the existing generation-checked camera startup. Cancelling clears the countdown immediately and releases the capture caller without waiting for permission. Late tracks are discarded by camera ownership. Successful/pre-existing cameras retain their existing lifecycle.

Explicit camera off cancels an in-progress look capture or wardrobe-camera capture before releasing the camera. This applies to the shared agent/voice callback and the UI off handler. Reviewed drafts and unrelated saving/upload operations are not cleared by these guards.

## Exact-build evidence

Final archive `bd2e5a4fad1aded5f0c61938d237fa9c843d73c077a3c0d4ef3ae172de8b5d88`; embedded capture sources match. [Baseline/final, wardrobe regression and source hashes](LOOK-CAMERA-CANCELLATION-VERIFICATION.json).

- Actual packaged lookbook Stop, hard mute and explicit-off callback cases each show inactive camera, zero live tracks, no pending requests after permission release, cleared countdown and completed capture promise.
- Production-class unit test cancels preparation before its promise resolves, confirms an aborted signal and immediate completion, and preserves its reviewed draft.
- Existing packaged wardrobe-photo Stop/mute/close/startup and pre-existing-camera preservation regression passes. Full tests pass.

The first verifier omitted selecting a garment and timed out before reaching permission; that attempt is excluded. The corrected baseline selects a starter garment first. Its Stop/mute cases use the monitor's immutable older application copy; the monitor process and files are not modified. Explicit-off is covered in the final package using the shared callback, not by treating a pending-camera toggle as an off command.

Reproduce after packing: `xvfb-run -a node tools/check-look-camera-cancel.cjs`. Tests use deferred permission and real canvas tracks, not a physical camera. No photo is saved during these cancelled cases.

Physical image quality, pose/camera-disconnection combinations, complete draft/save interactions and all G1–G8 gates remain open. The ongoing camera/AR monitor freezes older `c14aa05` and does not exercise lookbook startup.
