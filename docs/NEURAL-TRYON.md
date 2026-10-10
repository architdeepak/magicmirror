# Neural moving try-on evaluation

The requested end state is a realistic outfit on the moving camera image, with
voice garment changes. The current local mesh overlay and generated stills do
not satisfy that requirement.

## Released candidate

[RTV](https://github.com/ZaiqiangWu/RTV) has public inference code and
[trained garment checkpoints](https://huggingface.co/wuzaiqiang/rtv_ckpts).
It synthesizes an overlay using DensePose and a body-mesh estimator. Each garment
needs its own trained model; an arbitrary imported clothing photo is insufficient.
Its custom license permits noncommercial use. The source and weights are in the
ignored `.tools` directory and are not included in the Electron package.

Source evaluated: `dd165d5f55508ec98a9d6c5d105b8415f95802ec`.
Checkpoint evaluated: `lab_03_vmsdp2ta/latest_net_G.pth`.
SHA256: `58c4e060e44d0a0042798866442d31419d9ef3df37c8aeece6b52c2bb92ff629`.

## Actual generator measurement

Run `python3 tools/benchmark-rtv.py` after downloading the source and checkpoint.
The tool loads tensor-only weights, checks the exact architecture, runs three
warm-up frames, then measures twelve frames with CUDA synchronization.

Development host: NVIDIA GB10, Python 3.13.9, PyTorch 2.13.0 with CUDA 13.0.
Input: synthetic six-channel 512×512 conditioning tensor.
Output: finite four-channel 512×512 garment tensor.

| Precision | Median generator time | Peak allocated GPU memory |
| --- | --- | --- |
| FP32 | 37.22 ms | 941,932,032 bytes |
| FP16 | 19.89 ms | 472,916,992 bytes |

Evidence: `artifacts/rtv/generator-benchmark.json`.
These are generator measurements, excluding camera capture, DensePose, body-mesh
inference, rasterization, composition, transport, and display. They prove neither
end-to-end frame rate nor realistic output. They describe this GPU host, not the
TV's PC stick.

## Current setup and remaining gate

The isolated `.tools/rtv-env` inherits the host's CUDA-enabled PyTorch. Detectron2
is checked out in `.tools/rtv-detectron2`; build dependencies install inside this
environment. This avoids replacing the host PyTorch with RTV's older pinned
version. Detectron2's native extension and simple-ROMP now build successfully on
this ARM64 host. `tools/prepare-rtv-runtime.py` keeps ROMP/BEV model caches under
`.tools`, disables the SDK's automatic package installer, and corrects RTV's
texture byte array from `int8` to `uint8` for current NumPy/OpenGL.

## Complete pipeline measurement

The complete released pipeline now generates the pretrained shirt on the public
MediaPipe pose photo. `tools/check-rtv-pipeline.py` measures eight repeated frames,
discards the first three as warm-up, and records individual stage timings.
This verifies real model execution and compositing, not moving-video quality.

| Configuration | Warm median, complete frame |
| --- | --- |
| FP32, DensePose short edge 800 | 754.48 ms |
| Mixed precision, DensePose short edge 512 | 140.13 ms |

The latter run uses NVIDIA EGL rendering. Its median stage times were body
estimation 36.35 ms, rasterization 1.64 ms, DensePose 48.63 ms, and garment
generation 30.38 ms. Total time also includes preparation and composition.
Camera capture, transmission and display remain excluded.

Reproduce the precision experiment with:

```sh
.tools/rtv-env/bin/python tools/prepare-rtv-runtime.py
.tools/rtv-env/bin/python tools/check-rtv-pipeline.py --amp --densepose-short-edge 512
```

Evidence: `artifacts/rtv/pipeline-benchmark-amp-512.json` and
`artifacts/rtv/person-tryon-amp-512.png`. The comparison still shows original
clothing at the waist and small generated artifacts below the knee. It is not
ready to replace the app's live view. Smooth motion, changing poses, occlusion,
and other garments remain unverified.

## Remaining gate

### Actual motion evaluation

`tools/check-rtv-motion.py` now processes the public
[ROMP dance test clip](https://raw.githubusercontent.com/Arthur151/ROMP/assets/demo/videos/sample_video2.mp4).
The source hash is recorded in `artifacts/rtv/video-sources.json`. Both runs
processed all 300 frames at 960×540 and generated an outfit in every frame.
An extra blank frame returned unchanged, confirming that lost-person input
does not retain the previous generated garment.

| cuDNN setting | Warm median | Warm 95th percentile | Warm maximum | Frames over 500 ms |
| --- | --- | --- | --- | --- |
| Autotuning on | 128.32 ms | 628.32 ms | 2086.03 ms | 98 / 297 |
| Autotuning off | 330.88 ms | 673.21 ms | 1828.71 ms | 116 / 297 |

Disabling autotuning did not improve the measured behavior, so the evaluator
retains the upstream default. These results exclude transport and display;
the processing stalls still preclude smooth live use.

The comparisons are offline WebM videos played at the original source speed:
`artifacts/rtv/motion/comparison.webm` and
`artifacts/rtv/motion-no-autotune/comparison.webm`. Playback speed is not inference
speed. The observed output has conspicuous neckline/chest holes exposing the
original top as the arms rise or the torso turns. Its mask also has sharp edges.
The model has not passed realistic motion or temporal-quality review.

Reproduce the baseline and the unsuccessful tuning experiment with:

```sh
.tools/rtv-env/bin/python tools/check-rtv-motion.py
.tools/rtv-env/bin/python tools/check-rtv-motion.py --no-autotune --output-dir artifacts/rtv/motion-no-autotune
```

### Diagnosing the chest gaps

The motion evaluator can now capture generated RGB, raw alpha, thresholded alpha,
and the final eroded mask without changing the original compositor. Disk writes
occur after the timed pipeline call. This separates model output errors from
composition errors.

```sh
.tools/rtv-env/bin/python tools/check-rtv-motion.py --frames 181 --capture-masks --output-dir artifacts/rtv/mask-diagnostics
```

At review frames 0, 30, 90, and 180, the chest gaps already exist in the raw alpha
and generated RGB. The enclosed gaps occupy 637, 641, 1430, and 1188 pixels before
erosion; their median raw alpha values are 2, 1, 0, and 0 on the 0–255 scale.
Generated RGB inside those gaps is nearly black. Removing erosion or lowering
the threshold would not recover a correctly synthesized shirt in these regions.
The training dataset keeps mask targets in the 0–1 range, so converting the alpha
as though it were a normalized RGB channel would contradict that target range.

Evidence: `artifacts/rtv/mask-diagnostics/hole-analysis.json` and
`frame-030-layers.jpg` / `frame-180-layers.jpg` in the same directory. This remains
an offline diagnosis, not an app feature or a realistic-output approval.

A 31-frame comparison using FP32 and DensePose short edge 800 retains the same
chest gap. At frame 30 it occupies 716 pixels before erosion, with median raw
alpha 1/255 and nearly black generated RGB. Increasing precision and conditioning
resolution does not fix this observed failure. The released checkpoint remains
unsuitable for the requested realistic moving view on this test footage.

```sh
.tools/rtv-env/bin/python tools/check-rtv-motion.py --frames 31 --capture-masks --fp32 --densepose-short-edge 800 --output-dir artifacts/rtv/mask-diagnostics-fp32
```

Evidence: `artifacts/rtv/mask-diagnostics-fp32/result.json` and
`frame-030-layers.jpg` in that directory. This comparison addresses the visible
gap; it is not a controlled performance comparison against earlier runs.

### Integration gate

Before adding the candidate to the app:

1. Run the complete released pipeline on public test footage with a pretrained
   garment. Include body and DensePose estimation in latency measurements.
2. Inspect the actual moving output for alignment, texture stability, arms and
   hair occlusion, original garment leakage, and front/side movement.
3. Implement camera-frame transport only after the measured pipeline works.
   Stop, camera loss, garment changes, and stale frames must cancel or invalidate
   queued work. A rendered output must carry its source-frame timestamp.
4. Verify it on the target deployment hardware and camera. A separate GPU host
   remains a deployment choice; the app is not configured to send frames to one.

RTV's pretrained catalog would be a constrained prototype. Supporting arbitrary
clothes still requires a suitable general model or a garment-training workflow.

## Optional live neural service path

The [official Decart examples](https://github.com/DecartAI/tryon-examples) describe
live camera input plus a garment reference image, with transformed video returned
over WebRTC. The app now includes an optional implementation using SDK 0.2.5 and
the SDK's canonical `lucy-vton-3.5` model. This is separate from the rejected RTV
checkpoint and from the existing still-image renderers.

The app defaults to local camera fit. Settings accepts an encrypted/session-only
Decart key; `DECART_API_KEY` is an optional environment fallback. Only the main
process holds that key. A trusted mirror frame can request a token after explicit
live-video consent. Tokens expire after 60 seconds, permit only the selected
try-on model, and restrict sessions to 600 seconds. The UI provides Start/Stop,
sharing status, and a separate consent checkbox naming Decart and account credits.
The sender crops the camera center to 720×1280 at up to 30 fps and has no audio
tracks. SDK telemetry is disabled. Service processing/retention follows Decart's
terms; no claim of local-only cloud processing is made.

Stop, hard mute, camera change/loss, mode exit, desktop presentation, page hiding,
and unload dispose the owned canvas stream and clear returned video. The source
camera remains owned by the tracking module. Garment changes start a new session
to isolate late output from the previous garment. Failed sessions require an
explicit restart; there is no automatic reconnect. Pending SDK connections have
no public abort API: their camera input is stopped immediately, and a client
returned later is disconnected without displaying its stream.

Verification so far:

- Offline lifecycle tests: consent, scoped tokens, token cancellation, crop math,
  stale streams, connection acceptance, camera loss, separate camera ownership.
- Actual packaged Linux ARM64 app: bundled SDK import and real portrait canvas
  capture, centered video pixels, zero audio tracks, source camera still live
  after sender cleanup, and inactive cloud controls at startup.
- Existing verification suites still pass after adding this path.

No live Decart session has been run. A configured account is still required to
evaluate actual generated garment quality, motion/occlusion, latency, charges,
and target PC-stick operation. This implementation does not prove the original
realistic moving try-on requirement achieved.

The [LiveVVT author repository](https://github.com/caoyushe/LiveVVT), inspected on
2026-10-06, contains a README and license and says its code is under preparation.
It is not an executable alternative in that inspected state.

### Presented-frame monitoring and UI check

The live controller uses `requestVideoFrameCallback` to distinguish a presented
frame from a successful playback promise. It stays in Connecting until both the
connection and the first presented frame are ready. A three-second output stall,
remote track loss, or replaced camera source stops sharing and clears output.
The assistant receives presented-frame age in mirror state. SDK glass-to-glass
latency and received FPS are also reported when available; unavailable metrics
remain null. Presented-frame age measures display freshness, not source-camera
capture age or end-to-end latency.

`tools/check-live-tryon-ui.cjs` runs the production packaged renderer with a
synthetic camera and actual captured video frames. The cloud SDK connection is
a local fixture. It exercises real Settings/consent controls, closet selection,
garment changes, late output, returned-video stalls, hard mute, sharing revocation,
mode exit, and camera loss. Assistant Stop invokes the production handler; this
check does not run spoken wake/stop recognition. Evidence is saved under
`artifacts/live-tryon-ui/`. Generated cloth quality remains unverified.

### Assistant sees the selected try-on view

The assistant's frame provider now selects the displayed fitting-room content.
For local fit it composites the mirrored, center-cropped camera plus the existing
garment/effect canvases. For neural fit it uses the presented generated stream;
for a rendered still it uses the displayed image with matching containment. A
pending or stale neural view provides no frame, rather than unrelated raw camera
imagery. Outside Try On, the provider retains ordinary camera input. This is not
a full-screen capture; desktop and app observation remain explicit tools.

The vision checkbox covers camera and try-on imagery, and its current value is
reported immediately in mirror state. A separate notice distinguishes Decart
sharing from assistant vision. Source names and last sent source/time are exposed
without embedding camera pixels or credentials in structured state. Outgoing
images have a maximum edge of 640 pixels.

The packaged UI check decoded the actual outgoing JPEG messages and verified
blue output pixels followed by green pixels after the garment change. It also
verified that Connecting produced no frame. The socket was a local fixture; no
image was uploaded to Gemini and no neural garment realism was evaluated.

### Real Gemini vision check

The optional `check:gemini:live` now sends only synthetic solid-blue/green video
through the production source selector, token broker, adapter, and live service.
The initial immediate frame-then-question path produced “Shadow” or “Unknown”
despite an outgoing blue JPEG with center pixel `[0, 0, 255, 255]`. Experiments
with empty manual activity markers or all-input turn coverage did not resolve it.
Sending the frame before a 1200 ms wait did: the service identified Blue and then
Green in separate turns. Google documents that realtime modalities are concurrent
and [cross-stream ordering is not guaranteed](https://ai.google.dev/api/live#BidiGenerateContentRealtimeInput).

The production text-question path now waits 1200 ms after sending a visual frame.
Text requests without a frame keep their previous timing. Stop clears the pending
wait and invalidates the turn before its question can be sent. This is an observed
timing workaround, not a server acknowledgement or a guarantee across all network
conditions. Spoken microphone turns retain their existing streaming boundaries.

Evidence: `artifacts/gemini-live/result.json`, `vision-blue.json`,
`vision-green.json`, and the associated synthetic JPEGs. The positive result uses
the production adapter without a fixture delay or setup override. This establishes
real-service understanding of successive synthetic preview colors; it does not
verify generated clothes, physical camera input, or computer screenshot reasoning.

## API-free local FASHN evaluation

The [FASHN VTON 1.5 author repository](https://github.com/fashn-AI/fashn-vton-1.5)
provides Apache-2.0 code and public weights for image try-on. Source revision
`7c0f10af3f91ad4048fe9729c470a13ef905d25a` was installed in the isolated
`.tools/fashn-env`; weights and the author's public Space example photos remain
under `.tools` and `artifacts`, outside the Electron package. No account/key was
used. Offline inference passed after the public weights were cached.

Actual complete calls on NVIDIA GB10 / PyTorch 2.13.0 CUDA 13.0 generated
576×864 images: 10 steps took 10.03 seconds; 20 steps took 17.56 seconds.
Peak allocated GPU memory was 3,198,218,752 bytes; pipeline loading took 4.78
seconds. Pose detection used ONNX Runtime CPU because a CUDA provider was not
installed in the isolated ARM64 environment. These are two observed calls, not
latency percentiles or measurements on the PC stick. The 10-step output softened
some clothing/text detail; the 20-step example retained the shirt logo more
clearly. Both were inspected visually. One public person/garment pair is weak
quality coverage and does not prove garment, identity or motion reliability.

Reproduce, after installing the author code/dependencies and downloading weights:

```sh
.tools/fashn-env/bin/python tools/check-fashn-local.py
```

Evidence: `artifacts/fashn/benchmark.json`, `output-10.png`, `output-20.png`.
The evaluator sets offline Hugging Face/Transformers mode. No service integration,
frame streaming, temporal model, cancellation or live-video quality is established
by this experiment. An API-free generated-photo path is feasible on this GPU;
a smooth realistic moving view still requires further work.
