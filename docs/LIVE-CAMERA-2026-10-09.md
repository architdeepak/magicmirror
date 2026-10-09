# Camera control in live voice tools — 2026-10-09

The live adapter now declares and handles `control_camera`, using the same local lifecycle callback as Codex. Boolean input is required. It returns actual state/errors and preserves the existing camera-sharing preference; it does not save a photo or turn sharing on.

A pending start owns an AbortController. Stop, microphone stop and disconnect abort it. The tool races the callback against cancellation so its queue is released before browser permission resolves; the underlying generation-checked camera code still releases a late stream. An explicit camera-off packet preempts the pending camera start before joining the serial tool queue. Successful startup retires the controller, preserving the active camera when speech stops. Duplicate camera commands retain deduplication and return freshly observed camera state instead of an old active flag.

## Exact-build verification

Final package `35a4755116cd58dd7432a625124f0f2ec98f2dda5958670c6d0265ce6118dcdb`; embedded adapter matches source. [Saved packet/stream results, installed Codex regression and source hashes](LIVE-CAMERA-VERIFICATION.json).

- Actual packaged `_handleMessage` parses live `toolCall` JSON and runs production queue/callbacks against real canvas tracks and deferred permission. Stop at permission, Stop after permission probe, hard mute after the probe and explicit off after the probe all finish with inactive camera, no pending requests after release and zero late live tracks.
- Explicit off returns a tool response before the delayed stream is released by the fixture. Cancelled startup emits no stale response. Later stream arrival remains inactive/released.
- Completed on/off preserve the camera through speech Stop, release it on explicit off and replay the duplicate on request with current `camera.active=false` without opening another stream.
- Unit cases cover Stop/playback, microphone stop/disconnect, immediate queue preemption, late callback rejection without extra response, completed-camera preservation, strict input and fresh duplicate state. Full tests pass.
- The actual installed Codex camera on/state/off task and delayed-start/existing-camera/permission-denial cases pass again on this same archive.

Reproduce after packing: `xvfb-run -a node tools/check-live-camera.cjs`; installed subscription regression: `xvfb-run -a node tools/check-agent-camera.cjs`.

## Scope

The live test injects parsed packets and connection flags and captures outgoing tool responses; it does not connect to a voice provider or recognize acoustic commands. Real-provider schema/voice behavior, physical camera/TV/Windows, editor overlaps and broad task reliability remain open. The active camera/AR monitor freezes older source `c14aa05` and does not invoke these live tools. All G1–G8 completion gates remain open.
