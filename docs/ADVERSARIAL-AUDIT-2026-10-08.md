# Local adversarial audit — October 8, 2026

This audit runs on the current Linux arm64 machine. It does not require Windows
access. Tests use the actual packaged app, Chromium mouse/keyboard input, and
real services where stated. Physical sensors are absent; synthetic inputs and
fixtures are explicitly scoped below. Passing a fixture is not a completed
production integration or realistic moving try-on.

## Findings fixed

1. **Landscape previews broke the portrait UI.** Typography and panel widths
   used the desktop viewport even though the shell was narrower. Watch spilled
   off-screen; clock/weather overlapped; mode controls exceeded the surface.
   Descendants now use the portrait container width and container breakpoints.
   Time and AM/PM are separate elements. Narrow Watch/wardrobe panels scroll.
2. **Photo Save obscured fields.** The sticky disabled button was translucent
   and scrolled over the name input. It is now opaque, with scroll padding for
   the sticky voice and Save controls. Actual mouse input reaches the name field.
3. **Fallback offered nonexistent typing.** Command Center now has Ask the
   mirror. Connected live voice handles typed questions; otherwise the installed
   Codex can perform the task. Errors are shown honestly, with no fabricated demo
   answer. Stop/mute cancellation gates late output. A muted submission retains
   its draft; only an accepted submission clears it.
4. **3D claimed tracking with camera off.** Its feedback now distinguishes
   camera off, looking for a face, and actual detected head tracking.
5. **Device locator was presented as friends access.** The launcher now says
   Find Devices. Mirror state and both agents state that Find My People has no
   configured bridge. A friends request explains the missing capability.
6. **Account prompts could reach screen/input tools.** Fixed isolated-world
   browser inspection pauses capture/input for visible passwords, OTP prompts,
   recognized sign-in forms/URLs, and known authentication iframes. Main process
   checks before and after capture. A sign-in appearing after a screenshot blocks
   pending input without changing the password field. This applies to the managed
   browser; arbitrary native OS credential dialogs remain unverified.
7. **Software 3D rendered too often.** Software WebGL limits room updates to
   15 FPS; hardware retains 30. Dirty changes draw immediately, while flat caches,
   sleep and hidden states retain their behavior. One short renderer-only check
   measured roughly 98% CPU before and 60% after, with room draws around 10.5/s
   after. This is not a controlled hardware power benchmark or a wattage claim.
8. **Malformed media URLs exposed a JavaScript error.** Watch now asks for a
   complete media link instead of showing the URL constructor error.

## Tests and gaps

| Requested capability | Current-machine evidence | Still unproven / unfinished |
|---|---|---|
| Wake, swirling reveal, queen voice, live conversation | Actual packaged Vosk + real Gemini Gacrux, synthetic WAV microphone; greeting and conversation passed | Physical microphone/speaker acoustics and echo |
| Immediate stop, wake-only resume, hard mute | Real journey: ordinary speech ignored after Stop; wake restored speech; hard mute removed live mic tracks and silenced playback. Local response after recognition ~2.4 ms; complete phrase-to-stop ~1.12 s | Physical noisy-room recognition |
| Two colored caption rows | Real voice streamed interim heard text, corrected transcript, spoken text; long-row UI audit passed | Full acoustic conditions |
| Agent sees and acts on screen | Real Codex inspected local fixture, clicked the shuffled target exactly once, read random result; cancellation and account IPC passed | Production signed-in accounts and native Windows input |
| Typed agent task | Actual Command Center input -> Codex -> synthetic map answer, preserving age and accuracy | Windows executable discovery and local speech voice availability |
| Local AR wardrobe | 30 starters, eight stored photo garments, paired front/back originals, local extraction, interpreted gesture/voice commands, LAN photo ingestion passed again | Realistic cloth, continuous side/back coverage, accurate sizing, physical camera/gesture behavior |
| Face/body/hand tracking | Actual bundled workers returned 478 face, 33 body and 21 hand landmarks from public photos | Real camera placement, occlusion, people entering/leaving, real gesture error rate |
| 3D/parallax | Projection unit tests, actual toggle/render/sleep checks, software scene governor | Physical head tracking and Windows GPU/PC-stick wattage |
| Watch/media | Real YouTube play/pause/seek; browser click/type/scroll; cast protocol/player/phone fixtures | Native AirPlay/Chromecast, real phone casting, signed-in DRM streaming |
| Spotify ambient player | Actual UI with synthetic Windows media-session and device fixtures; backend unit checks | Actual signed-in Spotify account and Windows Spotify runtime |
| Find My friends live map/questions | Apple capability research; real Codex answered a synthetic stale map through actual typed UI; sign-in/capture boundary passed | Apple-device bridge, account sign-in, shared friends data and live map updates |
| Persona appearance | Queen/Snow/Advit rest/AA production-performer screenshots inspected; no extra neck/body or duplicate mouth visible in these samples | Full speech animation quality; these are 2D image performers, not finished 3D memoji rigs |

The UI audit uses 1280×1024, 400×710, 540×960 and 1080×1920 viewports. It checks
all four mode buttons, panel/control bounds, actual settings access in every
mode, malformed URLs, typing without global shortcuts, two caption rows, editor
Stop, muted draft retention and honest friends capability feedback.

Evidence files: `ADVERSARIAL-UI-VERIFICATION.json`,
`ACCOUNT-IPC-VERIFICATION.json`, `BROWSER-ACCOUNT-VERIFICATION.json`,
`LOCATION-QUESTION-VERIFICATION.json`, `POWER-GOVERNOR-VERIFICATION.json`, and
`VOICE-AUDIT-VERIFICATION.json`. Screenshots and detailed run logs remain under
`artifacts/`; full `npm test` passed after the implementation changes.

## Friends map path

[Apple's current device-location guide](https://support.apple.com/en-asia/guide/icloud/mmfc0f2442/1.0/icloud/1.0)
describes iCloud.com Find Devices. Its
[friend-location guide](https://support.apple.com/en-gb/guide/iphone/ipha24eb4a37/ios)
uses Find My on an Apple device. The old web Find My Friends documentation must
not be treated as proof of a current Windows web connector. Apple-ID browser
login alone has not been established as a supported Find My People path.

A Mac/Apple-device bridge needs an available device, user-completed sign-in and
an observed shared-location source; it is not installed or certified here.
A supported browser alternative is
[Google Maps Location Sharing on desktop](https://support.google.com/maps/answer/15437054?co=GENIE.Platform%3DDesktop&hl=en):
users can choose a person who shares location with them. The existing persistent
browser and screen tools can work on the visible signed-in page, but no actual
shared account has been supplied or tested. Agents now must preserve timestamps,
last-seen labels and accuracy, and never turn stale positions into current ones.
Location information must not be stored as durable personal memory.

## Monitoring

The previous frozen paired-photo monitor completed 30 minutes, 589 samples,
zero errors. The next frozen harness build monitor continues independently of
rebuilds. Its software-rendered active CPU remains high; it predates the new
15-FPS room governor. Monitor records contain an archive hash and revision,
no account credentials or display images. Short renderer measurements exclude
other processes; process-tree CPU and summed RSS are not full-device wattage.
The original goal remains incomplete; these findings and tests are progress.
