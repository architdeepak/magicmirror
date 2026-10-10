# Magic Mirror: what it does and how to tune it

## Say or type (command bar ⌘)
| Phrase | Result |
|---|---|
| "mirror mirror" | Wakes the host: cloud reveal, greeting, live conversation |
| "search for …", "look up …", "what's the news" | Grounded answer card with source chips (needs a Gemini key; otherwise results open inside the mirror frame) |
| "what's the weather", "do I need an umbrella" | Weather card from the dashboard forecast |
| "what's on my calendar" | Opens the calendar inside the mirror frame |
| "set a timer for 10 minutes for the tea", "cancel the timer" | Countdown chips (top centre), bell when done, up to four |
| "who is the fairest of them all" | In-character answer, spoken and captioned |
| "close that" / Esc | Dismisses the open card |
| "flip the camera" | Toggles the upside-down camera correction |
| "smirk", "look menacing", "look amused", "look unimpressed" | Held facial expression |
| "open youtube / maps / spotify / calendar" | Opens inside the mirror frame, not a separate window |

## Mirror hardware profile (Settings)
- **Two-way glass profile**
  - *One-way mirror · pure black*: true black ground, panels solid black, camera picture hidden in Try on. Garments are drawn on your **reflection**.
  - *One-way mirror · night calm*: same, dimmed.
  - *Plain monitor*: shows the camera picture (desk testing).
- **Visible screen width (cm)**: 43″ portrait is about 51 cm. Needed to place clothes on the reflection.
- **Clothes size / height trims**: stand in front of the mirror, put a garment on and nudge until it sits on you. These absorb camera tilt and mounting height.
- **Camera mounting**: top-centre (default) or centre.
- **Host follows me**: the host eases toward where you stand (small sways ignored).
- **Auto-dim at night** (`mirror.auto-dim=false` to disable) and **pixel drift** protect an always-on panel.

## Privacy
The chip at the bottom shows what is live: amber = wake-word microphone (on-device
only), red = live conversation sent to Gemini, green = camera (frames stay on the
device). A live conversation ends after 45 s of silence; the camera releases after
30 s idle in the ambient mirror and returns when you wake the mirror or open Try on.
Switch the wake word off in Settings to disable all listening.

## Extending
- **New spoken pop-up**: add a branch in `runVoiceNavigation` (`src/renderer.js`)
  that calls `showSearchResult({ grounded: true, eyebrow, query, answer, sources })`.
  Add a phrase test to `tools/test-popup-routes.cjs`.
- **New host reaction**: add a row to `REACTIONS` in `src/avatarPresence.js`; fire it
  with `avatar.react('name')`.
- **New service frame**: add the URL to `serviceUrls` in `src/main.js` (any https
  page can be framed; framing headers are relaxed for sub-frames of the mirror only).
- **Performance guard**: run `npm run bench` after visual changes (see
  `docs/PERFORMANCE.md`).
