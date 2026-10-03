# Live Avatar Evaluation

The mirror has two intentionally separate host paths:

1. **Rigged host** — deterministic, low-latency GLB/VRM face. This remains the
   default and is the only path that should be used for a highly art-directed,
   emoji-like character.
2. **Generated video host** — a WebRTC `MediaStream` or local video supplied by
   an image-to-video model. It takes over the entire avatar surface, preventing
   a generated face from fighting a rigged mouth or eyes underneath it.

`AvatarController.setAvatarVideoStream(stream)` and
`AvatarController.setAvatarVideoUrl(url)` are the integration seam. Switching
back is `AvatarController.clearAvatarVideo()`.

## Candidates worth evaluating

| Candidate | Fit for this mirror | Evidence / constraint | Decision |
| --- | --- | --- | --- |
| AVTR-1 | Best first live-video evaluation. It accepts a portrait plus separate speech and listening audio, so it can react while the person speaks as well as lip-sync its own answer. | The project reports 25 fps output in five-frame chunks and publishes per-GPU chunk latency. It needs Linux, CUDA 12, TensorRT 10, a locally built engine, and gated Hugging Face weights. Its streamer is non-commercial. | Evaluate after an approved reference portrait is available and the owner signs in to accept the model conditions. |
| VRM / ARKit-52 rig | Best final quality route for a deliberately designed, face-only cartoon host. Every facial channel stays independently controllable and stable. | Requires a properly authored head-only rig, but needs no generative-video latency or identity reconstruction. | Primary production route. |
| LivePortrait family | Useful offline/prototype renderer behind several current real-time stacks. | Great for quick driven clips; it is not a complete, sub-second dialogue stack by itself. | Keep as a renderer/reference option, not the mirror's primary runtime. |
| Hallo-Live | Strong research comparator for causal streaming avatar design. | The repository reports 20.38 FPS and 0.94 s latency on two H200 GPUs; that makes it a poor first deployment target for a single home appliance. | Research reference only unless hardware changes. |
| Meta Muse Realtime Avatar | Quality bar and architecture reference, not currently a self-hosted dependency. | Meta describes shared speech tokens, causal rolling video context, and 25 fps portrait output; the published evaluation is largely user-study based. | Track, do not couple the product to it. |

Sources: [AVTR-1 model card](https://huggingface.co/avaturn-live/avtr-1),
[AVTR-1 runtime](https://github.com/avaturn-live/avtr-1),
[Hallo-Live](https://github.com/fudan-generative-vision/Hallo-Live),
[Meta Muse Realtime Avatar](https://research.meta.ai/blog/bringing-your-muse-to-life),
[VRM expression standard](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/expressions.md).

## What to benchmark

No single score captures a convincing host. Each candidate must be evaluated
with the same approved reference image, ten short scripted lines, two minutes
of natural dialogue, and a 30-second silent-listening segment.

| Quality dimension | Automated signal | Human acceptance check |
| --- | --- | --- |
| End-to-end responsiveness | time from final TTS audio sample to first displayed frame; steady-state fps and dropped frames | It responds promptly enough to feel conversational, not like a video loading. |
| Lip synchronization | SyncNet confidence/distance and mouth-landmark distance (LMD) | Bilabials, open vowels, and pauses visibly land on the audio. |
| Identity stability | ArcFace/CSIM similarity to the reference, measured across frames | Head width, hair outline, eye placement, and face proportions never drift during a 2-minute clip. |
| Image quality | face-crop LPIPS/FID where a comparable reference sequence exists | No texture crawl, edge halos, warped teeth, or flicker behind the two-way glass. |
| Temporal stability | FVD or frame-difference outlier rate, plus a separate silent-mouth motion score | During silence, lips settle; the head has intentional micro-motion rather than rhythmic bobbing. |
| Expression and gaze | blendshape/landmark trajectory error when a driven reference exists | Blink, gaze, brow and smile remain independent of speech. |
| Theatrical performance | blinded pairwise preference over the same script | Subtle glances, listening, nods, and caption timing feel authored rather than random. |

For the rig path, the visual gate in `avatar-rig-standard.md` is mandatory:
neutral, blink, AA, OH, smile, brow-up, and left/right gaze must preserve the
same head silhouette. For video models, add an uninterrupted two-minute test;
one attractive still image never qualifies a model.

## Rollout order

1. Use approved, user-supplied character artwork to author the stable ARKit-52
   head rig; this is the visual baseline.
2. Run AVTR-1 offline on the same artwork and scripted voice clip. Record its
   measured fps, first-frame latency, SyncNet/LMD, and visual gate results.
3. Only connect its WebRTC output to the video-host seam if it beats the rig
   baseline on expressive naturalness without failing identity or stability.
4. Keep the rigged host as the instant fallback for a lost stream, slow model,
   or any visual-gate regression.

## Current machine readiness

The mirror host currently sees an NVIDIA GB10 (compute capability 12.1) with
CUDA-driver support, but the Spark runs ARM64 (`aarch64`). AVTR-1's supplied
Pixi workspace declares only `linux-64` (x86-64), so do **not** attempt a
native TensorRT/AVTR installation on this machine: it is an architecture
mismatch, not a missing-package problem. Run AVTR on a compatible x86-64
NVIDIA host, then send its WebRTC stream to this mirror. The stream handoff is
already implemented.

Run `npm run avatar:preflight` at any time for a read-only confirmation of
that state. Run `npm run preview:avatar-video` to create an offscreen proof
image of a video feed taking over the mirror host; it does not need a display
or a model server.
