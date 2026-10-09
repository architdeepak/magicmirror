# Agent camera controls with owned startup — 2026-10-09

The subscription agent now exposes `control_camera` with a required boolean `enabled`. It calls the existing local camera lifecycle and returns actual camera state/errors. It does not take/save a photo or switch on cloud sharing. Enabling an already active camera reuses it. Explicit off also stops live try-on/render work before releasing the camera.

Each pending camera tool call owns an AbortController. Stop/task cancellation or a newer camera command aborts startup through the existing generation-checked head-tracking signal. Cancelled/superseded results are rejected. After successful startup the signal listener is removed, so ending a task preserves the user's active camera until explicit off. Computer observations are invalidated by the camera command.

## Verification

Final package `7fd276ecb79218c06b652a97a203835c7d5d3029f765c5d9111eb67e0be38aaf`; embedded camera-tool sources match current source. [Saved real task, tracks, callbacks and source hashes](AGENT-CAMERA-VERIFICATION.json).

- Actual installed Codex turns a real local canvas MediaStream on, reads active state, turns it off and reads inactive state. Its verified final reply reports `camera.active=false` and `sharedWithAssistant=false`. All test streams are released and the completed progress banner is hidden.
- Packaged delayed permission/stream cases cover Stop at initial permission, Stop after the probe, hard mute after the probe and explicit off after the probe. Every case has zero pending requests after release, zero late live tracks, inactive camera and a cancelled result.
- Reusing a pre-existing camera does not restart it; Stop preserves that exact stream. Explicit off releases all its tracks. Actual permission denial returns inactive state and the permission error.
- Production tool tests cover strict boolean input, cancellation signal, superseding commands and preserving the newer controller. Full tests and the existing packaged photo-camera Stop/mute/close/existing-camera regression pass.

The first packaged attempt exposed an omitted forwarding field in the shared adapter constructor and timed out before requesting permission. The constructor was corrected, and the verifier now surfaces callback failures immediately; that first attempt is excluded from final evidence.

Reproduce after packing: `xvfb-run -a node tools/check-agent-camera.cjs`, using the installed authenticated Codex subscription. The script supplies real canvas tracks and deferred browser permission promises, not a physical camera.

## Remaining scope

Physical devices, accurate face/cloth tracking, acoustic commands, camera/photo/editor overlaps and broad autonomous interactions still need qualification. This proves the Codex control route; it does not add a direct Gemini camera function declaration. The live camera/AR monitor freezes older source `c14aa05`, predating this tool, and does not exercise Codex calls. All G1–G8 and physical Windows gates remain open.
