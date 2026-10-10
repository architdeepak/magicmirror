# Photo garment shoulder caps and shared vertices

## Changes and review

The fixed joint-based photo fit still exposed the tops of the wearer's shoulders. The outer shoulder row now receives an additional lift of at most 2.5% of projected torso length, following the torso axis and tapering to zero at the hem. A quadratic transverse shape preserves the center neckline. Body and sleeve vertices continue to meet at exactly the same UV/XYZ roots.

The first 6% prototype was rejected because the shoulders became too square: [rejected comparison](media/shoulder-fit-rejected.png). The smaller version improves the reviewed shoulder coverage without that large rise. This remains an estimated display fit, not anatomical measurement or cloth simulation.

Matched baseline `001ff6a` and current canvas images use identical saved camera/pose/world/mask/fit inputs: [frontal](media/shoulder-fit-1.png), [profile](media/shoulder-fit-6.png), [turned](media/shoulder-fit-12.png). Three visible cases retain 448 triangles and projected wrist centers; the fourth clears in both versions. Detailed masks are absent from three stored inputs, so no universal mask-based correction is claimed.

A ten-case [short/long pose sheet](media/shoulder-pose-matrix.png) covers down/raised/crossed arms, lean and one missing arm with actual public garment photos on explicit synthetic landmarks. Finite coordinates, shared seams, limb ownership, partial behavior and triangle counts pass. Manual sheet review still shows stretched texture, sharp underarm folds and a small dangling source fragment on the long shirt. The lift does not solve these defects, exposed hems, side/back continuity or broad garment support.

## Construction efficiency

The photo grid now maps each grid point once and shares it between neighboring triangles. No mesh triangles were added or removed. The same shoulder source with old versus new grid mapping produces exactly equal serialized vertices and triangle order on the frozen inputs; foreground limb ownership also matches.

In three usable long-shirt cases, distinct mapped vertex objects fall from 896 to 292. A shared-host Node VM geometry-only probe alternates order over twelve batches of one hundred builds per variant, after warmup. Median build time is approximately 1.44–1.45 ms before and 0.55–0.56 ms after. This excludes tracking, raster completion, screen presentation and power; it is not a whole-app speedup or Windows qualification. [Detailed construction report](PHOTO-GRID-VERIFICATION.json).

## Runtime evidence

- Full `npm test` passed, including new shoulder-axis/neckline/hem and shared-grid invariants.
- Four identical-input Electron canvas replays passed: [matched report](SHOULDER-MATCHED-VERIFICATION.json).
- Ten actual software Electron canvas photo/pose cases passed: [pose report](SHOULDER-POSE-VERIFICATION.json).
- Packaged DOM upload/cutout, native save with exact original bytes, wardrobe voice callback, synthetic camera stream, full/partial/recovered sleeves and ended-camera clearing passed: [wardrobe report](SHOULDER-WARDROBE-VERIFICATION.json). Pose/mask observations are fixtures; this does not prove acoustic command recognition or physical camera fit.
- Final source recorded-motion replay uses actual bundled offline tracking workers. Fit is visible on 570/611 tracked display ticks (93.3%); blank/camera-off clear. Maximum heartbeat gap is 112.5 ms. The replay includes screenshot work and a shared host, and is not a controlled FPS or before/after performance comparison. [Motion report](SHOULDER-MOTION-VERIFICATION.json). Existing saved comparison inputs were preserved by the new output label.
- Eight final-package NVIDIA combined camera/AR/portrait-or-rig/speech/Stop/mute/camera-off/sleep phases passed. The local speech model predicts during playback and returns idle after interruption; camera-off stops pose messages, sleep adds no drawing frames. Whole-process CPU is 116.5–148.1% of one core in these active phases, 17.0% camera-off and 8.6% sleep with harness instrumentation. Shared-host phase figures are not a controlled before/after power comparison. [Combined report](SHOULDER-COMBINED-VERIFICATION.json).
- Build archive `0265262ff213ed6019d597959f5b95fadb0bb2b8fb61a892908dc60b2e5d8b24`; packaged photo-sleeve source equals current source. [Build record](SHOULDER-FIT-BUILD.json).

Reproduction:

```sh
MIRROR_TORSO_BASELINE=001ff6a xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-torso-coverage-replay.cjs
xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-photo-shoulders.cjs
node tools/check-photo-grid.cjs
xvfb-run -a node tools/check-long-photo-wardrobe.cjs
MIRROR_MOTION_GARMENT=long MIRROR_MOTION_LABEL=shoulder-grid-motion xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-photo-fit-motion.cjs
```

Research fixture photos/video and frozen input files remain local artifacts; they are not bundled application content. The packaged wardrobe checker now copies an immutable app and waits for a marked fresh document after reload, avoiding checks against the old document.

All master gates remain open. Next work includes underarm texture/shape, side/back and profile behavior, broader garment layouts and physical camera/Windows validation.
