# Performance notes

Target hardware: fanless Apollo Lake stick (4 cores, 4 GB, HD 500) driving a
4K portrait TV. Everything below is measured with `npm run bench` on a
development laptop with CPU throttling, so treat it as a regression guard and
verify on the real device.

## Tiers (Settings → Picture and motion)
| Tier | Intended for | Fog field | Notes |
|---|---|---|---|
| Efficient (`eco`) | stick; auto-selected on first run when <=4 cores and <=4 GB | 450 K px, 3 slices, 20 fps | no backdrop blur, no looping decoration, 1.2 M px scene |
| Balanced (`auto`) | laptop/desktop | 1.6 M px, 4 slices | scene budget 4.5 M px |
| Maximum detail (`hd`) | strong GPU | 4 M px, 6 slices | |

## Lessons (keep these true)
- A full-screen `mix-blend-mode` layer or an animated large `box-shadow`
  forces a 4K repaint every frame: the wake cloud fell from 60 to 9 fps until
  both were removed. Prefer opacity/transform animations only.
- Animating `text-shadow` on text causes layout; don't.
- Face tracking runs at ~4 Hz in the ambient mirror and 30 Hz in
  conversation/try-on (`setTrackingAmbient`).
- Full-size canvases cost 33 MB each at 4K: every canvas must have a pixel
  budget (see `displayQuality.js`, `arOverlay.js`).
- The wake cloud is a GPU shader by default, CPU field as fallback
  (`mirror.cpu-smoke=true` forces it).

## Measuring
`npm run bench` (env `BENCH_THROTTLE=1,4,8`). Idle main-thread cost can be
sampled with the DevTools Performance panel; at ambient idle the JS thread is
~1% busy, the rest is native video/audio/compositing work.

## Target device facts (Azulle Access3, Celeron N3450)
- Quad core 1.1 GHz, 2.2 GHz burst, 6 W TDP; PassMark CPU about 2,200 (a modern laptop is
  more than ten times that).
- **No discrete GPU.** Intel HD Graphics 500: 12 execution units at 200-700 MHz, shared
  LPDDR3 (4 GB total). Roughly a tenth or less of a current laptop iGPU.
- HDMI 4K is **30 Hz** only; hardware decode for H.264/HEVC/VP9. Reviews report dropped
  frames when driving a Windows desktop at 4K and smooth behaviour at 1080p.
- 32 GB eMMC, Wi-Fi 5, Windows 10.

What follows from that:
- Set Windows output to **1920x1080** (the TV upscales); 4K compositing alone eats the GPU.
  The app shows a one-time hint on small PCs with a 4K output.
- Integrated HD 4xx/5xx and UHD 600/605 are detected from the WebGL renderer string and start
  the app in the Efficient tier (also the default for <=4 cores and <=4 GB).
- Keep 3D opt-in (it is off by default), CPU face tracking, and the Efficient fog.
- `npm run bench` throttles the CPU only; the laptop GPU is far stronger than the stick's,
  so frame-rate numbers from the laptop are optimistic. Treat them as regression guards and
  verify on the device.

## Idle CPU: the wake-word listener
Measured on a laptop with `Get-Process` CPU deltas (ambient mirror, camera released): the
always-on Vosk recogniser used about 45% of a core decoding silence (renderer 55% -> 10% with the
wake toggle off). `src/voiceGate.js` now feeds the standby recogniser only around speech (pre-roll
plus hangover, adaptive noise floor; unit-tested), which halves that in an ordinary room and
approaches the 10% floor in a quiet one. The gate is bypassed while the assistant is active so
"mirror stop" is never clipped. On a 6 W part this is the single biggest steady drain: re-measure
on the stick (`tools/startup-timeline.cjs` sums process memory; use the CPU delta script in the
session notes or Task Manager).
## Redundant style and layout writes (ambient and speaking)
Profiled with a CDP sampling profiler plus a MutationObserver on the Efficient tier at 540x960 under
4x CPU throttling (a stress condition, not the stick). Unchanged-value writes were the avoidable cost:
- The AR framing guide assigned `hidden` every frame (~8/s ambient, ~30/s speaking), invalidating
  style each time. It now writes only on change.
- `garmentOverlay.clear()` ran every ambient frame, releasing the clarity pipeline and rewriting
  `display` each time; it is now idempotent, and the camera layer `display`/`filter` are cached.
- The host `transform` and timer badge `hidden`/`dataset` are written only when they change.
- Caption tail-follow reads `scrollWidth/Height` once per animation frame instead of forcing a layout
  on every streamed delta.
Ambient style recalcs fell from ~9/s to ~2.5/s and ambient layout to 0/s. Run-to-run task time varies by
more than the change, so no whole-app CPU claim is made; confirm on the device.

## Frame pacing on a 30 Hz panel, baked portrait lift (1080x1920, Efficient tier)
Measured with the real app via CDP at 1080x1920, Efficient tier, 4x CPU throttle (a stress condition,
not the stick; the dev GPU is far stronger, so GPU-side savings below are not measured here).
- **Dropped frames.** The frame gates tested `elapsed < 1000/fps - 1`. When the target equals the
  display rate (30 Hz TV, reported as 29 or 30) rAF arrives every 33.33 ms against a 33.5 ms
  threshold, so every other callback was skipped: speaking ran at 23.4 fps in the bench (about 15 fps
  on a real 30 Hz panel), and `MotionQuality` saw "<75% of target" and shrank the portrait for no
  reason. `FramePacer` (renderBudget.js) allows up to half a measured refresh period of slack and is
  shared by `RenderBudget`, `SceneRenderBudget` and the wake cloud. Speaking: 23.4 -> 29.7 fps with
  per-frame main-thread cost unchanged (~17 ms/frame at 4x).
- **`filter: brightness(1.2)`** on `.face-host-canvas` made the compositor resolve the canvas through a
  filter pass over the host rectangle on every repaint. The lift is now baked once into the head art
  (and so into the mouth patches and eye/brow crops). Visual diff against the previous build at
  1080x1920: only 1-2 px antialiasing differences on edges (mean abs diff 0.1/255 over the frame).
  Main-thread numbers are unchanged by design; the saving is in the GPU/compositor, to be confirmed on
  the stick. The rig (3D) canvas keeps its CSS filter: ACES tone mapping makes a linear bake inexact.
- **Host aura** was positioned with `left/top: var(--face-center-*)`, i.e. layout whenever the head
  moved (~18 writes/s while speaking). It is now a transform; it stays centred on the face (<0.2 px).
- Checked and left alone: caption DOM (incremental, ~13 node ops per streamed delta), idle main thread
  (~4 fps, 35-40 ms/s at 4x), timers, `drawImage` head resample (pre-scaling the head art did not
  change the profile).
- **Largest remaining startup cost** (profiled, not changed): `TalkingHead` constructs its own
  WebGLRenderer + PMREM environment (~250 ms PMREM plus ~500 ms for context creation at 1x) although
  its renderer is never presented. `avatarOnly: true` in the library skips it but moves the animation
  clock to the caller, which touches voice/viseme timing; try it on hardware with the voice tests.

