# Distinct mouth poses and dental interior

October 8, 2026 (Pacific). Full suite remains incomplete: [master goal](MASTER-GOAL.md).

## What changed

The expression mixer previously imposed a generic `speech × .72` jaw floor on every viseme. O, OU and EE consequently opened too far; any future closed-lip shape would be reopened. Tracking/manual smiles and jaw opening could also dominate spoken shapes.

While speech energy is active, voice now owns jaw/lip channels. Camera blink, gaze, brows and upper-face emotions retain their own channels. Explicit AA, O, OU and EE have distinct openings; MBP provides closed lips, and FV provides a small opening plus an authored lower-lip roll. Unknown shape input falls back to AA. In silence, normal tracked/manual expressions and mood return.

Mouth closure eases faster than opening. Smoothing uses elapsed time directly, including zero-delta frames, and matches at 30/60/120 Hz. This change does not add an animation clock.

The preview rig has a new nonzero lower-lip-roll channel (38 supported local deformations), rounded individually shaped teeth on curved upper/lower arches, and a small bounded inner tongue. Teeth are batched per arch into one draw; the lower arch/tongue follow the jaw. Closed poses hide the interior. Tongue-out remains unsupported; this is simple procedural anatomy, not a fully authored facial asset.

## Verification and visual scope

Full `npm test` and `npm run pack` passed on the final source. Focused tests cover distinct jaw openings, MBP closure despite a tracked open jaw and smile, F/V lip roll, eye/brow independence, matched refresh-rate timing, finite morph normals/teeth geometry and batched arches on both personas.

The packaged pose audit adds EE/MBP/FV to neutral/blink/brows/AA/O/smile/gaze and ±32° turns. It checks interior visibility, settled zero redraw, supported/missing persona behavior, reload, Stop, context-loss portrait fallback and face-glow alignment.

The spoken replay uses an already recorded Gemini greeting through real output playback. The runtime waveform classifier still chooses only rest/O/AA. Adding MBP/FV poses does **not** establish live consonant recognition or phoneme synchronization. Those poses are currently verified through explicit fixture input. The portrait fallback does not have dedicated consonant artwork; 3D preview remains selectable rather than the default.

Visual review shows a better dental silhouette and smaller rounded-vowel opening. F/V is a basic rolled-lip pose and needs anatomical/art review; the remaining skin-material seam, procedural hair/crown, eyelids and broader facial expression quality keep G2 open. Small improvements are not a claim of photorealism or an installed Disney-like experience.

## Performance method

Compare immutable packaged archives using `tools/benchmark-rig.cjs`: same deterministic acting/vowel input, balanced quality, 720×1280 CSS viewport at DPR 1.5, 475×883 avatar backing, two-second warm-up and eight-second cases. Synthetic motion uses newly corrected mouth shapes after this change, so rendered mouth motion intentionally differs. Actual NVIDIA GB10 backend is verified; CPU percentages represent process-tree work, with 100% one core. Counts are render submissions, not physical presented FPS or wattage. Older frozen monitors remain on the shared host.

The initial after probe overlapped a UI audit; a separate isolated repeat was used instead. A final repeat follows the small dental-floor placement refinement, with its own archive hash. Record all conditions and avoid treating short CPU fluctuations as proven savings. Software first-speech stalls and its 30% efficiency/30 fps target remain open.

## Next work

Instrument software first-speech draw stalls to identify the actual cost owner. Evaluate a local timing/phoneme source and validate complete spoken clips before claiming consonant accuracy. Continue the wardrobe replay/ingestion stage rather than waiting for Windows or implying all other suite gates are closed.

## Final GPU measurement

| Moving-rig case | Process-tree CPU | Submitted frames/s | CPU ms/submitted frame |
| --- | ---: | ---: | ---: |
| mouth-before | 45.3% | 59.7 | 7.6 |
| mouth-final | 42.0% | 58.9 | 7.1 |

Final archive: `36d67965d49d0239e8841a51120e2e8a221c70f18e5654f42998320805b5f2ec`. Rendering cadence is retained in this short fixture; the small CPU difference is not established savings. No physical frame presentation, PC-stick performance or combined camera/voice/media workload proof.

## Local lip-sync candidates reviewed

[Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) produces timed mouth cues from existing recordings. Its file-oriented workflow is a candidate for prerecorded greetings and reference comparisons, not evidence of low-latency live streaming. [Amoner lipsync-engine](https://github.com/Amoner/lipsync-engine) documents streaming AudioWorklet playback with frequency-band classification and multiple viseme shapes. Its accuracy claims need independent evaluation on the saved clips; it has not been installed or integrated. Preserve the currently verified audio/Stop path when testing any classifier.

Review assets: [AA](media/queen-dental-aa.jpg), [MBP](media/queen-dental-mbp.jpg), [FV](media/queen-dental-fv.jpg), [actual local speech replay](media/queen-dental-speech.webm). Replay is a browser capture of the rig canvas plus the existing PCM greeting, requesting 30 fps at 475×883; it is not a physical HD/FPS test.

## Final checks and monitors

Both NVIDIA/MSAA and SwiftShader/FXAA packaged pose/lifecycle audits passed, including closed-pose interior hiding, ±32° turns, settled zero redraw, glow alignment and context-loss fallback. Actual playback/message-flow checks passed on the final NVIDIA archive, with independent output silence/closed fallback context after Stop. Software pose success is not a new software speech-timing or efficiency qualification.

At this saved snapshot, both earlier frozen monitors were confirmed live: 2026-10-09T04-28-05-971Z: 708 samples, 0 errors; 2026-10-09T03-23-39-044Z: 1973 samples, 0 errors. They continue on their recorded prior builds. No current-source eight-hour result is implied.
