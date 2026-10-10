# Recorded-camera, AR and speech lifecycle monitor

## What this adds

`tools/monitor-mirror.cjs` now supports `MIRROR_MONITOR_CAMERA=true`. It creates recorded video input resampled into a 1280×720 canvas at requested 30 Hz, uploads the actual plaid photograph through the DOM editor/native save, and runs the packaged application's local tracking/AR and chosen avatar. The selected closet item and displayed garment remain in agreement; no ad hoc overlay bypasses wardrobe state.

Five phases repeat: AR/camera on, Mirror/camera on, AR again, camera off, then Mirror sleep starting with a live camera. The app's owned 180-second idle sleep deadline is shortened to 1.5 seconds only during the dedicated sleep phase. The following phase wakes the actual app and restores camera capture. Default camera-phase length is 120 seconds. Existing camera-off mode rotation remains the default when this flag is absent.

Periodic local synthetic PCM exercises actual output-waveform metering and the local speech model. It is not acoustic voice, conversation semantics or phoneme accuracy evidence. No provider keys, microphone, physical camera or Internet media are used.

Metrics include actual body request count, fit/worker/input state, all still-active fixture streams, input dimensions, phase/capture count, selected/displayed garment names and framing/Ambient UI state. CPU is the application process tree, summed RSS can double-count shared pages, and GPU metrics cover the whole device. Original research video/photo and both monitor source files are hashed in each immutable build record. No real user captions, credentials or other app screenshots are collected.

## Checks

Sample and completion guards reject:

- Camera-off retained input/fit, continued body submissions or unused decoder/frame pumping.
- Multiple live camera streams after settling, camera streams retained in sleep, missing sleep or failed wake restoration.
- Main, scene or rig frame counters changing across consecutive sleeping samples. This is frame-counter evidence, not a compositor/wattage guarantee.
- Missing actual NVIDIA backend when requested, absent tracked fit, incomplete phase coverage, or no simultaneous visible fit and enabled output-waveform/model prediction.
- Invalid prediction IDs (including missing IDs); valid ID zero remains accepted.
- Closet state disagreeing with the displayed garment.

Existing muted/idle audio-clock, hidden animation, worklet/model, zero sleep target and event-loop guards remain. Node unit tests deliberately inject failures in these rules and are part of `npm test`.

## Evidence and rejected runs

- Full npm test passed, including new monitor policy tests.
- Final 65-second configured NVIDIA camera/speech smoke: 18 samples, zero recorded errors, eight valid-fit AR samples, all phases plus sleep/wake observed. [Final report](CAMERA-SPEECH-MONITOR-SETTLED.json). Sampling/phase setup adds time beyond the configured duration.
- An earlier 21-sample run also passed, with an indicative body submission rate of 8.47 requests/s across consecutive active AR samples. This is **not displayed FPS** or a controlled benchmark. Active AR's sampled CPU median was about 117% of one core on this shared Spark; phase windows cross speech/transition edges. It exposes a cadence/cost concern for future work. [Earlier raw report](CAMERA-SPEECH-MONITOR-SMOKE.json).
- The camera-off regression finished with four samples and no recorded errors. [Report](CAMERA-OFF-MONITOR-REGRESSION.json).
- The existing conversation-build camera-off monitor finished with 585 samples and zero recorded errors. [Final record](WARDROBE-CONVERSATION-MONITOR-FINAL.json). It does not qualify this new camera workload.

The first camera harness produced four renderer exceptions, timed out before fit and collected zero samples. Its unbound timer wrapper called the Window timer with the wrong receiver; binding it to Window restored operation. [Rejected harness run](CAMERA-MONITOR-FAILED-HARNESS.json). The final isolated Chromium check explicitly reproduces `Illegal invocation`, then observes the corrected 20 ms ordinary timer and 1,501 ms owned sleep deadline. [Native timer result](CAMERA-MONITOR-NATIVE-TIMER.json). Its DOM/control state is a fixture; app sleep is established by the separate packaged runs.

The first isolated test was rejected as evidence because Electron could close before reporting failure and its setup returned a function-bearing object that could not cross IPC. It now prevents automatic quit during cleanup, returns serializable values and reports an explicit positive result. Exit zero alone was not counted as a pass.

## UI inspection

An early screenshot caught the Ambient fade and old framing hint during initial tracking. After a 1.2-second settling interval, every valid AR sample reports Ambient opacity zero and framing ready. The [settled screenshot](media/recorded-camera-monitor-ar-settled.png) was inspected. The capture timing was corrected; no app UI defect was established from that transient image.

The actual fit still stretches cloth and exposes shoulders/underlying clothing. Recorded-camera source blur, realistic garment drape, physical room calibration, gestures/microphone/TV audio, Windows and an eight-hour final combined candidate remain unqualified. All master gates remain open.

## Reproduce

Requires the local research video and garment fixture; they are not bundled app assets.

```sh
npm test
xvfb-run -a node_modules/.bin/electron --no-sandbox tools/test-monitor-camera-native.cjs
MIRROR_MONITOR_CAMERA=true MIRROR_MONITOR_SPEECH=true MIRROR_MONITOR_GRAPHICS=vulkan MIRROR_MONITOR_AVATAR=rig MIRROR_MONITOR_PHASE_SECONDS=10 MIRROR_MONITOR_SECONDS=65 xvfb-run -a node tools/monitor-mirror.cjs
```

The application archive remains `9857b9c6167895a9e51330910005a7765025a5489f242c8c6953a03fe8c5c87b` (application checkpoint `7d8f8eb`). This checkpoint changes development monitoring and tests, not runtime application source.

Next: run the 30-minute recorded combined cohort; investigate the active tracking/camera cadence and cost while preserving same-frame fitting. Audit compositor/CSS activity separately from application frame counters before calling sleep physically efficient.
