# Canceled photo startup cannot open a late camera

Full-suite status: incomplete. This advances interaction/resource ownership portions of G1, G3 and G7.

## Reproduced failure and fix

Stopping a photo capture correctly invalidated its draft work, but its `ensureCamera()` call continued independently. In the actual packaged baseline, delayed permission completed after Stop, hard mute or closing the editor; all three cases left the camera active with one live track while the editor reported that photo work had stopped.

Photo capture now passes its existing abort signal through the renderer to camera startup. A canceled startup invalidates only its own camera generation. Late permission/capture streams are stopped; a pending video play is retired; an obsolete request cannot stop a newer camera. The abort listener is removed when startup settles. A camera already active before capture remains available for local AR; explicit Camera off still releases it.

This does not cancel a browser permission prompt itself. `getUserMedia` has no signal in this implementation: its eventual returned tracks are released and cannot become the active camera.

## Verification

- [Independent three-case baseline](PHOTO-CAMERA-BEFORE.json): archive `5f7d044da5ee834ceb3e739732ece30999adbfe3433fd5c6d063004da1a42904`, Stop/mute/close each leave one live track and active camera after delayed permission. Expected failure saved.
- [Final actual packaged camera cases](PHOTO-CAMERA-AFTER.json): archive `6bf506ffae5c1acfa51f79d6f33c7fd2a194537a9dc80684922a15745f3fee3d`, all three leave zero live tracks, no active camera and no queued acquisition. Stop/mute retain the editor/draft; close closes it. Existing-camera control preserves the same stream, then explicit off releases its tracks.
- Full `npm test` passes. Camera units cover pre-abort, permission probe/acquisition/video-play cancellation, older-owner isolation, settled listener retirement and original model/permission/disconnect races. Photo units verify the signal reaches `ensureCamera`; existing draft/save/phone ownership tests remain covered.
- [Portrait UI audit](PHOTO-CAMERA-UI-VERIFICATION.json) passes four viewports/modes, accessible controls, typing isolation, two colored caption rows and editor Stop. Real Chromium input with denied sensors; not acoustic recognition or TV-distance proof.
- [Full wardrobe journey](PHOTO-CAMERA-WARDROBE-VERIFICATION.json) passes actual upload/cutout, native persistence/reload, front/back/original retention, phone HTTP ingestion, synthetic capture, interpreted voice/gesture actions, Stop/mute/caption controls and camera off/restart.
- [Agent/media cancellation regression](PHOTO-CAMERA-AGENT-VERIFICATION.json) covers actual renderer/IPC/browser HTTP cancellation, synthetic Codex stdio/delayed screenshots, replacement-task ownership, paired HTTP/native AVTransport handoff and decoded local VP8 media. It does not qualify a real model, physical phone, Spotify account or Windows app.
- [Exact source/tool/test hashes](PHOTO-CAMERA-BUILD.json). All three changed runtime files were extracted from the final archive and compared with source before runtime checks.

Reproduce: `npm test`, `npm run pack`, `xvfb-run -a node tools/check-photo-camera-cancel.cjs`; then `tools/check-adversarial-ui.cjs`, `tools/check-wardrobe-ui.cjs` and `tools/check-codex-lifecycle.cjs` using the same runner. For baseline collection, set `MIRROR_PHOTO_CANCEL_BUILD` to a frozen earlier unpacked build and `MIRROR_PHOTO_CANCEL_BASELINE=true`.

The first baseline fixture combined Stop with mute. It is superseded by the saved independent hard-mute case; only that corrected baseline is used in the comparison.

## Remaining work

Physical permission/device behavior, microphone/speaker interruption, natural voice quality, broad autonomous tasks and final Windows installation remain open. This targeted cancellation fix does not establish completion of any full master gate. The running camera monitor owns the previous `5fc96b7` archive, not this change.
