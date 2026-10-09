# Magic Mirror master goal

Established October 8, 2026 (Pacific). Baseline: `c7fc732` on `codex/local-ar-wardrobe`.
Status: **active; suite incomplete**. This document is the durable plan for subsequent work.

## Intended experience

A person approaches a portrait TV, says “mirror mirror,” sees a fluid, cinematic emergence from dark glass, and meets a convincing animated Queen. The Queen converses naturally, can see the relevant displayed state, operates useful apps and tools, and makes room for their content. Voice and simple gestures operate the mirror, its local wardrobe, music and watching. Stop silences/cancels immediately after recognition; hard mute visibly releases listening. The device remains responsive and economical enough for a Windows PC stick.

The baseline wardrobe and avatar run locally without paid generative services. Existing live voice can use its configured cloud provider. “Local baseline” does not mean all conversation or Internet media is offline or free.

## What the review established

The review read the original request, completion/audit records, current renderer, rig and expression code, screen/agent harness, local wardrobe contracts, casting player, Windows Spotify bridge, package instructions and frozen monitor samples. Evidence is substantial, but many checks use fixtures and the Windows ZIP predates recent changes. No physical camera is attached to this development machine. Windows is intentionally deferred until the final stage.

| Area | Current state and evidence | Main gap |
| --- | --- | --- |
| Wake / live voice / Stop | Packaged local wake plus real Gemini Gacrux journeys with recorded audio through a MediaStream; playback silencing, standby and hard mute checked | Room acoustics, interruption/echo quality and physical end-to-end recognition |
| Captions / portrait controls | Two colored rows; packaged multi-viewport and editor tests | TV-distance readability and combined real media/conversation |
| Visual emergence / HD | GPU layered smoke with CPU fallback, reduced motion and cancellation; bounded HD profiles | Physical accelerated throughput, refined art direction; offline movies are not live FPS evidence |
| Avatar | Selectable Queen/Snow 3D preview; 37 nonzero local morph channels, separate eyes, solid accessories, pose/cache/fallback checks | Better closed head volume, hair/crown, eyelid anatomy, interior mouth and speech timing; portrait remains default |
| Camera / head / hands / pose | Bundled workers; actual public-image inference; same-frame camera/pose display; 4K ideal request with negotiated-size reporting | Physical sensors, multi-person ambiguity, top-camera calibration and error rates |
| Local wardrobe | 30 starters; local front/back photo editor, extraction, paired phone upload, originals, lookbook and controls; recorded-motion checks | Convincing shoulders/sleeves, side/back continuity, occlusion, long sleeves/layers and simple scanning guidance |
| Agent / computer tools | Actual installed Codex screenshot/click task and typed map fixture; cancellation/account-boundary checks | Broad task coverage, native Windows actions, recovery and matching every observation to what the user sees |
| Music | Native Windows media-session bridge and ambient player views; mocked/session/device tests | Actual local Spotify account, TV audio, native session reliability and interruption behavior |
| Watch / casting | Real YouTube controls and locally decoded cast media; protocol/player fixtures | Actual supported phone connection, signed-in streaming/DRM behavior, native Windows handoff |
| Friends / location | Honest Find Devices label; stale-map reasoning fixture | No Find My People bridge or real shared account; browser sign-in alone is not evidence of access |
| Efficiency / packaging | Sleep/hidden zero drawing; cache tests; Linux packages and old Windows archive checks; frozen soaks | Active 3D cost, camera-plus-voice-plus-media budgets, latest Windows build and physical installation |

### Performance finding that changes the next work

The saved cohort summary is [MASTER-GOAL-BASELINE.json](MASTER-GOAL-BASELINE.json); its later snapshot is separate from the first review below.

The completed HD software-rendering monitor had 2,335 samples and zero recorded errors. Active portal/AR averaged about 45.9/46.5% process-tree CPU. At a 2,203-sample snapshot, the separate 3D preview monitor had zero recorded errors but averaged about 112.3/116.4% in portal/AR, with large upper-tail spikes. Here 100% represents one CPU core. Modes had camera/cloud voice off.

