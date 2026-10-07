# Mirror completion audit

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

Flat views now cache the room scene while animating the face separately; short development checks show a large renderer CPU reduction and no repeated flat scene draws. The prior 30-minute muted camera-off monitor finished with zero recorded errors. Whole-process PC-stick efficiency, physical input testing, and reconciliation with remote main remain outstanding.
