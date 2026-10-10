# Playback-driven speech motion

October 8, 2026 (Pacific). Progress toward [G1/G2/G7](MASTER-GOAL.md); full goal remains active.

## Defects fixed

Previously the live adapter opened the mouth on network receipt of a whole PCM chunk. Arrival timing does not identify when queued samples become audible. It also reset the mouth and labeled the UI Listening when the server finished sending, potentially truncating animation over the remaining output.

The visible avatar now samples the assistant playback bus on the existing shared animation loop. A reusable 512-float buffer reads an AnalyserNode at the streaming output gain; the Web Audio fallback has its own shared output gain/bus. This is about 21 ms of waveform at 24 kHz, not a second animation clock or growing PCM/phoneme queue. Idle/completed and stopped output is not sampled. Microphone, Spotify and desktop audio do not drive this meter.

A server turn ending does not erase the queued audible tail. Actual playback completion closes the meter and returns the UI to Listening/Ready. Cancellation clears the meter immediately, including the fallback path that previously returned early when `streaming` was false. Late playback callbacks cannot revive stopped/disconnected state. Old bus completion cannot cancel its replacement. Replacing/closing the fallback graph disconnects the old analysis branch.

The stream uses the installed TalkingHead worklet and existing 24 kHz/gain settings; playback was not replaced. The fallback still schedules adjacent buffers. [Web Audio's AnalyserNode specification](https://www.w3.org/TR/webaudio-1.0/#AnalyserNode) permits an unconnected output and defines the waveform window. Only a small analysis branch is added, without another audible route.

## What passed

- Unit checks: queued silence, active waveform, server-end tail preservation, suspended audio context, fallback Stop, stale analyser history after Stop, old bus completion, stopped/null graph and idle sampling cessation.
- Voice-state checks: server completion waits for active playback; actual completion returns Listening; canceled/disconnected callbacks cannot revive state.
- Mirror-state snapshot includes playback source, enablement, level, broad viseme, buffer size and context state.
- Full `npm test` and package build are recorded with the final checkpoint. Packaged playback audit uses the real message parser with a synthetic connected-session flag, real audio worklet/Web Audio nodes and the actual visible rig; it does not contact Gemini or use a physical microphone.
- Synthetic PCM contains 450 ms silence, 400 ms tone, 350 ms silence, then 400 ms tone. The whole packet and server completion arrive together. Visible jaw follows output, stays nearly closed in the internal gap and continues through the final tail. Both paths show Speaking while queued, Listening after playback, and LISTEN after the production Stop handler. Immediate/stale waveform levels are zero after Stop.

Final run numbers and archive identity are below and in [machine-readable evidence](PLAYBACK-SYNC-VERIFICATION.json).

## Spoken replay and visual review

[Queen speech replay](media/queen-playback-speech.webm) replays the existing recorded Gemini greeting locally through the actual worklet; no new API request. Browser MediaRecorder captures the actual rig canvas with the same PCM output bus. It requests 30 fps at a 475×883 backing surface; this is a browser capture, not physical presented FPS or an HD performance benchmark.

[Speech still](media/queen-playback-speech.png) and sampled frames show mouth opening and returning to neutral with playback. Review also exposes simple teeth and limited vowel shaping. The waveform heuristic still supplies only rest/O/AA; it cannot reliably recognize M/B/P, F/V or other phonemes. Consonant identification, authored mouth shapes/interior, realistic lids/hair/crown and the remaining skin-material seam are open G2 work. Physical audio/display latency and intelligible real microphone conversation remain separate gates.

The prior NVIDIA/software frozen monitors keep running on their own immutable earlier builds. They do not validate this new speech change. No claim of new power savings or eight-hour release qualification follows from this checkpoint.

## Reproduce

```bash
npm test
npm run pack
MIRROR_CAPTURE_GREETING=true MIRROR_PLAYBACK_GRAPHICS=vulkan \
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json \
xvfb-run -a node tools/check-playback-sync.cjs
```

The optional speech replay requires `artifacts/gemini-live/greeting.wav`; without the capture flag the synthetic playback audit is self-contained. GPU/ICD settings are isolated development probes for this DGX; Windows defaults are not changed.

## Final packaged NVIDIA results

Archive SHA-256: `aa6bc616f079179a73a5f044461b3a9ab16e68b134ff52ade73cffb4a56def18`. Actual renderer: `ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA Tegra NVIDIA GB10 (0x00002E12)), NVIDIA)`.

| Route | Mouth onset from whole-packet receipt | Last active sample | Queued/gap waveform level | UI after queued packet / after playback |
| --- | ---: | ---: | --- | --- |
| stream | 480.1 ms | 1600.1 ms | 0 / 0 | Speaking / Listening |
| fallback | 512.2 ms | 1632.2 ms | 0 / 0 | Speaking / Listening |

Both routes also passed the production Stop handler: immediate/stale avatar level zero, meter disabled and button LISTEN. Independent streaming-bus RMS after 150 ms was 0 (active before Stop: 0.129). Fallback output context was closed. A late worklet-start gate prevents Stop from being undone by callback arrival. The fallback schedules a 35 ms lead; reported onset includes that delay and waveform/frame sampling. These measurements are output-graph and render-loop timing, not acoustic speaker latency.

## Software repeat and remaining responsiveness defect

A final software run failed the onset bound; that tool version had not yet saved raw per-route samples. After adding failure-sample saving, the same final archive passed a repeat. Retain the failure rather than treating the repeat as qualification.

- stream: first mouth sample 623.9 ms; queued/gap level 0/0; UI Speaking → Listening; worst inter-sample gap 159.8 ms.
- fallback: first mouth sample 527.1 ms; queued/gap level 0/0; UI Speaking → Listening; worst inter-sample gap 65.8 ms.

The stream repeat contains a roughly 160 ms main-thread sampling gap at speech onset, which can delay visual motion. Shared-host/software drawing and first animated-frame costs need separate instrumentation before identifying the cost owner. This checkpoint does not qualify software 30 fps, input latency or the 30% CPU target. Both successful routes showed actual streaming RMS zero after Stop / closed fallback context and no meter revival.

Frozen monitor snapshots are saved in the verification JSON with their own build identities; both were live with zero errors at the saved snapshot. No new-source soak result is implied.