These runs use different frozen builds and shared-host conditions; this is **not** a controlled comparison, hardware wattage or a Windows result. It establishes a concern to reproduce, not a proven causal diagnosis. A crash-free soak cannot qualify the 3D preview for a small PC.

## Completion gates

Numbers below are desired acceptance targets, not statements that they have been achieved. Record the actual build, display, hardware, camera resolution and test conditions before marking a gate passed. If a target is infeasible, document the measured tradeoff and revisit the design; do not quietly weaken the test.

### G1 — Wake, conversation and cancellation

- One coherent state machine covers sleep, standby/wake, listening, thinking, speaking, stopped and hard mute. Every state has a clear visible indication.
- “Mirror mirror” triggers one reveal/greeting; ordinary speech after Stop cannot restart the assistant. Hard mute releases microphone/wake tracks and prevents new listening until explicit unmute.
- Recognized Stop reaches the local cancel handler within 50 ms; queued output/tool effects are rejected and audio reaches silence within 100 ms after that handler. Measure acoustic phrase timing separately, including phrase end rather than only phrase onset.
- Interruption works during greeting, speech, agent input, camera/photo jobs, timers/routines and media buffering. No delayed callback restarts speech, saves an unwanted photo or acts on an obsolete screen.
- Caption display has at most two visible lines total, distinct heard/said styling and readable speaker identification. Partial/final corrections replace the appropriate text without duplication. Review at actual TV distance.
- Validate quiet, speech over music, noise, echo, network loss, microphone loss/reconnect and repeated wake/Stop/mute sequences. Physical input remains an open gate until available.

### G2 — Convincing animated Queen and theatrical visuals

- Stable likeness and continuous 3D geometry throughout neutral, closed blink, independent brows, gaze, smile, surprise, thought, speech and at least ±30° side views. No holes, pupil leakage, floating teeth, extra mouth, duplicate face, exposed torso or obvious cheek/skull seam.
- A coherent head silhouette, sculpted hairline/locks and crown must survive turns; a flat plate or a larger blurry image does not meet this gate.
- Mouth/jaw motion follows real speech onset, consonant closures, vowels, pauses and interruption. Cover AA, O/OU, EE, M/B/P and F/V shapes; add tongue/interior anatomy where needed. Validate on an uninterrupted spoken recording, not only posed screenshots.
- Tracking, authored acting and speech have explicit independent channel ownership. Natural blinks/glances settle; no perpetual idle bounce or random identity changes.
- Glow follows the face at all positions/modes/sizes. Emergence is smooth and restrained, respects reduced motion and cancels immediately. Compare actual recordings, not merely shader compilation.
- Keep portrait fallback until the visual and efficiency gates pass. Named targets alone do not establish rig quality; make any unsupported channel explicit.

### G3 — Simple, convincing local AR wardrobe

- Easy entry routes: upload, mirror camera and paired phone photo, with clear framing/background instructions, review and explicit save. Front required; back optional. Originals survive enhancement, recropping, reload and cancellation.
- Starter styles/colors and personal garments have matching UI/voice/gesture flows for selection, capture, front/back review, fit adjustment, favorites and saved looks. Unsupported photo transformations are explained clearly.
- Display the exact camera frame used for its pose/occlusion. Stale or missing pose, camera loss and body loss clear the garment safely. No floating garment against a newer camera frame.
- Evaluate a replay matrix: arm down/raised/crossed, walking, leaning, turn/profile/back, different lighting/backgrounds, body partially out of view, different garment types and multiple people. Include shoulders, sleeves, hands/hair and shared seam continuity.
- Improve apparent garment fit and continuous side/back coverage using local geometry/tracking and source photos. Define the supported garment/motion envelope explicitly; review output for believable alignment and occlusion. Visibility percentage alone cannot pass realism.
- No invented sizing or reconstructed hidden fabric. Accurate size measurement and physically simulated cloth are separate capabilities unless actually implemented and validated.

### G4 — Screen-aware assistant and useful integrations

