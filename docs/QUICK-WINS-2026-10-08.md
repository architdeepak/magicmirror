# Mirror quick wins: product and implementation review

Implementation update: all ten quick wins below now have a local implementation. See [the magic experience implementation and audit](MAGIC-EXPERIENCE-2026-10-08.md) for current behavior, test evidence and remaining limits. The original review below explains the choices; findings describe the pre-implementation state.

## Recommended order

| Order | Addition | Experience | Relative effort | Existing foundation |
| --- | --- | --- | --- | --- |
| 1 | Save the look you actually see | “Take a look photo.” Three-second countdown, clean clothing/camera image, retake, local lookbook | Small–medium | Synchronized camera canvas, clothing/effect canvases, local image persistence |
| 2 | Favorites and quick recall | “Favorite this.” “Show my favorites.” “Try my blue jacket.” Fewer swipes through the growing wardrobe | Small | Closet IDs, persistent selection, name matching and local voice routes |
| 3 | Useful weather and leaving card | Next few hours' rain/feels-like temperatures; explicit forecast age; a user-set leaving countdown | Small–medium | Existing Open-Meteo request, clock, local note card |
| 4 | Gesture progress and framing guide | A ring fills as a held palm/pinch activates; “step back” guide appears when shoulders/hips are cropped | Small–medium | Hold timestamps, current gesture status, body visibility and portrait projection |
| 5 | One-phrase routines | “Getting ready” selects a mode, clarity preset, favorite garment and music view; “movie time” opens a chosen media shortcut | Medium | Display/wardrobe/media callbacks and existing local state |
| 6 | Compare two saved looks | Save A and B, show side by side, swipe between them and full-screen; annotate a favorite | Medium | Lookbook from item 1; static image views require no second tracker |
| 7 | Voice notes and countdowns | “Leave a note: take the umbrella.” “Ten-minute getting-ready timer.” A discreet bottom badge | Small–medium | Local quick note, clock, text/voice command routing |
| 8 | Contextual help | “What can I do here?” Brief guidance for the current mode, not the entire manual | Small | Display state, caption/oracle cards and existing command/gesture mappings |
| 9 | Understandable agent progress | “Finding your video,” “Opening the page,” “Waiting for you to sign in”; visible Stop | Small–medium | Agent tool dispatch, cancellation and browser auth boundary |
| 10 | Polished queen reactions | Short acknowledgements, a restrained wake chime and brief loading/rune transitions; option to reduce motion and sound | Small–medium | Existing reveal, persona performer, local sound playback and UI states |

“Small” is a relative implementation estimate, not a delivery promise. Music routines still need real Windows Spotify playback validation. New microphone phrases need actual recognition checks, not only routing fixtures.

## Findings that change priorities

### Saved local try-on samples do not currently save the visible outfit

`renderer.js` captures the raw camera for the existing provider/sample queue. That is appropriate as provider input, but is not a lookbook screenshot: it omits the displayed garment, effects and synchronized clarity view. Add a separate local “Save look” path built from the exact synchronized camera canvas plus clothing/effects; keep provider input original. `selectAssistantVision` already demonstrates that composition. Capture should decline or wait if pose/bitmap is stale, rather than save a floating garment against a newer camera frame.

Start with explicit voice/button capture and countdown. Do not silently collect photos. Stop/retake cancels pending captures. A phone download option can reuse pairing concepts, but outbound photo transfer is new work; current phone wardrobe upload does not provide it.

### Weather can become stale

`MagicMirrorView.fetchWeather()` runs at construction and when changing city. There is no periodic refresh or resume refresh. Fix this before promising an all-day forecast card: bounded refresh, fetch timeout, selected-city request ownership, last-updated text, and an honest unavailable/stale state. Temperature should never become `NaN°` on a malformed response. City selection currently feeds the dashboard directly; review persistence too.

Open-Meteo documents hourly apparent temperature and precipitation probability. Those support a practical “bring a layer/umbrella” card without a new generative model. These should be forecasts with timestamps, not guaranteed conditions. [Official forecast documentation](https://open-meteo.com/en/docs).

### Gesture feedback can improve without adding gestures

The recognizer already has hold/rearm logic. Expose its progress visually and show only the actions available in the current mode. Keep existing palm Stop, pinch and swipe meanings consistent. Avoid adding overlapping gestures or treating arbitrary movement as a command. Framing guides should follow the actual mirrored portrait crop and say when input is unavailable. Confidence is tracking confidence, not clothing fit accuracy.

### Active efficiency still needs work

The frozen `5d479ab` monitor had zero recorded errors at minute 65, with active portal roughly 103–104% of one CPU core. It is muted/camera-off, uses software rendering, excludes this turn's proposals and is not a wattage measurement. Do not add constant particles, a second model or a second video capture loop.

Review `AROverlay.render()`, which clears its canvas before checking whether AR is enabled. Cache/clear once when it hides. Also inspect hidden depth updates and DOM/style work in the common animation loop. These are optimization candidates, not measured causes of the observed total CPU. Confirm CPU changes with the complete process tree, not renderer-only timing.

## Product details that make these feel complete

- Commands for everyday actions run through a common local action dispatcher for voice, typed requests and gestures. No model turn is needed merely to favorite a garment or start a countdown.
- A routine reports actual results. If Spotify is unavailable, show that and continue the remaining configured steps. Never announce music playback from an app-launch success alone.
- Stop cancels queued routine steps, photo countdowns and tool work. Hard mute never gets overridden by a routine. Timer expiry can show a silent badge when muted.
- Save per-user defaults only when explicitly chosen. Start with a single local profile; face-based automatic identity is separate work.
- Saved comparisons show captured time and selected garment. They do not claim accurate size, hidden material or simulated drape.
- Timers store an absolute deadline and reconcile after system resume; `setTimeout` alone is insufficient for a sleeping PC. Electron exposes suspend/resume events. [Official powerMonitor documentation](https://www.electronjs.org/docs/latest/api/power-monitor).
- Reduce-motion mode retains a clear wake transition and feedback while reducing continuous animation. Sounds are short, adjustable, and respect Stop/mute behavior.
- Camera setup can display the actual negotiated resolution rather than assuming the requested value was delivered. The camera API exposes current track settings. [MDN getSettings documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings).

## Larger ideas to keep separate

Photorealistic moving fabric, complete side/back geometry, genuine 3D speaking avatars, automatic wardrobe measurement, multiple layered garments, native AirPlay/Chromecast, calendar synchronization and Apple Find My People are substantial integration/research work. The quick wins above can be useful while those remain unfinished. Remote main already contains some outfit/browser work; reconcile it deliberately before building duplicate systems.

## Suggested next batch

1. Correct local look capture and add a small lookbook.
2. Add favorite garments and exact name recall.
3. Fix weather freshness and add the next-hours clothing card.
4. Add visible gesture hold progress and body framing guidance.
5. Combine these into one “Getting ready” routine after individual actions work.

The initial review changed documentation only. The subsequent implementation and tests are recorded in [MAGIC-EXPERIENCE-2026-10-08.md](MAGIC-EXPERIENCE-2026-10-08.md).
