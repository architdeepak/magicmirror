# Mirror completion audit

Current full-suite review: [priorities and continuation contract](SUITE-REVIEW-2026-10-09.md). Latest camera detail checkpoint: [native clarity](CAMERA-CLARITY-NATIVE-2026-10-09.md). All G1–G8 remain open.

Mouth follow-up: [distinct speech poses and dental interior](MOUTH-SHAPES-2026-10-08.md). Live phoneme accuracy and production art quality remain open.

Playback follow-up: [mouth motion follows output, queued tails and Stop](PLAYBACK-SYNC-2026-10-08.md); phoneme/anatomy and physical validation remain open.

Latest follow-up: [Watch avatar and media framing](WATCH-AVATAR-LAYOUT-2026-10-09.md). [Accelerated workload and watch audio ownership](GPU-WATCH-AUDIO-2026-10-09.md). [Combined workload and audio resource ownership](COMBINED-AUDIO-2026-10-09.md). [Torso coverage allowance and matched replay](TORSO-COVERAGE-2026-10-09.md). [Personal long sleeves and partial tracking](LONG-PHOTO-SLEEVES-2026-10-09.md). Mirror/occlusion baseline: [garment motion](GARMENT-MOTION-2026-10-09.md). Originals: [full-resolution photos and safe re-editing](FULL-PHOTO-ORIGINALS-2026-10-09.md). Software rendering evidence: [lighting and first-speech preparation](SOFTWARE-RENDERING-2026-10-08.md). Full suite remains incomplete.

Comprehensive active objective and acceptance gates: [master goal](MASTER-GOAL.md). Historical passing checks below are partial evidence; the master goal remains incomplete.

2026-10-08 rig update: [selectable 3D Queen/Snow preview with actual local morphs, independent eyes and solid hair/crown](3D-FACE-2026-10-08.md). It is not a completed production facial asset or physical Windows validation.

2026-10-08 HD update: [bounded high-resolution surfaces, time-based acting, GPU smoke and full-resolution camera preservation](HD-FLUIDITY-2026-10-08.md). Physical performance and the full suite goal remain unverified.

2026-10-08 visual revision: [dark glass, advected smoke, face-following glow and textured eye/brow/mouth acting](GLASS-AND-EXPRESSIONS-2026-10-08.md). Local visual/voice checks remain distinct from physical Windows installation readiness.

2026-10-08 experience update: [framing, theatrical reveal, local lookbook, favorites, routines, notes and timers](MAGIC-EXPERIENCE-2026-10-08.md) are implemented and exercised locally. Physical inputs, Windows Spotify/runtime, moving cloth realism and Apple People remain unfinished.

2026-10-08 update: [camera/photo clarity and avatar rendering audit](CAMERA-CLARITY-2026-10-08.md). Local enhancement, exact original restoration, separate front/back drafts, doubled starter SVG rasterization, speech-level mouth blending and common feature transforms are implemented. The full goal remains incomplete; cloth simulation, physical inputs, Windows runtime and Apple People integration still need work.

Reviewed 2026-10-06 (Pacific time). The full user goal remains incomplete.
Evidence below distinguishes implemented software from the requested experience
on a portrait TV and PC stick. The referenced `artifacts` files are local,
ignored verification outputs; they are not included in the application package.