- State plus screenshots identify what the user actually sees in mirror, camera/AR, watch and managed/native desktop views. Check orientation, scaling, display selection and stale observations.
- Observe, act once, then inspect the visible result. Test opening/searching, typing, scrolling, application/media control, screen layout and wardrobe operations with useful multi-step journeys.
- Concurrent conversation does not lose agent task ownership; Stop/mute/navigation cancel work with no late input. Offline/sign-in/provider/tool errors remain recoverable and preserve useful drafts.
- Audit tool breadth against the user's intended tasks and actual integration constraints. Explain unsupported tasks and action/time limits; avoid fabricated success or invisible repeated clicks.
- Account sign-in is completed directly by the user when needed. Shared-location answers preserve timestamp/accuracy and distinguish last-known from live. Find Devices is not Find My People. A real friends map requires an available, authorized source; unsupported Apple People access must stay clearly unavailable.

### G5 — Music, watch and phone connection

- On Windows, signed-in local Spotify supplies real playback state and song/artwork to the selected ambient view. Play/pause/next/previous operate the correct local session; TV audio is heard. A web page opening is not playback success.
- Ambient player views handle no session, app closed, paused, metadata/artwork changes and offline media gracefully. Conversation/music ducking restores the intended volume/session without unexpected restarts.
- YouTube search/selection/play/pause/seek works in the installed app. Watch layout, captions, gestures, controls and compact avatar remain usable together.
- At least one clearly supported phone route connects and plays on the final device, with disconnect/reconnect and buffering checks. QR/media-link/DLNA/Windows handoff must be labeled accurately; do not claim unimplemented AirPlay/Chromecast or all DRM services.

### G6 — Intuitive controls and calibrated parallax

- Document a small consistent gesture vocabulary, feedback and cooldowns. Verify detection and false activations at TV distance, with mirror preview and comfortable motion.
- Editor gestures own editor actions; they cannot unexpectedly alter background clothes/media. Stop remains easy and global. Typing never triggers global shortcuts.
- Physical top-camera calibration gives stable, correctly directed head parallax. Toggle off fully removes it. Camera off/missing face uses an honest stable fallback.
- Multiple faces/hands, occlusion and entering/leaving cannot produce disorienting jumps or uncontrolled commands.

### G7 — HD, responsiveness and efficiency

- Preserve real source detail and aspect ratio; show negotiated camera/display capability. Quality profiles bound pixel counts, geometry, tracking work and cadence. Do not equate 4K requests or exports with 4K capture or live performance.
- Sleep/hidden draw zero scene/avatar frames; disabled camera/tracking/agent work shuts down its relevant resources. Wake/audio clocks are measured separately rather than excluded from whole-process cost.
- Settled poses reuse their surface. No duplicate invisible GLB renders, unbounded workers/bitmaps, runaway queues or repeated model loading. Repeated mode/persona/camera changes show stable resource use.
- Establish a standalone, repeatable before/after benchmark for portrait versus rig, presets, speech/idle/gaze, AR and depth. Initial engineering target: reduce the reproduced active software-rig CPU cost by at least 30% while preserving the agreed visual motions.
- On final hardware target a stable 30 fps baseline active experience at 1080×1920; 60 fps is the accelerated detail target where supported. Record frame-time distribution, long tasks and input latency; lower quality gracefully instead of freezing. Higher-resolution TV rendering must be separately measured.
- Test combined camera/voice/AR and media workloads, not only camera-off modes. Report process-tree CPU, memory and actual device measurements separately; device-wide GPU readings cannot be attributed to this app.
- Fresh-profile and offline startup, missing/slow models, renderer/context loss, corrupted settings and unsupported camera constraints recover cleanly. A frozen release candidate completes an eight-hour soak without exceptions, stalls, late canceled effects or progressive resource growth.

### G8 — Deliverable and final installation

