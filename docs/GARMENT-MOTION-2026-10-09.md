# Mirrored garment photos, foreground limbs and sleeve continuity

October 9, 2026. Full suite remains incomplete: [master goal](MASTER-GOAL.md). [Verification](GARMENT-MOTION-VERIFICATION.json).

## Findings and implementation

The camera is mirrored, but garment photos previously kept their ordinary left/right image orientation. Logos and asymmetric sides consequently did not behave like a mirror. Personal front/back textures now flip once at load, before crop/silhouette/cuff inference. The stored originals and editor photos remain unchanged. This aligns the texture and its inferred silhouette with the displayed camera without adding per-frame image processing.

Foreground occlusion previously decided an entire forearm from wrist depth and required a visible elbow even for hands. It could erase a behind-torso section or hide a visible hand. Missing shoulders could also invalidate depth/width calculations for lower-body fits. Shared logic now selects finite, visible torso depth landmarks, uses hips when needed for width, clips foreground segments where they cross the estimated torso plane and treats hands independently from elbows. Detailed skin masks and the simpler fallback use the same decisions. Long sleeves keep forearms covered while allowing foreground hands.

A separate sleeve defect came from normalizing a linear blend of opposing directions: the blend can reach zero, collapsing the cloth row. Photo and starter sleeves now rotate a unit cross-section between endpoints. A small per-arm angle history unwraps tracked directions across ±π to prevent a half-turn pop. It updates only during existing mesh construction; it adds no animation clock, worker or render pass. Hidden/lost/disabled clears remove entries from the existing object; actual repaint retains them. Body/sleeve UV roots retain their sewn coordinates.

## Verification

- Focused tests cover front/behind/crossing depth, hands with hidden elbows, covered forearms, missing/flat shoulders, hip width fallback and invalid depth.
- Actual Electron canvas pixel checks through GarmentOverlay.select verify front and back mirror once, original colors remain unchanged, foreground pixels erase and behind-torso pixels remain opaque. Both detailed and fallback paths preserve a visible hand without an elbow.
- Opposing/near-opposing normal tests preserve unit width; temporal ±π tests preserve continuity with bounded history. Photo/starter geometry tests retain finite vertices and shared root seams for raised/crossed/folded poses. Cache tests verify history cleanup and existing settled/hidden raster budgets.
- The broad packaged wardrobe journey passed with real upload/save/reload, paired front/back render fixtures, local extraction, voice/interpreted gesture commands, captions, Stop/mute and phone rejection cases.
- The recorded public motion replay runs through actual bundled pose/segmentation workers offline. It validates finite local fit, world-pose use and blank-frame/camera-off clearing. Final replay: 556 of 613 tracking display ticks visible (90.7%), worst heartbeat gap 102.8 ms. These timings include capture work and an overlapping packaged audit on a shared host; they are not an isolated performance improvement, presented FPS or a responsiveness qualification.

The replay tool now saves four camera projections with exact pose, world pose, mask, fit and angular state snapshots under artifacts/photo-fit-motion. Copies of landmarks/history are captured before the next frame can change them. These support future comparisons against identical input. Large raw snapshots stay local; the saved verification records their hashes.

Final archive: `2ee621673b7646f4071ee19c730d51a922c4a9adb983845e9df04f5f00092cf9`. The motion/pixel tools import source modules; the packaged audit tests the installed app. Preserve their distinct scopes.

Review: [asymmetric texture and foreground pixels](media/wardrobe-mirror-occlusion-pixels.png), [recorded human motion](media/wardrobe-mirror-motion.png). The historical before replay and new replay reached different poses at their screenshot times; they are not a controlled visual before/after pair.

## Quality limits and next work

Visual review still shows a flat/stretching photographic shirt, incomplete coverage of the underlying clothes and inaccurate drape during turns/raised arms. These fixes do not pass the full realism gate. The torso plane is a landmark-depth estimate, not measured per-pixel depth. Segmentation confidence, multi-person overlap and physical top-camera calibration remain open.

Long personal garment photos still lack articulated sleeve reconstruction; they can fall back to torso projection. Next: use the frozen replay inputs and a garment/motion matrix to improve personal long sleeves, shoulder/cuff fit, profile/back transitions and occlusion. Continue combined camera/voice/media efficiency checks. No physical camera/phone/Windows or garment sizing/drape accuracy has been established.

## Monitor scope

The prior immutable software build e0c1126 finished its 30-minute mode/sleep cohort: 591 samples, zero recorded errors. It had camera/cloud/media off and does not validate this new garment code or qualify an eight-hour release candidate. The separate earlier eight-hour development cohort remains running on its own recorded source.