| User requirement | Evidence inspected | Remaining proof or work |
| --- | --- | --- |
| Sleep, “mirror mirror,” magical reveal, queen greeting | `artifacts/voice-journey/result.json`: packaged reveal and real Gemini Gacrux; `artifacts/wake-word/result.json`: actual Vosk recognition | Physical room speech, speaker echo, wake accuracy and TV presentation |
| Normal live voice conversation | Voice journey: synthetic WAV through a MediaStream, real transcription/audio response | Physical microphone/speaker latency, accents and sustained conversation |
| Immediate Stop until wake; hard mute; visible Listen/Stop | Voice journey: output RMS drops to zero, local stop handler 2.6 ms after recognition, standby gate and microphone cleanup | Recognition from acoustic phrase onset was about 1.29 seconds in the latest synthetic run; installation responsiveness remains unverified |
| Two bottom caption lines, different heard/said colors | Voice journey: two caption rows, distinct colors, interim captions and server correction | Legibility at TV viewing distance and in every physical display configuration |
| Agent sees the displayed state and uses tools | Actual Gemini preview-color check; packaged live computer click, Unicode form, scroll and double-click checks | These controlled local tasks do not prove autonomous reliability on arbitrary sites; Windows native runtime remains unverified |
| Native apps, desktop, Spotify, YouTube | Win32 input bridge compiles; actual managed-browser inputs; `artifacts/youtube-live/result.json`: real YouTube playback/pause/seek | Actual Windows apps, sign-in/DRM compatibility, authorized Spotify account and playback device |
| Assistant repositions when displaying content | Companion region checks, packaged portrait computer checks; voice tool fixture changes avatar position | Native window stacking and avatar/caption layout on the installation |
| Realistic moving try-on, spoken clothing changes | Local mesh implemented; optional Decart SDK/token/video lifecycle and voice routing; `artifacts/live-tryon-ui/result.json` explicitly uses simulated cloud transport | Real generated video, garment fidelity, motion/occlusion quality, latency and actual voice garment changes with the provider. Local mesh and stills do not satisfy moving realism. RTV candidate failed quality review (`NEURAL-TRYON.md`) |
| Intuitive gestures throughout | Production gesture routing/unit coverage; actual MediaPipe hand photo produces 21 landmarks and a palm action | Real swipe/pinch/hold sequences, false activations and TV-distance usability across modes |
| Toggleable 3D head parallax | Geometry/calibration tests; actual face worker produces 478 landmarks and head state | Physical top-mounted camera alignment, head-motion response and comfort |
| Watch mode / phone casting | Real YouTube check; actual local decoded cast media and UPnP receiver checks | Actual phone interoperability. Media-link sending/DLNA and Windows Wireless Display handoff are implemented; native Chromecast/AirPlay protocols are not |
| Good song playback and ambient Spotify views | Local classic/pocket views; Windows local Spotify media-session bridge; token/control/device selector tests | Real Windows local app/session playback and TV audio; optional Web API authorization/transfer; view behavior during music |
| Runs on the intended PC stick | Packaged Linux ARM64 startup/workers verified; Windows x64 ZIP integrity/assets audited | User confirmed a Windows PC stick; model/access, installation, Windows execution and sustained portrait performance |

## External state

This development host is Linux ARM64. No `/dev/video*` camera device was found.
The user confirmed the target is Windows and expects playback in the local Spotify app.
The checkout's `.env` has a Gemini key; it has no Decart key, Spotify client ID,
or custom try-on renderer URL. This check does not inspect another machine's
saved connections or establish account authorization. Do not paste secrets
into reports; configure them through mirror Settings.

## Current deliverable

`dist/Reflect Mirror-1.0.0-win.zip` contains the kiosk/settings launchers and
application. It is unsigned. An archive check establishes packaging integrity,
not that the Windows app or hardware experience works. Installation instructions
are in `release/windows/README.txt`.

Completion requires closing the remaining proof/work column against the original
scope. Successful isolated checks must not be used to claim that the full mirror
experience has been achieved.

## Latest interactive verification

Actual portrait UI exploration found and fixed Settings being covered by Watch.
Fresh startup exposed an external wake-model download stall: the English model
is now bundled, with a bounded loader and worker-error handling. Clean-profile
Vosk recognition and the full real Gemini voice journey passed with synthetic
audio. Cast/settings integration additionally verified immediate clearing of
saved key fields. See `artifacts/exploration/REPORT.md` for detailed scopes.
These findings demonstrate why earlier passing checks were insufficient to
claim complete installation readiness.

## User-directed local audit stage

The user explicitly deferred Windows access until the end and requested an
adversarial audit on this development machine, plus alternatives to expensive
try-on APIs. Windows access is not a blocker for this stage.

The local audit found continuous scene rendering during sleep, invisible GLB
and staged rig draws, external camera-model loading failures, small captions,
misleading muted-startup wake text, a hard-edged Snow speech patch, and an
additional Advit mouth. These have been changed and exercised locally.
See `LOCAL-AUDIT.md` for actual runtime/CPU evidence and its limits.

FASHN VTON 1.5 successfully generated outfits offline on public author images,
without a paid API. The measured 10–17.6 second still-image inference does not
satisfy realistic moving camera try-on. It is a local candidate under evaluation,
not a completed live feature or part of the current Electron package.

## Local AR wardrobe update (2026-10-07)

The user chose a local AR approach. The photo editor, camera still capture, paired phone photo ingestion, thirty bundled starter garments, voice tool actions, and editor gesture routing are implemented and verified in the packaged Linux app. See `AR-WARDROBE.md` and `AR-WARDROBE-VERIFICATION.json`. Physical camera/gesture behavior, prepared 3D cloth, realistic moving garment fidelity, and Windows installation remain unproven. The previously built Windows ZIP predates these changes and must be rebuilt before delivery.

