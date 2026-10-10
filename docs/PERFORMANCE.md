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
