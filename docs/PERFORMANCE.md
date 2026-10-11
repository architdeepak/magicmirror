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
