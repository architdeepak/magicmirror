# Local camera and photo clarity

Implemented on `codex/local-ar-wardrobe`. No per-frame API or generated image details.

## Controls

- Settings → Camera clarity: Original, Natural, Bright. Original is the default and bypasses processing for lowest power. The setting persists.
- Say “brighten the camera”, “camera clarity natural”, or “camera clarity off”. These are local navigation commands; they also work through Command Center.
- Add garment → Photo clarity applies to camera captures, uploads and phone photos. Say “enhance photo”, “brighten photo”, or “original photo”. Front/back settings remain independent while reviewing.
- Original garment photos remain stored. Preview changes always start from the original cutout, so repeated enhancement is not cumulative. Restore photo also resets clarity.

Natural uses gentle tonal correction and bounded luminance sharpening. Bright lifts shadows and can alter apparent clothing colors. Neither setting reconstructs lost detail, removes motion blur or provides generative super-resolution. Transparent margins retain alpha and do not create dark-edge sharpening halos.

## Rendering and power

Live garment fit enhances the exact analyzed camera bitmap without modifying the tracker input, segmentation or garment extraction source. Processing runs once per new bitmap, bounded at 960×720, with no full-TV-resolution pixel processing. Restricted/failed sources fall back to the original. With no synchronized garment camera layer, the live video uses inexpensive browser brightness/color filters; that path does not apply pixel sharpening.

The recorded 640×360 Electron check measured 3.8 ms median and 13.4 ms 95th percentile per processed frame. In the 20-second recorded movement check, sampled enhancement work was approximately 9.3–11 ms at the bounded analysis-frame size. Fit appeared on 535/573 display ticks (93%); blank-camera and stopped-camera checks cleared it. The maximum heartbeat gap was 115 ms, so this does not certify zero-stutter operation. Physical camera quality, portrait crop detail, actual glass appearance and Windows power remain untested.

The existing two-hour monitor continues against its frozen `5d479ab` build. It is not measuring this clarity update. At minute 25 it had zero errors, but active portal CPU was around 103% of one core and earlier try-on samples around 126–128%. Power efficiency is still unfinished; these are process-tree CPU samples, not watts.

## Cloth and avatar improvements

Bundled starter SVG clothing now rasterizes at 1024 instead of 512 before fitting. High-quality sampling is restored after canvas resizing for both clothing and heads. The sleeve canvas check verified finite down/raised/crossed geometry using the doubled starter raster.

Avatar mouth blends follow speech level, and eyelids/fallback mouths share the head transform so they move with turns and lean. Production screenshots of all three hosts at rest and explicit AA poses were reviewed. These remain stylized raster performers, not photorealistic 3D rigs. Clothing still uses an articulated AR surface with contour occlusion, not measured sizing or simulated fabric drape. Replay screenshots show remaining shape and coverage limitations.

## Apple browser access

Signing in to a browser is possible. The mirror's managed Chromium browser already has a persistent session and screen/input tools; actual Apple account sign-in has not been tested. Users enter credentials directly.

Apple's web Find Devices can locate owned devices and participating Family Sharing devices. It does not expose friends' People locations. Apple's native Mac Find My has People; iCloud for Windows documents no equivalent People app. Browser control cannot reveal a page Apple does not provide. A Mac bridge remains a possible future integration; none is installed or verified here.

- [Apple: locate devices on iCloud.com](https://support.apple.com/en-asia/guide/icloud/mmfc0f2442/1.0/icloud/1.0)
- [Apple: locate a friend on Mac](https://support.apple.com/en-gb/guide/findmy-mac/fmmb20f3d01a/mac)
- [Apple: iCloud features on Windows](https://support.apple.com/en-gb/guide/icloud/mm6be2394337/icloud)

## Evidence

`CAMERA-CLARITY-VERIFICATION.json` records the source-preservation benchmark, movement samples, wardrobe ingestion checks and avatar pose checks. Local visual artifacts are under `artifacts/camera-clarity`, `artifacts/photo-fit-motion`, `artifacts/wardrobe`, and `artifacts/power-ui/personas`; original research imagery is not redistributed in Git.

Checks: full `npm test`; actual Electron camera clarity and sleeve rendering; packaged wardrobe ingestion with photo enhancement and exact original restoration; production avatar pose screenshots; packaged four-viewport UI audit including real keyboard selection and typed local camera commands.
