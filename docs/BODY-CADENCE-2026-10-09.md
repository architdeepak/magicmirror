# Quality-specific local AR cadence

## Change and rationale

The body tracker previously admitted a frame at most every 100 ms in every quality. Its aligned camera/pose path therefore repeated old frames even when inference could complete faster. Submission ceilings now follow the existing quality selection: Eco 10 Hz, Auto 15 Hz, HD 30 Hz, with 1 ms scheduling tolerance. These are ceilings, not guaranteed inference or display rates. One in-flight inference, unchanged-video rejection, request/epoch ownership, watchdog recovery, bitmap disposal, HD display preservation and 400 ms freshness remain enforced.

## Runtime comparison

[Saved samples/build hashes and calculation](BODY-CADENCE-COMPARISON-2026-10-09.json) contain two sequential 45-second runs: actual packaged NVIDIA app, optional Queen rig, recorded 1280×720 stream, native photo ingestion, bundled tracking/occlusion, and periodic synthetic PCM through actual playback/local mouth classifier. Exclude the first two samples (12 remain per run).

| Measurement | Existing 100 ms | Quality-specific Auto |
| --- | ---: | ---: |
| Distinct synchronized camera bitmaps drawn/s | 8.42 | 13.67 |
| Inference requests/s | 8.39 | 13.70 |
| Median process-tree CPU, % of one core | 128.72 | 136.18 |
| Maximum sampled event-loop lag, ms | 8.8 | 12.0 |
| Visible-fit samples | 11/12 | 11/12 |
| Recorded monitor errors | 0 | 0 |

The higher update rate supports keeping the change with Eco available. These short shared-host runs are not a controlled efficiency benchmark: the separate baseline long monitor changes workload phases concurrently. CPU differences cannot establish wattage or Windows stick performance. Distinct camera draw count is not presentation FPS or motion/cloth realism qualification. HD 30 Hz is covered by submission/lifecycle unit tests, not this Auto runtime comparison.

Archive: `b6ca910c2f63cfc332ad134dba5547ade7c5c622ee4c5a3f70c1797b1453adec`. Baseline archive: `9857b9c6167895a9e51330910005a7765025a5489f242c8c6953a03fe8c5c87b`.

## Harness corrections

A first short run saved 14 samples with no application errors but failed temporary-profile cleanup with `ENOTEMPTY`; it remains rejected as a finished run. Recursive removal now has bounded retries, verified by subsequent successful terminal runs. Initial instrumentation counted repeated draws of the same bitmap; replaced with a WeakSet so each bitmap counts once without retaining it. Those initial redraw counts are excluded from the comparison.

The monitor accepts `MIRROR_MONITOR_BUILD` to isolate an explicitly chosen local unpacked archive; build, input and monitor hashes remain saved. No runtime application API is added by the monitor wrappers.

## Validation and remaining work

Full `npm test`, body-tracker tests (including per-quality due/early/busy/unchanged-video cases), camera-monitor negative checks, packaging, and whitespace checks pass. The separate [65-second lifecycle check](BODY-CADENCE-LIFECYCLE-2026-10-09.json) finished with 18 samples and zero recorded errors: actual AR, camera mirror, camera-off, accelerated owned sleep, wake, workers and synthetic playback/model. This is a short development regression, not long-run qualification.

Visual review still shows stretched photo fabric in raised-arm poses and unfinished rig hair/face realism. This cadence change does not close those gates. Physical camera latency, continuous displayed motion, long combined stability, calibrated gestures/parallax, natural consonant timing and final Windows efficiency remain open.
