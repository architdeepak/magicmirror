# Software face rendering and first-speech preparation

October 8, 2026 (Pacific). Suite goal remains active: [master goal](MASTER-GOAL.md). Quantitative evidence: [saved verification](SOFTWARE-RENDERING-VERIFICATION.json).

## Diagnosis and changes

Instrumented packaged speech playback and Chromium native traces distinguish JavaScript work from software rendering. In the saved trace, Avatar.update/Rig.update took at most about 2.2/2.1 ms and hidden-head animation 0.6 ms. Native GLES2::ReadPixels took 146 ms; layer update/main-frame work waited about 147–150 ms. Nested trace events overlap: their inclusive times must not be summed. The trace establishes a native canvas/readback stall; it does not prove a particular internal sampler compilation cause.

Detected software graphics now use simpler Phong lighting for the 3D preview. Geometry, authored morphs, original texture maps and backing resolution stay intact. Unused physical environment-map preparation is skipped. Original texture ownership is retained for disposal, and shared materials convert/dispose once. Hardware keeps physical lighting and MSAA. Software retains FXAA. The lighting response changes; it is not pixel-identical PBR. Appearance settings disclose the software lighting adjustment.

Before publishing a software rig, two one-off hidden initialization draws exercise all morphs and the complete compositor path, then restore a neutral frame. A bounded asynchronous GPU fence polls with zero wait time. The portrait remains visible during preparation; no warm pose is published. Generation checks reject replaced/disposed results, and errors/context loss restore the existing fallback. A request-generation guard also prevents older appearance completions from overwriting current status/preferences. This adds no ongoing animation clock; the two initialization draws are distinct from dynamic rendering and sleep budgets.

## Measured improvement

Same deterministic acting, 720×1280 CSS viewport, DPR 1.5, balanced quality, 475×883 rig backing, two-second warm-up and eight-second cases. Immutable packages, camera/cloud providers off, same shared host; older frozen monitors remain running. No other graphical probe overlapped these benchmark measurements. 100% process-tree CPU means one core.

| Moving software rig | CPU | Submitted frames/s | CPU ms/submitted frame |
| --- | ---: | ---: | ---: |
| Previous physical lighting | 737.9% | 20.85 | 353.89 |
| Final lighting and preparation | 492.1% | 22.48 | 218.89 |

Normalized cost fell about **38.1%** in these short measurements. This meets the initial 30% engineering benchmark target for this fixture, but roughly 4.9 CPU cores and 22.5 submitted frames/s remain costly. These are submissions, not physical presented FPS. The full G7 gate still requires repeatability, combined workloads, final hardware 30 fps and device measurements. Count frame deltas, not the three renderer calls per composer frame.

Final archive: `3d7b1615ea923b91ddd7d4398474cf47cd0aeb09beece25aabf2acb8530fdc45`.

## Failures retained and speech checks

- Experimental all-CPU GL compositing worsened first onset to 1280 ms (755 ms native swap wait); it is not adopted in the app.
- Jaw-only preparation gave little improvement (636 versus 648 ms). It was removed.
- Calibrated lighting without full preparation still failed first onset at 753 ms. Faster steady rendering alone did not solve cold onset.
- Diagnostic all-morph blocking preparation reached 514 ms. The production implementation uses an asynchronous fence instead of that diagnostic blocking finish.
- Preparing an alternate final render target still gave 635 ms. Preparing the actual canvas output then restoring neutral reached 508 ms in the preceding package.
- Final production package, with no diagnostic warm-up flag: all six stream/fallback routes passed. Stream onset was 510/485/482 ms; fallback 543/538/518 ms for a fixture whose tone begins after 450 ms of silence. Queued silence and the inserted gap had zero speech level; the tail remained active until actual output completion. Stop disabled speech and silenced the independent stream output check; fallback contexts closed. Speaking/Listening followed actual queued playback.

These are real worklet/Web Audio fixtures, not physical speaker/display latency, live acoustic recognition, phoneme accuracy or conversational quality proof. A trace run overlapping a UI probe was excluded from isolated latency evidence. Raw native traces remain local under artifacts; the instrumented tools reproduce them without committing a large trace dump.

The Stop UI assertion was corrected to permit natural idle blinks/glances after speech cancellation. It still verifies disabled playback and no late revival. Separate settled-pose zero redraw and sleep/hidden budgets remain enforced. Stop silences the Queen; natural silent acting is part of the requested experience.

## Visual review and remaining work

Review: [previous lighting](media/queen-software-before.jpg), [new lighting](media/queen-software-after.jpg), [turn](media/queen-software-turn.jpg). Calibrated linear specular values restore hair highlights after an initially overly dark conversion. Skin seams, procedural hair/crown, eyelids and mouth anatomy still need refinement. Portrait remains the default. Live waveform speech currently selects rest/O/AA; posed consonants are not automatic live recognition.

Focused tests cover shared material/map ownership, finite lighting parameters, generation/status races, fence completion/cancellation/timeout/failure/context loss and disposal. The full test suite and packaged software playback passed. The final NVIDIA pose/lifecycle audit passed with zero settled redraw, glow alignment and context-loss fallback; its snapshots confirm physical lighting, MSAA and zero software preparation. Hardware playback on the immediately preceding preparation package kept physical lighting and zero software preparation; its recorded greeting used existing audio without a new provider call.

The earlier immutable NVIDIA source `987ddd7` finished its two-hour monitor: 2,361 samples, zero recorded errors. It does not validate these newer changes or qualify the required eight-hour release candidate. The separate older eight-hour software monitor remains active.

Next: preserve full-resolution wardrobe uploads/captures separately from bounded editing previews, verify save/reload and cancellation, then extend local garment replay/occlusion review. Current photo ingestion retains a resized proxy as its “original”; G3 remains open.
