# Native camera clarity checkpoint

## Change

Auto/Eco Natural and Bright enhancement previously reduced a recorded 1280×720 frame to 960×540 before CPU processing. Saved display quality already applied correctly at startup.

The existing bounded tone/detail operator now runs in a native-resolution WebGL pass, capped at 1280×720 total pixels, without production CPU readback. Software renderers are rejected. Larger inputs and unavailable/lost graphics preserve the original frame with CSS tone; smaller inputs retain a CPU fallback. HD continues to preserve originals. Tracking, photo extraction and stored wardrobe originals remain separate from display enhancement.

Frame caching avoids repeated uploads and checks context loss before reuse. Hidden/missing-back/out-of-frame garments skip enhancement; camera-off, hidden AR and sleep release resources. Reopening can retry graphics; destroyed processors cannot resume.

## Evidence

- Full `npm test` passes on the final source. VM test loaders were updated for the new import; an initial loader failure was corrected.
- Actual NVIDIA shader test: Natural/Bright × canvas/ImageBitmap, maximum channel error 1 against the CPU reference, correct orientation/alpha, cached uploads, unchanged 1280×720 output, same-frame context loss returning originals, and resource release. [Result](CAMERA-CLARITY-NATIVE-GPU.json).
- Final packaged archive `a847c41d68264eaa2f5ebd762ae08753e9a485d6c56927d1c616c82872042eed`: 65-second recorded camera/AR/rig/synthetic PCM lifecycle, 18 samples, zero recorded errors. GPU enhancement active only in AR; camera-off/mirror/sleep release it; restart restores 1280×720. [Build, phases and sample hash](CAMERA-CLARITY-NATIVE-LIFECYCLE.json).
- Short explicit Natural comparison: median operator time 13.2 → 2.35 ms, output 960×540 → 1280×720, whole-process median CPU 164.2 → 144.7% of one core. After measurements are an **intermediate prototype**, not the final lifecycle archive; one post-warm-up sample used originals with the fit hidden. [Exact builds and metrics](CAMERA-CLARITY-NATIVE-COMPARISON.json).
- First comparison had clarity off and is excluded from enhancement performance evidence. Initial GPU test upload-counter bookkeeping failed and was corrected before passing; no shader mismatch was found.

## Visual review and limits

[Final packaged AR frame](CAMERA-CLARITY-NATIVE-AR.png) preserves captured detail but still shows exposed shoulders and fabric distortion around raised arms. Garment realism remains open. The source is a resampled recorded clip, not a physical HD sensor. Enhancement does not recover unseen detail or perform neural superresolution.

Cost timings exclude subsequent display composition. CPU observations are short shared-host runs, not controlled power measurements or Windows results. This checkpoint does not qualify physical camera, natural speech, continuous visual quality, final hardware, or the full suite.
