# Long-photo underarm source seams

## Reproduction and correction

The plaid long shirt's raised/leaning pose had a dangling fabric fragment beside the torso. Source inspection found the lower-body median used as its upper torso edge crossed a separate sleeve run at the underarm. The old right seam was source x=352; the actual central body ended at x=332 and a detached sleeve began at x=341. A torso triangle therefore sampled sleeve pixels.

The shared body/sleeve root now uses the central body edge from the exact underarm source row. Up to five bounded lower-body contour samples map the existing torso rows toward the lower-body source edge. Scans happen once at texture preparation; no extra mesh triangles, workers, per-frame pixel readbacks or animation timers were added. The center neckline, projected wrist cuffs, shared UV/XYZ roots and foreground-limb ownership retain their previous contracts. The image originals are unchanged.

[Before source seam](media/underarm-source-before.png) · [corrected source seam](media/underarm-source-after.png) · [raised-arm comparison](media/underarm-plaid-raised.png).

The raised-arm comparison removes the visible plaid fragment and improves the shared underarm region. The fabric still stretches and has sharp folds. Frozen camera inputs still expose original clothing at hips and in turns; this is not a drape/sizing realism qualification.

## Adversarial diagnostic

The corpus checker recolors only opaque runs separated from the central body by the same gap/minimum-width thresholds used in long-sleeve inference, then rasterizes only the torso on explicit synthetic landmarks. This reveals unintended sampling from detached source islands.

Across 36 prepared author garment photos, 11 retain their accepted long-sleeve classification. Their total diagnostic pixels fall from 777 to 40. The plaid shirt falls from 271 to zero. Ten accepted long photos have zero diagnostic pixels after the change; a light hoodie retains 40 versus 47 before. This remaining hoodie case is unresolved. These counts measure this diagnostic at its chosen projection; they are not physical fit scores, user accuracy or a guarantee for every garment. [Corpus report](UNDERARM-CONTAMINATION-VERIFICATION.json).

Two investigative approaches were rejected:

- The initial diagnostic counted every opaque pixel outside the continuous center run, including fabric separated by tiny alpha-cutout holes. Its 906→169 counts were not used as final detached-sleeve evidence; the threshold-consistent diagnostic above replaces them.
- Clipping outer chart edges while keeping internal expansion did not reduce that residue. The extra drawing logic was removed; production retains its existing raster seam handling.

## Validation and limits

- Full `npm test` passed. New synthetic asymmetric/flared lower-body assertions keep the root at the actual underarm edge and retain bounded lower-body samples. Existing finite geometry, neckline/lean/hem, shared seams, wrist cuffs, partial-arm tracking and vertex-reuse checks pass.
- Fifteen actual software Electron canvas comparisons use a short polo, plaid long shirt and light hoodie with down/raised/crossed arms, lean and partial tracking. Mesh counts, seams and foreground-limb ownership pass; the [full sheet](media/underarm-pose-matrix.png) was reviewed. [Pose report](UNDERARM-POSE-VERIFICATION.json).
- Four frozen camera/pose/world/mask inputs compare full baseline inference and photo geometry from `692b453` against current inference/geometry. Three remain visible; one clears in both. Counts and cuff bindings retain their contracts. [Matched report](UNDERARM-MATCHED-VERIFICATION.json): [frontal](media/underarm-matched-1.png), [profile](media/underarm-matched-6.png), [turned](media/underarm-matched-12.png).
- Packaged DOM upload/cutout, native save with exact original retention, wardrobe voice callback, synthetic camera stream, full/partial/recovered fit and camera-ended clearing pass. Pose/mask are fixtures, not physical capture or acoustic recognition. [Packaged report](UNDERARM-WARDROBE-VERIFICATION.json).
- Final actual offline-worker motion replay observes 573/610 visible tracking ticks (93.9%); blank/camera-off clear. Worst heartbeat gap is 101.9 ms. Screenshot work and a shared host are included; this is not presented FPS, a before/after benchmark or power qualification. [Motion report](UNDERARM-MOTION-VERIFICATION.json).
- Current photo/long-photo source equals the packaged source, archive `da69c7d73c427d05debf1538ac561457325c768c4ccf1e0b5fe5294021141291`. [Hashes/build record](UNDERARM-BUILD.json).

The comparison tools now freeze both baseline photo geometry and long-sleeve inference, and infer each version's pattern from the same prepared texture. Reusing the current inferred pattern for both versions would conceal the source-seam change, so that approach is not used.

Reproduction requires the existing local research photos, video and frozen inputs:

```sh
MIRROR_SOURCE_BASELINE=692b453 xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-photo-source-contour.cjs
xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-underarm-contamination.cjs
MIRROR_PHOTO_BASELINE=692b453 MIRROR_PHOTO_FILES=lab_06_white_bg.jpg,lab_08_white_bg.jpg,jin_01_white_bg.jpg xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-photo-shoulders.cjs
MIRROR_TORSO_BASELINE=692b453 xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-torso-coverage-replay.cjs
xvfb-run -a node tools/check-long-photo-wardrobe.cjs
MIRROR_MOTION_GARMENT=long MIRROR_MOTION_LABEL=underarm-motion xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-photo-fit-motion.cjs
```

The existing monitor remains on immutable `692b453`/archive `026526…8b24`, with microphone/cloud/camera/Internet media off. It does not validate this newer source seam. All master gates remain open; continue the hoodie residue, broader silhouettes/side/back coverage, real camera fit, active efficiency and Windows qualification.