Offline worn-photo clothing extraction now uses the bundled MediaPipe model in a disposable worker, with original colors retained, cancellation/timeout handling, top/bottom cropping, voice trim commands, and interpreted vertical swipe cropping. Two real-photo worker checks and the packaged seven-garment persistence workflow passed. The mask includes all clothes; crop/review is required. This does not reconstruct obscured fabric or provide 3D fitting. See `PHOTO-CLOTHING-VERIFICATION.json`.

Outline-derived short sleeve fitting now applies to recognizable uploaded tops. A recorded moving-person replay exposed camera/pose misalignment and stale fit gaps; exact analyzed frames now underlie their garment and mask, software graphics select CPU pose inference, and slow CPU masks are sampled between fresh poses. The 20-second recorded replay passed its over-80% visibility gate at 93.5%, and cleared on blank/camera-off input. See `PHOTO-FIT-MOTION-VERIFICATION.json` and `PHOTO-SLEEVES-VERIFICATION.json`. Reviewed output still has side/proportion/fabric shortcomings. This is progress toward the requested try-on, not proof of realistic moving clothes or accurate sizing.

The worker now also forwards complete finite world landmarks. Recognizable photo tops use an estimated curved front surface driven by shoulder/hip depth, with flat fallback for unusable estimates. `WORLD-POSE-CURVATURE-VERIFICATION.json` records an actual 20-second offline moving-person check: 564 of 608 display ticks visible, all 20 observations with 33 world landmarks, and 19 observations reporting a curved visible torso. Same-frame flat/curved comparisons were visually reviewed. A new all-coordinate seam test found and fixed a sleeve/torso depth mismatch. Full cloth, shoulder/back coverage, physical fitting, and sizing accuracy remain unproven. Personal front/back ingestion was added in the follow-up below.

Personal front/back ingestion is now implemented: optional back view, independent cutout/crop drafts, voice/gesture switching, native validation and four-file persistence, and paired reload. Synthetic orientation tests exercise distinct-frame hysteresis, missing-back clearing/recovery, different rear texture output, and raster invalidation. The packaged eight-garment workflow passed, and the real front-facing replay retained over 80% visibility. This does not verify rear-facing recognition on a real person or continuous sewn side/back geometry. Cloth behavior, physical fitting, Windows runtime, and reconciliation with remote main remain outstanding.

Flat views now cache the room scene while animating the face separately; short development checks show a large renderer CPU reduction and no repeated flat scene draws. The prior 30-minute muted camera-off monitor finished with zero recorded errors. Whole-process PC-stick efficiency, physical input testing, and reconciliation with remote main remain outstanding.

## Assistant harness integration (2026-10-07)

Codex delegation now uses the existing screenshot/input/wardrobe callbacks. The
real installed Codex completed a local packaged-app task using actual display
screenshots and one Chromium activation, then read a randomized visible result.
Packaged Stop/hard-mute controls cancelled a synthetic delayed task without late
input. See `ASSISTANT-HARNESS.md` and its verification JSON files for scopes. This
is a selective port from remote main, not a full reconciliation of its embedded
browser/media, multi-slot outfits, or clap/face navigation. Live audio still uses
Gemini; local AR remains independent of paid generative APIs. Windows runtime,
physical inputs, realistic cloth and full-device efficiency remain outstanding.

The paired-photo build's frozen monitor is running separately from subsequent
rebuilds. Early samples show no errors, sleep around 5% process-tree CPU, and
active software-rendered AR around 110–135% process-tree CPU. These are development
observations, not a PC-stick power or wattage claim; active-view efficiency still
needs work. Its final report must be checked when the run finishes.

## Adversarial UI/account audit (2026-10-08)

See `ADVERSARIAL-AUDIT-2026-10-08.md` for fixes, actual tests and remaining proof.
The audit repaired portrait-container scaling, clock/weather overlap, scrolling
behind photo Save, misleading camera-off depth feedback, absent typed input and
raw media URL errors. Typed Command Center requests now use the connected voice
host or Codex with honest failure/cancellation. Account prompt detection is
checked through actual packaged capture/input IPC. Find Devices is correctly
labeled; no Find My People bridge is configured. A real Codex typed task read a
synthetic stale map and preserved its age/accuracy/current-unavailable status.

Real Gemini wake/conversation/stop/caption and YouTube play/pause/seek checks
passed again on this machine. Physical sensors, actual signed-in Spotify/Apple
accounts, realistic cloth, native phone screen mirroring and Windows remain
unproven. Software 3D now has a 15-FPS room governor; short renderer CPU fell from
roughly 98% to 60% in this check, without establishing whole-device efficiency.
The prior paired-photo 30-minute monitor finished with 589 samples and no errors.

