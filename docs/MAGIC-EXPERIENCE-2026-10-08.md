# Magic mirror experience: implementation and local audit

[Wake animation preview](media/mirror-awakens.mp4) · [portal still](media/mirror-wake.jpg) · [queen still](media/mirror-queen.jpg). These are an explicit silent preview from the packaged Linux app.

Implemented all ten additions from [the quick-win review](QUICK-WINS-2026-10-08.md), plus clearer framing and a theatrical wake reveal. This completes this feature batch, while the full installation goal remains incomplete. Evidence and explicit scopes are saved in [MAGIC-EXPERIENCE-VERIFICATION.json](MAGIC-EXPERIENCE-VERIFICATION.json).

## What changed

| Addition | Behavior and controls |
| --- | --- |
| Theatrical reveal and framing | A static gilded frame, short purple/gold mist ribbons and sparks, portal bloom and queen arrival. Dashboard cards clear during the reveal; Stop/mute stay visible. Clothing selection gets a brief queen reaction. |
| Local lookbook | “Take a look photo” starts the camera if needed, counts down, then opens review. It captures the synchronized camera, selected garment and AR effects; excludes UI/avatar/frame. “Save this look” explicitly saves; retake/discard remain available. Up to 100 local PNGs with bounded dimensions and native decoding. |
| Wardrobe favorites | Favorite/unfavorite a garment, filter favorites, cycle within that filter, or say “try my blue jacket.” Ambiguous names show guidance. |
| Saved-look comparison | “Compare looks,” select two photos, compare A/B or choose a larger single-photo view. Swipe/“next look” cycles; favorite saved photos separately from garments. |
| Useful weather | Next-hours feels-like/rain advice, persisted city, updated age and honest stale/offline state. Periodic refresh, resume refresh, timeout and selected-city request ownership. |
| Body framing and gesture feedback | Live crop-aware shoulders/hips/legs guidance for each garment category, with camera/missing-pose messages. A hold ring exposes existing gesture activation progress. This reports body framing, not sizing accuracy. |
| Routines | “Getting ready” applies selected/favorite/default clothing and clarity, uses one camera stream, and checks actual Spotify status. Spotify resume is a separate opt-in. “Remember my getting ready setup” persists choices. “Movie time” opens the configured YouTube/Netflix shortcut. |
| Notes and timers | “Leave a note: bring the umbrella”; “set a ten-minute timer”; “leaving in twenty minutes.” Absolute deadlines persist across reload/resume; expiry shows a silent badge. Up to four timers; no automatic wake/speech. |
| Contextual help and agent progress | “What can I do here” gives guidance for the current mode. Live/Codex tool activity shows readable progress, with existing Stop cancellation and sign-in boundaries. Both harnesses can invoke the shared local command dispatcher. |
| Motion, sound and camera information | Settings expose framing, reduced motion and optional short synthesized chime (off by default). Stop/mute cancel late sound starts. Settings show the camera's actual negotiated capture dimensions/frame rate. |

## Interruption and storage behavior

- Stop/hard mute cancel capture countdowns, queued routine steps, short visual/audio cues and agent progress. Routines never override hard mute.
- Capture refuses stale/missing tracking, cloud/still mode, a changed selection or unsuitable framing. No photo is saved until explicitly requested from review.
- Native lookbook writes are serialized, IDs/paths generated locally, images validated, and the manifest replaced atomically. Corrupt manifests are reported rather than overwritten. Cancellation cleans up uncommitted images; it does not remove an already committed requested save.
- The singleton two-row heard/said caption display moves into the lookbook while it is open, then returns. Typed requests start a fresh caption turn.
- Favorites, notes, settings and photos belong to one local profile. Multi-user identity, automatic scanning and phone download/export are separate work.

## Local validation

- `npm test` passed the complete regression suite, including new tests for timers, framing/crop, favorites/name matching, native lookbook concurrency/validation/cancellation, weather ownership/freshness, bounded cues and idle-face caching.
- Actual packaged Chromium/native IPC journey passed: reviewed images contained both clothing and camera pixels; two distinct saves persisted; comparison/favorites/large-view swipe worked; Stop/mute prevented late capture dialogs; missing pose rejected capture; notes, timer expiry, routine cancellation, reload and invalid PNG rejection worked. Movie requests were inspected with an adapter fixture, not real playback.
- Four viewport layouts passed: 400×710, 540×960, 1080×1920 and 1280×1024. Settings/command center accessibility, two colored captions, editor interruption, typed navigation and invalid media URLs were exercised; zero renderer exceptions recorded.
- Real packaged Gemini Live Gacrux journey passed with recorded WAV input fed into a MediaStream. Streaming heard captions appeared at about 1.12 seconds. Stop output reached zero RMS; about 0.93 seconds from spoken phrase onset, and 4.3 ms from local recognition to handler response. Ordinary speech was ignored after Stop, another wake restored conversation, and hard mute released live microphone tracks and ignored wake.
- A real Gemini Live text request invoked production `mirror_command` to start a local timer and replied with live audio. This does not test acoustic recognition of each new clothing/lookbook/routine phrase.
- The first extended voice run timed out on its second wake. The audit guard now waits for actual microphone readiness and inactive assistant state, instead of a status label. Two subsequent runs passed; the precise initial failure cause remains unproven and is preserved in the evidence.
- Real installed Codex used the packaged screen state, screenshots and Chromium input to click the requested randomized fixture target once and read its revealed result. This was a local test page, not an arbitrary personal account.
- Production cue preview passed cancellation, reduced-motion and revealed-host checks. Local preview: `artifacts/magic-animation/mirror-awakens.mp4`. Frame capture timings are recorded and encoded at their actual intervals; preview is silent and explicitly triggered, not an acoustic wake test.
- Native packaging regression passed. Spotify/Windows media/provider handshake parts use local fixtures and do not establish real account playback.

## Efficiency work and monitors

Resting face pixels are reused; blinks, speech, gaze and deliberate poses invalidate the cache. The 3D avatar staging texture uploads only when its source changes. Hidden AR effects clear once, and a flat idle depth scene avoids repeated updates. Cue canvases are bounded to 720×1100, at most 32 sparks, 24 fps and 2.2 seconds; no permanent particle loop was added.

The actual source app rendered zero new resting-face frames in the idle sample, then about 29 face paints/second during an explicit speech pulse. Short camera-off samples measured renderer CPU around 2–3% for flat avatar/watch/music, about 27% for dynamic software-rendered depth. These exclude other processes, use synthetic state and are not device watts or a Windows PC stick estimate. Persona rest/AA screenshots also confirmed repainting during speech for all three hosts. Concurrent audit load affects timings.

The older frozen `5d479ab` build completed a two-hour process-tree monitor: 2,327 samples and zero recorded errors. It predates this feature batch. A fresh two-hour isolated packaged monitor started at 2026-10-08T21-59-15-478Z for commit `6b681b6`. Its archive hash matches the audited package. It logs separately in `artifacts/monitor-magic-experience.log`; 11 samples and zero errors were recorded at this snapshot. The run is ongoing, so its final stability result is not established. Camera, live voice and accounts are disabled in this soak, and software graphics are used.

## Remaining installation work

Physical microphone/speaker echo and wake reliability, real gestures/head tracking, TV-distance presentation, actual Windows runtime/native Spotify account playback and phone casting interoperability remain unverified. Local clothing is articulated imagery and starter artwork; it does not simulate fabric drape or accurate sizing. Avatars remain stylized raster performers. Apple Find My People has no bridge. The old Windows ZIP predates these changes and must be rebuilt before delivery.