- Coherent changes, tests, visual evidence and progress are committed/pushed. Each result identifies the exact source revision/archive and fixture versus real integration scope.
- Compare the branch with remote main and reconcile useful browser/media/outfit features deliberately without losing tested lifecycle behavior. Record what was adopted or remains intentionally separate.
- Rebuild the Windows package from the final source; audit bundled assets, startup scripts and clean-profile first run. Old ZIP integrity is not proof of new feature delivery.
- On the actual PC stick/portrait TV verify launch, display/GPU, camera, microphone/TV speakers, local Spotify, computer input, supported phone connection, network/reconnect and sustained combined performance.
- Close every required gate with evidence. External hardware/account gates remain open until available; their absence does not stop independent local work. Optional unavailable service integrations receive truthful capability states instead of fabricated implementations.

## Work order

| Stage | Concrete work | Exit evidence |
| --- | --- | --- |
| A — analysis and baseline | Establish this goal; summarize completed/active monitors; reproduce rig cost in isolation; prioritize defects and stale documentation | Saved plan, benchmark conditions, current evidence ledger |
| B — avatar and efficiency | Closed side volume and jaw continuity; improve hair/crown/lids/interior; better speech shapes/timing; reduce geometry/draw/idle work; adapt profiles without breaking controls | Reviewed neutral/turn/expression/speaking clips, comparative timing/CPU, lifecycle regressions |
| C — wardrobe and camera | Simple scan guidance and ingestion; improve sleeves, surface coverage and occlusion; replay matrix; same-frame HD/power checks | Native saved-photo journeys, replay images/metrics and failure recovery |
| D — integrated experience | Voice interruptions/captions; broader screen/agent journeys; media and ambient views; gestures/parallax; useful main-branch reconciliation | Real available-service tests plus explicitly scoped fixtures, combined-mode audit |
| E — release preparation | Consolidate defaults/help/status, rebuild Windows artifact, package audit, frozen eight-hour local soak | Matched build/evidence, installation checklist, unresolved external gates |
| F — final device validation | Physical Windows stick/TV, sensors/audio/accounts/phone and performance | Installation evidence for G1–G8; goal complete only after required gates close |

Independent fixes may cross stages. Do not wait for Windows while actionable local work remains.

## How to keep progressing

1. At each continuation read this plan and current goal, inspect Git/monitor state and resume the next unfinished item. Keep prior decisions and accepted corrections.
2. Reproduce a defect and identify its ownership before changing code. Use actual runtime/visual review alongside focused tests; a successful fixture is not production proof.
3. Compare changed behavior with a defined baseline. Save brief quantitative results and representative images/clips; record failures as well as passes.
4. Commit/push reviewable checkpoints. Monitor immutable copied builds with no incidental live-provider calls; summarize completed runs before launching replacements.
5. Update the ledger below and the completion audit. Distinguish implementation, fixture checks, real local service checks and physical installation checks. Never mark completion from exhausted effort, a quiet monitor or an attractive still.
6. Communicate material findings and changes of direction. Request only information that truly blocks dependent work, while continuing independent tasks.

## Progress ledger

- **Baseline delivered:** `c7fc732`; selectable 3D preview, HD/theatrical effects and earlier wardrobe/agent/media work.
- **This analysis:** original request and current subsystem/evidence review completed; comprehensive suite goal activated. Physical camera absent; Windows intentionally later. Software-rig CPU concern identified from frozen samples.
- **Next actionable task:** standalone rig/portrait benchmark with controlled activity and presets, then address the largest measured cost together with side-volume/hair/speech refinements. Do not add detail without measuring its cost.
- **Ongoing development monitor:** an eight-hour isolated rig-preview soak started at 2026-10-09T03:23:39Z (October 8 locally), with a matched audited archive. At the saved snapshot, 19 samples had zero errors. This is running, not completed, and does not qualify the release or physical-service gates. Log: `artifacts/monitor-master-goal.log`.
- **Still open:** all completion gates above; evidence exists for portions, but none establishes full installed-system completion.
- **Monitor snapshot:** HD build finished two hours, 2,335 samples, zero errors. 3D build subsequently finished two hours with 2,350 samples and zero errors; the earlier performance discussion identifies its first-review snapshot. Detailed immutable-build records live under `artifacts/monitor`; this is not a new feature verification.

The goal tool and this file describe the same objective. If future user steering changes scope or priorities, record that change here and preserve the remaining authorized work.