The frozen pre-audit harness monitor also completed 30 minutes with 583 samples
and no recorded errors. A fresh frozen audit build (`5d479ab`) is running a
two-hour monitor with no paid services or physical sensors. Its start snapshot
is saved in `MONITOR-AUDIT-VERIFICATION.json`; completion is not claimed.

- **Iris detail checkpoint:** [bounded shared local iris surface detail](IRIS-DETAIL-2026-10-09.md), reviewed with rejected bright prototype, native/software continuous acting, replacement disposal and recorded speech playback. Stylized anatomy, hidden-rig retention, natural phoneme accuracy and all full-suite gates remain open.

- **Hair-root checkpoint:** [curved roots and forehead framing](HAIR-ROOTS-2026-10-09.md), with rejected thick-cap prototype, matched final archive, native/software continuous acting and real playback regression. Adds 1,344 triangles without extra draws. Hair remains stylized; all suite gates remain open.

- **Raised-shoulder checkpoint:** [bounded per-arm shoulder rise](RAISED-SHOULDERS-2026-10-09.md), preserving shared roots, neckline/hem and wrist binding. Actual raised-arm frozen replay and final packaged lifecycle pass; side coverage, texture stretching and realistic drape remain open. Previous Natural camera monitor completed 579 samples/zero errors on its older archive. All suite gates remain open.

- **Photo camera cancellation checkpoint:** [owned startup signal](PHOTO-CAMERA-CANCELLATION-2026-10-09.md) prevents late permission from opening a canceled photo camera after Stop/mute/close. Actual baseline fails all three; final package passes with zero late tracks and preserved already-active camera. Full tests, portrait UI/wardrobe and fixture agent/media regressions pass; physical inputs, broad real-model tasks and all master gates stay open.

- **Streaming-caption checkpoint:** [raw deltas, interleaved rows and assembled Stop](STREAMING-CAPTIONS-2026-10-09.md). Actual packaged baseline reproduces spacing/repetition/row-loss/unbounded card and split-Stop failures; final parser/DOM, full tests, UI and playback regressions pass. Actual provider/acoustic timing and cross-turn ordering remain open. All master gates remain open.

- **YouTube conversation-volume checkpoint:** [owned ducking and explicit watch volume](YOUTUBE-DUCKING-2026-10-09.md). Actual public player reports 80→20→80; explicit 45 and same-valued 11 survive Stop, paused playback stays paused. Direct/cast waveform, full tests and four-viewport packaged UI pass. Physical audio, native Spotify and all full-suite gates remain open.

- **Codex Watch checkpoint:** [shared player controls and actual installed-agent task](CODEX-WATCH-2026-10-09.md). Codex set public YouTube volume to 37 and paused it; independent player state confirmed both. Packaged shared-tool playback/ducking and full tests pass. Broad autonomous tasks and all suite gates remain open.

- **Watch source-ownership checkpoint:** [invalid-link control preservation](WATCH-LOAD-OWNERSHIP-2026-10-09.md). Actual public YouTube baseline loses its bridge; final package preserves source/ready/volume and subsequent real Codex controls. Pending-load/stale-error tests, full suite and four-viewport UI pass. All full-suite gates remain open.

- **Hair-dome checkpoint:** [rounder latitude-sampled upper roots](HAIR-DOME-2026-10-09.md). Reviewed Snow/Queen contour and continuous native/software motion; real PCM and full tests pass. Rejected fiber shading removed. Adds 768 triangles with no extra draws/materials/textures; all full-suite gates remain open.

- **Wake-flow checkpoint:** [curved local swirl and native dither repair](WAKE-FLOW-2026-10-09.md). Visual review exposes a diagonal native defect missed by initial green checks; packaged baseline has 11 black visible samples, final has zero. CPU/native clips, real Stop/mute clicks, reduced motion and full tests pass. Isolated CPU cost rises ~1.2 ms/frame during the brief cue; physical timing/power and all suite gates remain open.

- **Reveal controls checkpoint:** [fog beneath voice UI and readable status](CUE-CONTROLS-2026-10-09.md). Opaque diagnostic reproduces complete button/caption/status obscuration at two portrait sizes; final retains visibility and actual Stop/mute clicks. Native animation, four-size UI and full tests pass. Physical contrast/acoustics and all suite gates remain open.

- **Agent fit/progress checkpoint:** [shared fitting tool and owned progress retirement](AGENT-FIT-2026-10-09.md). Installed Codex selects Blue t-shirt, sets 1.2/0.9/−0.08, and reports unavailable physical visibility honestly; independent sliders/state confirm. Screenshot exposes a stale completed-task banner, reproduced on baseline and fixed in final task. Reset/view/consent/cancellation and full tests pass; all suite gates remain open.
