# Real-time outfit options

Checked 2026-10-06 Pacific. The required output is a transformed live camera
feed with outfit changes and plausible moving cloth. Generated stills do not
satisfy this stage. Provider marketing throughput is not our measured latency.

## Decart

[Official current pricing](https://docs.platform.decart.ai/getting-started/pricing)
lists Lucy VTON 3.5 at 720p for $0.02/second, or $0.04/second with fast mode.
Realtime billing follows active generation time. Standard arithmetic: $1.20/min,
$6/five minutes, $72/hour. Fast mode doubles those amounts. Five minutes/day for
30 days is $180 standard; ten minutes/day is $360. These are undiscounted try-on
charges, excluding any other services. New accounts receive test credits;
the referenced pricing page does not specify the grant amount.

[Official VTON model](https://platform.decart.ai/models/lucy-vton) accepts a live
WebRTC stream, garment reference image and/or prompt. The current app has an
optional SDK integration; no generated Decart session has been evaluated here.
Latency, outfit fidelity and portrait framing remain live evaluation gates.

## Alternatives

- [StreamDiffusion](https://github.com/cumulo-autumn/StreamDiffusion): executable
  open-source interactive image-to-image pipeline. Author benchmark reports
  about 94 fps for SD-Turbo on RTX 4090. That is pipeline throughput, not measured
  camera-to-screen latency or verified garment accuracy. Potential local GPU
  candidate for clothing edits; identity/garment preservation and temporal
  stability would need specific conditioning and adversarial testing. Model
  licenses and compute costs still apply.
- [Krea Realtime 14B](https://huggingface.co/krea/krea-realtime-video): published
  weights/code with webcam/video-to-video support. Author reports 11 fps using
  four steps on a B200 GPU. This is general video generation/editing, not a
  validated garment-reference try-on implementation. Heavy GPU path; no PC-stick
  real-time claim follows from the benchmark.
- [Snap cloth simulation](https://developers.snap.com/lens-studio/features/try-on/cloth-simulation-try-on):
  body tracking, body occlusion and physics with authored 3D garment meshes.
  Could support a constrained live clothing catalog. Arbitrary garment-photo
  conversion is not established; SDK/platform compatibility and commercial
  pricing must be verified for an Electron/Windows deployment.
- [RTV](https://github.com/ZaiqiangWu/RTV): dedicated training/checkpoint per
  garment, GPU runtime and noncommercial-use license. Our existing moving-clip
  evaluation exposed chest/neck holes and processing stalls; see
  `NEURAL-TRYON.md`. It has not passed the requested quality bar.
- [LiveVVT](https://github.com/caoyushe/LiveVVT): current author repository still
  says code is under preparation. Not currently a runnable integration candidate.

The local FASHN experiment is an image generator and remains outside this live
comparison. Decart is currently the most direct garment-specific streaming
candidate from these inspected sources, but requires paid usage and real tests.
StreamDiffusion is a reasonable next self-hosted experiment; its live clothing
quality is unproven. Neither is declared complete based on a published demo.

## Running monitor

`tools/monitor-mirror.cjs` launches the actual packaged Linux app in an isolated
profile and samples metrics every three seconds. Default duration is 30 minutes;
set `MIRROR_MONITOR_SECONDS` to change the bounded duration (10 seconds to one
day). It cycles Ambient/Converse/Try On/Watch/Music every four minutes, allowing
the real three-minute ambient sleep timer to run. It reports renderer errors,
large event-loop stalls and sleep-budget violations. Camera, microphone and
cloud services are off in this initial monitor; it establishes no combined
tracking/voice/streaming performance. CPU covers live descendant processes, RSS
sums shared pages, and GPU readings cover the whole device. Rendering is forced
to software in this stress run. None of these is a whole-machine wattage measure.

```sh
xvfb-run -a -s '-screen 0 1080x1920x24' npm run monitor:local
```

Logs and live summary are in `artifacts/monitor/<run timestamp>/`;
`artifacts/monitor-live.log` identifies the active audit run. The current monitor
has no provider credentials and performs no paid generation or purchases.
