# Avatar volume and measured rendering checkpoint

October 8, 2026 (Pacific). Full suite goal remains active: [master plan](MASTER-GOAL.md).

## Changes

- Batch static hair meshes without removing vertices, indexed triangles or shape. Actual hardware draw calls fall from 35 to 15.
- Replace the overlapping spherical skin skull with a 289-vertex posterior volume connected to the actual face oval. All face-oval vertices and local morph positions/normals agree with the front face; the volume follows jaw motion. Total beauty geometry falls from 29,744 to 28,812 triangles.
- Support posed turns beyond ±30° (measured approximately ±32°). Ordinary authored movement remains restrained.
- Keep hardware MSAA. Detected software rendering uses FXAA at the same bounded backing resolution, after tone/color conversion. Its two extra fullscreen passes bring totals to 28,814 triangles and 17 draw calls. Buffers resize/dispose with the existing host; no additional animation clock.
- Make speech-energy decay depend on elapsed time. A fixed per-frame decay previously closed the mouth faster at 60 Hz than 30 Hz. The new unit check compares equal one-second intervals at both rates.
- Add a repeatable packaged-app benchmark and actual GL renderer/sample diagnostics. New benchmark runs copy an immutable application archive and record its SHA-256.

## Visual review and lifecycle checks

The packaged NVIDIA run exercises Queen/Snow, neutral/blink/brows/AA/O/smile/gaze, both ±32° turns, surface bounds, persistence, unsupported-persona fallback, zero settled redraws, Stop, context-loss portrait fallback and glow alignment in five positions. Full `npm test` and `npm run pack` passed after the elapsed-time speech fix. Software FXAA had also passed the packaged visual/lifecycle audit before that final timing fix; the timing fix has its focused 30/60 Hz test.

Reviewed captures: [Queen neutral](media/queen-volume-neutral.jpg), [Queen side view](media/queen-volume-32.jpg). The large detached cheek strip is reduced by the connected volume, but a thin texture/color seam remains. Hair/crown are procedural; teeth remain simple and the inner mouth needs work. Neither stills nor posed vowels establish realistic spoken lip synchronization. The portrait remains the default; 3D is selectable preview.

[Silent acting preview](media/queen-volume-preview.mp4) is an offline 96-frame/24 fps export, captured before the final speech-decay edit. It illustrates poses and transitions; it is not measured live display FPS or a spoken-synchronization test.

## Performance method and limits

The same fixture uses a 720×1280 CSS viewport at DPR 1.5 (1080×1920 output), with a 475×883 avatar backing surface at balanced quality. Camera, wake and cloud voice are off. Each portrait/rig settled/moving case warms for two seconds and measures eight seconds; moving cases use deterministic turn, gaze and synthetic speech-level/vowel updates. Process-tree CPU is measured from `/proc` ticks; 100% equals one core. CPU milliseconds per submitted rig frame normalize differing cadence. Renderer synchronous timing excludes asynchronous GPU completion.

Actual NVIDIA acceleration is verified by the unmasked GL renderer: `ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA Tegra NVIDIA GB10 (0x00002E12)), NVIDIA)`, four samples. Isolated child flags select ANGLE Vulkan and GPU compositing, with the NVIDIA ICD selected for that child only. No system driver changes or fake detector override. [ANGLE primary documentation](https://chromium.googlesource.com/angle/angle/+/HEAD/doc/DebuggingTips.md) documents the backend flags.

The baseline and first final cohorts below precede only the final speech-decay change. Their evidence is retained separately from final-build repetitions. Baseline did not yet record an archive hash; the final software/NVIDIA cohorts both used archive `a84b0ed6ddef89c3750cceb5577d76e4cb4f074a8f48e66405b8a767850b0e89`.

| Moving rig cohort | Process-tree CPU | Submitted rig frames/s | CPU ms/submitted frame |
| --- | ---: | ---: | ---: |
| Original software baseline | 1099.5% | 24.0 | 458.6 |
| Final software isolated | 817.9% | 23.2 | 352.1 |
| Final NVIDIA | 42.6% | 58.1 | 7.3 |

Software normalized CPU cost improves approximately 23.2% in this short comparison; the master plan's 30% engineering target is not met. Raw CPU drops cannot establish savings when cadence also drops. This is a shared host, with an older frozen monitor still running, not replicated statistical evidence, wattage or a Windows PC-stick result. Counts are submitted renders, not physically presented frames; headless output cannot prove TV smoothness. The NVIDIA result supports continued accelerated local development, not completion of the device gate.

Rejected experiment: a depth-only prepass increased normalized software CPU cost (~465.6 ms/frame versus baseline 458.6); it was removed. Raw MSAA-off and overlapping probe runs are exploratory and excluded from the headline comparison.

## Remaining work

Measure actual audio-playback/mouth timing, support consonant closures and F/V shapes, refine interior anatomy and eliminate the remaining material seam. Continue efficiency work without masking it by reducing animation cadence. Combined physical camera/voice/media load, authored art quality, eight-hour candidate validation and Windows hardware remain open.

### Next defect located

`geminiLiveAdapter.js` currently sets speech level/viseme when each PCM chunk arrives, before the playback queue consumes it. Its simple zero-crossing classifier yields only rest/O/AA, not recognized phonemes. `expressionMixer.js` also imposes a generic jaw-open floor on every active vowel. Next work should align motion with actual output playback first, then add supported shapes without claiming phoneme recognition from these heuristics.

### Final archive repeat

Both sequential repetitions after the speech fix use immutable archive `5dac3c4b103a2bf3345c28a771cb82611bae2bf5f712f094bf9f7b5a43296055`. No other graphical probe ran concurrently; the older frozen monitor remained active. Conditions and limitations above still apply.

| Final-build moving rig | Process-tree CPU | Submitted rig frames/s | CPU ms/submitted frame |
| --- | ---: | ---: | ---: |
| checkpoint-vulkan | 39.6% | 58.7 | 6.7 |
| checkpoint-software | 756.4% | 21.5 | 352.0 |

See [machine-readable evidence](RIG-VOLUME-VERIFICATION.json) for every portrait/rig settled/moving case and actual renderer diagnostics. Software results vary between short repeats; the original baseline has no matched archive hash or repeated statistical comparison, so the 30% target remains open.
