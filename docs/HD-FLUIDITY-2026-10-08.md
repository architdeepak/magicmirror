# HD and fluidity — 2026-10-08

## Changes

- Settings and local voice-command dispatch now offer Efficient, Balanced and Maximum detail. Try “set maximum detail,” “set balanced quality,” or “set efficient quality.” The preference persists and is visible to the assistant. Acoustic recognition of every new phrase was not separately tested.
- The Queen preserves her original 1215 × 1295 artwork proportions through facial features, mouth patches, glow and the depth scene. Head, gaze and speech movement use elapsed-time smoothing, so 30 and 60 Hz produce equivalent easing.
- Avatar backing surfaces respect device pixel ratio with explicit pixel caps. Maximum detail caps the avatar at 4 million pixels and the AR canvas at 6 million pixels. These are rendering budgets, not new source detail.
- Accelerated wake/arrival uses layered shader smoke with advected noise, depth-dependent light and transmittance. It draws directly to its own WebGL canvas, without per-frame pixel readback. Smoke is transient; Stop cancels it. Context loss or initialization failure falls back to the CPU field. Reduced motion avoids the smoke loop.
- Maximum detail targets 60 Hz on accelerated systems; Efficient and software graphics use lower budgets. AR remains 30 Hz. CPU smoke fields are 160 × 240, 240 × 360 and 320 × 480 by preset; GPU smoke is capped at 0.8, 1.5 and 4 million pixels. Software background rendering has a separate 2 million pixel budget.
- Maximum detail requests a 3840 × 2160 camera stream when supported. The camera label reports the negotiated resolution. Tracking analyzes a smaller copy of the same retained camera frame and returns the original for display, avoiding both a 720p display bottleneck and mixing frames with stale pose data. HD clarity preserves the original instead of downsampling it for CPU sharpening. Existing tone adjustment remains available.
- Camera quality changes apply only to an already active stream. Requests are serialized, obsolete requests are skipped, and unsupported constraints leave the existing stream available. Camera activation still belongs to its existing controls.

## Local evidence

See [verification](HD-FLUIDITY-VERIFICATION.json), [portrait](media/mirror-hd-portrait.jpg), [smoke](media/mirror-hd-smoke.jpg) and [preview movie](media/mirror-hd-awakens.mp4).

The full unit regression covers bounded 4K/DPR surfaces, native image proportions, 30/60 Hz easing, original-frame ownership, reduced motion and rendering budgets. Packaged checks cover quality persistence, high-DPR layout, shader compilation/rendering, forced context loss, Stop, multiple viewport layouts and idle/sleep behavior. The shader fixture explicitly enables the GPU path on software GL; it does not establish physical GPU acceleration.

The real packaged voice journey passed using recorded audio through a MediaStream: conversation, captions, timer tool, Stop, wake and hard mute. Stop took about 1.22 seconds from phrase onset and 6.3 ms after local recognition; output RMS reached zero. Physical acoustic echo is not covered.

The 1080 × 1920 movie exports 288 deterministic frames at 60 fps using the production shader and a posed emergence host. This is an offline visual preview. Actual screenshot capture took about 23 seconds for 60 frames; capture timing is retained in the verification record. It is not evidence of live 60 fps. Earlier high-DPR PNG capture disconnected the CDP socket; JPEG capture passed. The exact cause is unproved.

Sleep and synthetic hidden/stopped fixtures rendered zero frames. Settled facial poses reused their raster. A software-rendered dynamic depth sample consumed about 68% of one CPU core and managed approximately 10.4 scene fps under concurrent audit load. Maximum detail can be costly; smooth physical PC-stick performance remains to be measured. Device-wide GPU readings include other workloads and cannot establish this application's power use.

## Next realism work

The performer is still textured front-facing artwork, with localized feature deformation. A proper 3D facial rig, articulated eyes and phoneme shapes would improve side turns, expression and lighting. The camera needs real resolution, good lighting and low motion blur; rendering at a larger size cannot recover missing optical detail. Wardrobe remains photographic/articulated AR rather than physically simulated fabric. Windows installation, the portrait TV, physical camera/gesture inputs and actual accelerated rendering still need hardware validation. Passing local checks does not imply aesthetic approval or completion of the suite goal.

Previous monitors retain immutable copies of earlier builds; their results are not evidence for this revision. A new isolated two-hour monitor started at 2026-10-08T23:56:13Z for commit `22fa19b`. Its archive hash matches the audited package. At the saved snapshot it was running with 3 samples and zero errors. This is an ongoing run, not a completed stability result; its log is `artifacts/monitor-hd-fluidity.log`. Voice, camera and cloud accounts are off in this monitor.
