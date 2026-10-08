# Reflect Magic Mirror

A portrait-first desktop magic mirror built with Electron, Three.js, TalkingHead, and MediaPipe. It runs without an API key in demo mode and can use Gemini Live for low-latency speech-to-speech conversation.

The product shell has portrait-first modes for use behind two-way glass:

- **Ambient** — glanceable time, weather, agenda, and a low-distraction idle state.
- **Converse** — the animated assistant, wake word, transcript, and real-time voice session.
- **Try on** — live camera face effects and clothing that follows body pose, with fit controls, voice/gesture garment switching, and optional consented still rendering through Google's Virtual Try-On model or a custom provider.
- **Watch** — direct-video playback, YouTube/Spotify embeds, a discoverable UPnP/DLNA media receiver with phone playback controls, a paired media-link sender, and Windows Miracast setup. A compatible casting app can send media into the Watch player. Windows screen casting uses its separate receiver. Subscription services should be opened in their supported app/browser because DRM normally prevents embedded playback.
- **Music** — an ambient Spotify now-playing screen with artwork, transport controls, and classic or pocket-player styling.

## What is included

- **Oracle mode:** a living 3D head, animated mystical depth room, head-tracked off-axis perspective, voice conversation, and lip movement.
- **Three host concepts:** Evil Queen (the charming witch), Snow (the bright storybook guide), and Advit (the grounded friend). The selector already persists personality and visual direction; each can receive a dedicated ARKit-blendshape GLB without changing the interface.
- **Face puppet (experimental):** MediaPipe’s local webcam tracker emits ARKit-style facial blendshapes and can drive matching morph targets on an avatar. Enable **Animate host from your face** in settings. The supplied starter GLB is only a compatibility test; premium results require a dedicated rig with the full facial target set.
- **Ambient mode:** clock, date, live Open-Meteo weather, daily message, and agenda placeholders.
- **Try-on studio:** mirrored camera view with MediaPipe-tracked face effects, a local garment closet, and voice-selectable consent-gated outfit rendering.
- **Watch mode:** clean, direct-video playback without turning the main mirror experience into a web browser.
- **Hardware mode:** 9:16 portrait layout, fullscreen/kiosk startup, camera selector, tracking controls, and mouse fallback.
- **Secure AI configuration:** the permanent Gemini key is read only by Electron's main process. The renderer receives a one-use short-lived token.
- **Assistant mode:** say “mirror mirror,” ask general questions, optionally share one camera frame per second while active, and keep durable non-sensitive preferences in a local memory file.
- **Assistant state:** a structured tool reports the current mode, visible mirror surface, voice/mute state, camera sharing, selected garment and closet names, live fit, and watch controls. Tool execution is serialized; repeated mutation call IDs reuse their result rather than repeating input.
- **Computer harness:** the assistant inspects the TV display before each click, text entry, scroll, or key press. On Windows it can operate native apps and launch a requested app through Start; other platforms use the managed desktop browser. Focus changes reject stale actions, and stop/hard mute cancels pending input. Captures that finish after Stop, a layout change, direct hand scrolling, or a newer observation are rejected. Desktop actions return a fresh screen image for the assistant to inspect; when capture fails, the result explicitly remains unverified.

Camera tracking and AR processing happen locally. When **Share camera with assistant** is enabled, compressed camera frames are sent to Gemini only during an active question or voice session. Turn the setting off to keep every frame local.

## Run it

Requirements: a current Windows/macOS/Linux desktop, Node.js 20+, Git LFS, and a webcam for tracking/AR.

```powershell
npm install
npm start
```

### Windows laptop setup

This is the recommended development and camera-testing setup. Electron runs on
the laptop, so its USB webcam, microphone, GPU, and browser permissions are
all local—no SSH camera forwarding is needed.

```powershell
git lfs install
git clone https://github.com/architdeepak/magicmirror.git
cd magicmirror
PowerShell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

Approve the camera and microphone prompts, then choose the USB camera in the
gear menu. The app runs fully in local demo mode without a Gemini key. Add a
key in **Settings → Gemini API key** when you want live AI conversation. Development checkouts also support `.env`.

For the vertical TV, use:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -Kiosk
```

To create a self-contained Windows executable on a Windows x64 machine:

```powershell
npm run dist:win
```

For an unsigned Windows x64 ZIP that can also be built on the Linux development
host, use `npm run dist:win:zip`, then `npm run check:windows-package`. Extract
`dist/Reflect Mirror-1.0.0-win.zip` completely on the PC stick and double-click
**Start Mirror.cmd** for kiosk mode or **Open Settings Window.cmd** for a normal
window. No developer checkout or Node/npm installation is needed to run this ZIP.
Repeat launches focus the existing instance for that user profile and switch its
window/kiosk mode. The archive audit checks architecture, ZIP integrity, required
assets, launchers, and exclusion of development data; it does not execute Windows.
Actual Windows camera/audio/native-input and TV performance still need checking.

The portable executable is written under `dist/`. If one unusual webcam does
not appear, set `MIRROR_FORCE_DIRECTSHOW=true` in `.env`, restart, and try
again; this is a compatibility fallback, not the normal configuration.

Useful scripts:

```powershell
npm run dev      # window plus detached developer tools
npm run kiosk    # fullscreen TV/mirror mode
npm test         # syntax, avatar, desktop, casting, voice races, gestures, YouTube bridge
npm run verify   # tests and local deployment file checks
npm run test:live-fit # Electron renderer and real pose-worker checks
npm run test:desktop:windows # actual native input in an isolated test window
npm run test:cast-player # decoded video, voice/captions, companion layout at 540/1080/2160px
npm run preview:capture # remote-SSH portrait screenshot check
```

On a headless Linux host, the multi-size player check needs a virtual display large enough for the 2160×3840 viewport plus window borders:

```bash
xvfb-run -a -s '-screen 0 2400x4200x24' npm run test:cast-player
```

YouTube bridge checks cover the real local player server and simulated player messages, not YouTube network playback. Voice lifecycle checks use simulated microphones and sockets; gesture checks use synthetic hand landmarks. They verify cancellation and recognition logic, while real microphone accuracy, camera gesture timing, and live Gemini/YouTube playback still need device checks.

### Interactive remote preview

On the Spark, run `npm run preview:serve`. On the laptop that is connected by
SSH, make a tunnel in a second terminal:

```bash
ssh -N -L 8787:127.0.0.1:8787 YOUR_SSH_HOST
```

Then open `http://localhost:8787/src/index.html` in Chrome. The preview server
is loopback-only; it is not exposed on the network. This browser preview runs
in demo mode and uses the laptop camera when granted permission. Use Electron
for native file picker, local closet persistence, secure account handoffs, and
the kiosk version.

### Avatar blendshape lab

`npm run avatar:lab` opens a local-only authoring tool at port `8790`. It turns
a front-facing character concept image into a GLB with ARKit-style facial morph
targets for evaluation. It is an asset-lab tool, not the production host; only
promote an output after visual review and rig validation.

## Local closet and try-on preparation

In **Try on**, choose **Add garment** to copy a garment image into the mirror's
local closet. Selecting a garment starts a local live fit that follows shoulders
and hips without exchanging anatomical sides; bottoms also follow knees and
ankles with continuous knee joins and depth ordering for crossed legs. Use a transparent PNG or a
front-facing garment on a uniform pale background. The width, length, and
height controls are saved per garment. Tools collapse after selection so the
garment stays visible; choose **Show tools** to adjust it. Say “try on my jacket” or swipe in Try
on to change garments. Use **Live camera** to return from a rendered still.
Live fit now uses local skin, hair, and face contours for foreground occlusion, with pose-based arm overlap as a fallback. Software GPUs select CPU segmentation; sustained slow inference falls back to pose occlusion. Live fit estimates placement and does not simulate fabric or measure sizing.
Pose inference runs in a worker at up to 10 frames per second, using reduced
camera frames that are never saved or uploaded by the live overlay. The first
use downloads the MediaPipe body model.

Give explicit consent to capture a sample or render a still. With no
provider configured, this action saves a local sample only. For realistic
single-frame virtual try-on, select **Google Cloud** in Settings and enter
your project and region. Environment setup also supports `MIRROR_VERTEX_PROJECT` and optionally
`MIRROR_VERTEX_LOCATION`, then configure Google Cloud Application Default
Credentials on the mirror PC with `gcloud auth application-default login`.
Enable the Vertex AI API and billing for that project. This uses Google's
Virtual Try-On model and sends the frame and garment only after consent. The
model is a billable cloud service. A custom renderer can instead be connected in Settings with its URL and optional
token, or use `MIRROR_TRYON_ENDPOINT` (and
optionally `MIRROR_TRYON_API_KEY`). See
[`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) for the adapter contract.

Camera off cancels pending permission and startup work; a late model load or
old stream cannot reopen the camera or replace a newer selection.
Face inference runs in a local worker, with fresh landmarks, blendshapes, and
head transforms delivered together. Camera off invalidates pending results.
The camera tracking models and WASM runtime ship with the app and initialize offline. If a model cannot load or camera permission is denied, the portal follows the mouse instead.

Try-on still rendering can be cancelled from the panel. Selecting another
garment, changing the camera, leaving Try On, withdrawing consent, Stop, and
hard mute cancel the pending request and reject its late result. A replacement
can be requested immediately. `npm run test:tryon` checks the provider boundary
with a real local HTTP fixture; it does not claim generated clothing realism.

## Enable Gemini Live voice

The AI conversation uses a **Gemini API key**. Wake-word recognition uses Vosk locally and does not require another account or API key.

1. Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open **Settings**, paste the key into **Gemini API key**, and select **Save connections**.
3. Select **Listen** or say “mirror mirror”.

**Remember on this device** saves connections using encrypted OS storage. When encrypted storage is unavailable, Settings uses session-only connections. Leaving the key field blank preserves the current key; **Disable Gemini** removes it from the selected session or saved settings. Packaged builds store memory, closet imports, and try-on results in the user’s app-data directory.

For development, `.env` remains supported:

```env
GEMINI_API_KEY=your_key_here
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
GEMINI_VOICE=Aoede
MIRROR_CITY=San Francisco
MIRROR_UNITS=imperial
MIRROR_KIOSK=false
```

Do not commit `.env`; it is already ignored by Git. Live API availability, quotas, preview model names, and billing are controlled by Google. Demo mode remains available when no key is present.

## Spotify ambient player

After connecting, use **Refresh devices → choose the PC/TV → Use device** to
transfer playback while preserving its current playing/paused state. The player
reports whether the target was confirmed or the switch is still pending. Device
availability and restrictions are checked again before transferring. The packaged
UI check covers these controls with a local fixture; account playback and TV audio
remain unverified.

Create an app in the [Spotify developer dashboard](https://developer.spotify.com/dashboard), add the redirect URI `http://127.0.0.1/callback`, then enter its client ID in **Settings → Spotify client ID → Save connections**. Development checkouts also support `MIRROR_SPOTIFY_CLIENT_ID` in `.env`. Select **Music → Connect Spotify** and approve playback-state and playback-control access. The app uses PKCE and stores refresh tokens encrypted in Electron's user-data directory when **Remember on this device** is enabled and encrypted storage is available. Otherwise Spotify authorization lasts for the current session. Spotify's Web API controls playback on a Spotify device you already use; it does not stream the track itself. Open Spotify on this PC or another supported device to start listening. Spotify may require Premium for playback controls. Say “show Spotify” or select **Music** to use the mirror player. Switch between the classic and pocket styles in the player. The dynamically selected loopback port is allowed for `127.0.0.1` redirect URIs. Track metadata and artwork stay inside the local player and are excluded from assistant screen input.

Computer observations report the shortcuts supported by the current input target. The managed browser supports select all (`ctrl+a`), Home/End, Page Up/Down, and ordinary navigation keys; URL navigation uses `open_webpage`. Windows native input also supports Start, app switching, and browser address/search shortcuts. Text actions await [Electron's insertion promise](https://www.electronjs.org/docs/latest/api/web-contents#contentsinserttexttext) before returning. The packaged check captures a real display JPEG, clicks an input using display coordinates, types Unicode text, and replaces it with select all.

Spotify responses are checked against the current connection before their track details or command results are used. A failed playback refresh clears cached playback state and disables transport controls. `npm run test:spotify` covers disconnect and response races with fixtures; actual account authorization and device playback remain separate checks.

The English Vosk speech model ships with the app and loads locally. When the status changes to **Say “mirror mirror”**, local wake-word recognition is armed. The round microphone button remains available as a manual trigger.

If a live microphone track ends, the assistant closes its input and voice connection, cancels queued speech, and asks you to reconnect before using **Listen**. The local wake listener also releases a lost microphone and reports the disconnect. `xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-microphone-loss.cjs` checks real Electron audio-resource cleanup with a synthetic ended event and silent queued playback; it does not prove physical microphone unplug behavior.

Unexpected live-session closure or network failure also runs the mirror's Stop cleanup: pending desktop input and try-on renders are cancelled, old screen observations are invalidated, and queued model tools cannot continue. Intentional Stop and hard mute keep their existing standby behavior.

The wake entrance uses a violet, gold, and mint vortex with orbiting sparks. The microphone button reads **Stop** throughout the entrance and greeting; it cancels the reveal without reopening voice afterward. Reduced-motion preferences show a static portal. For visual review without a microphone or service calls, run `xvfb-run -a node_modules/.bin/electron --no-sandbox tools/capture-wake-preview.cjs`; portrait frames and the reduced-motion check are saved in `artifacts/wake-preview/`.

## Controls

- Press the round microphone button for live Gemini conversation. With no key, it uses browser speech recognition when available.
- Or say **“mirror mirror”** to wake the assistant. Say **“mirror stop”** during a live session to stop listening and speaking; it returns to wake-word-only standby. The visible **Mute** control disables both the wake listener and conversation microphone until unmuted.
- Wake plays the magical reveal before the face appears. With Gemini configured, the greeting uses the same live host voice as the conversation; the offline demo waits for its greeting to finish before listening. Stop and hard mute cancel a pending reveal or connection, including late microphone permission results.
- Live captions retain the latest user and mirror lines in separate colors, scrolling to the newest words as speech streams. Local speech recognition supplies interim heard captions during live microphone turns; the service transcript replaces those preliminary words when it arrives. Local stop detection remains active during a live session even if standby wake is switched off. Browser recognition corrections replace interim words. The wake-word switch, vision sharing, speaking pace, and a curated set of voices are in settings.
- Say “search the web for …” to open a browser search; ask it to open a named service (YouTube, Netflix, Spotify, calendar, photos, maps) or a website URL. It can also move its face around the mirror layout.
- Ask “what's on screen?” to let the assistant inspect the TV display. When a managed website is open, it can use the screenshot to interact with that page, then inspect the result. The managed browser occupies the upper part of the portrait display; the host, two caption lines, Listen/Stop, hard mute, and a **Return to mirror** button remain below it. Say “return to the mirror” to close the managed browser. Native launches such as Spotify, its sign-in browser, and wireless-display settings use the same bottom companion on Windows and X11: the upper area reveals the app and accepts its mouse input; **Return to mirror** restores the prior mirror window and kiosk state. The companion reuses the current microphone, avatar, and captions. Native overlays are unavailable on macOS and Wayland; their managed browser still keeps the companion visible. Spotify presentation is excluded from assistant screen input even when a mirror control has focus.
- Select **Music** or say “show Spotify” for current playback details, or ask the assistant to pause, resume, or skip a Spotify track.
- In Watch, choose **Connect phone** and scan the QR code from a phone on the same Wi-Fi. Paste a YouTube, Spotify, or direct MP4/WebM/OGG link on the phone and send it to the mirror. This hands off a media link; it does not mirror the phone screen or bypass DRM.
- Or choose **Enable LAN casting**, then select **Reflect Mirror** in a UPnP/DLNA-compatible phone app. Send a video or audio stream and control play, pause, seek, volume, and mute from the phone. While casting, the video gets more room and manual URL controls collapse. You can talk to the assistant without interrupting playback; its face appears in a corner. **Stop LAN casting** pauses the cast and closes discovery and control endpoints. Anyone on the same reachable network can control playback while this receiver is enabled. This uses DLNA-compatible apps, rather than the phone's AirPlay or Chromecast menu.
- Cast Play failures belong to the request that started them. Loading another cast, pausing, stopping, or detaching invalidates older Play results, so a delayed failure cannot overwrite the current phone/TV playback state.
- Gestures require the camera and **Hands-free navigation**. Hold an open palm to stop active voice; otherwise it opens Converse or returns from the managed browser. Pinch toggles direct/cast video or Music playback. Swipe left/right to seek 15 seconds in direct/cast video or YouTube, skip tracks in Music, or change garments in Try on; pinch in Try on changes filters. Swipe up/down to scroll a managed website or the exposed native app on Windows; outside desktop presentation those swipes change viewing modes. In the native Spotify companion, pinch toggles playback and horizontal swipes change tracks through the connected Spotify player. Relax or lower your hand between gestures. YouTube embeds also support pinch play/pause and swipe seeking through the official IFrame API; Spotify embeds retain their own touch/phone controls.
- Ask for an effect naturally: “give me arcane glasses,” “make me a cat,” “show a magical halo,” “scan my face,” or “remove the filter.” Gemini calls the local AR control tool and switches modes automatically.
- Say “try on my black jacket” for its local live fit. Say “make it wider” or “move it up” to adjust it. Confirm the consent checkbox and explicitly ask “render this look” for a generated still, then choose **Live camera** to return to the moving preview.
- Click the compact transcript (or its × button) to dismiss it.
- The assistant can save useful non-sensitive facts in `data/memory.json`; settings show the count and provide a confirmation-gated clear button.
- Open the gear for camera, weather city, AR effect, tracking sensitivity, smoothing, and fullscreen.
- If a camera track ends, the mirror clears the preview and face tracking, falls back to pointer navigation, and shows a reconnect message in camera settings. Reconnect the camera and choose **Camera on**. Late disconnect events from an old stream cannot close a replacement camera.
- Gesture guide: hold an open palm to enter Converse, swipe with an open hand through Ambient → Converse → Watch → Music, swipe in Try on to change garments, or pinch in Try on to cycle the face filter.
- After three minutes idle in Ambient, Sleep dims the mirror and pauses camera and gesture processing while keeping the local wake phrase available. Touch or move the pointer to wake it; speaking “mirror mirror” runs the full awakening sequence.
- Use the portrait button in the lower-left corner to choose a host. The AI persona changes on its next live connection.
- With hands-free navigation on: hold an open palm to enter Converse, swipe to change modes, and pinch to cycle Try On effects. Gestures are processed on-device in a worker, with stale camera results rejected. Startup with navigation off leaves the hand model unloaded; enabling it loads the worker. Ended streams cannot start inference or deliver gesture results.
- Enable **Animate host from your face** to test the webcam face-puppet path. It does not share camera frames with the assistant; the separate vision-sharing switch controls that.
- Keyboard shortcuts remain available for testing: `1` Converse, `2` Ambient, `3` Try on, `4` Watch, `C` camera, `F` fullscreen.

## TV installation

1. Mount the Samsung TV in portrait orientation and configure Windows for 1080×1920 or 2160×3840 portrait output.
2. Attach the webcam near the top-center of the frame, pointed toward a viewer standing roughly 2–6 feet away.
3. Use the TV speakers or a nearby speaker; keep the microphone separated enough to reduce echo.
4. Run `npm run kiosk`, or set `MIRROR_KIOSK=true` in `.env` and start the app normally.
5. In Settings, select **Top-center of portrait TV** under Camera mounting. Stand at the normal viewing spot, wait for **Face Lock**, hold still for two seconds, then press **Calibrate depth**. The mirror averages recent camera samples and saves alignment for that camera. Recalibrate after moving the webcam, TV, or usual standing position.

For automatic startup with the ZIP, create a shortcut to **Start Mirror.cmd** in
the Windows Startup folder (`Win+R`, `shell:startup`). Keep the extracted folder
in place. A development checkout can instead use a shortcut to `npm run kiosk`
with this project as its working directory. Startup settings are not changed
automatically by the package.

## Technology choices

- [TalkingHead](https://github.com/met4citizen/TalkingHead) owns avatar loading, idle behavior, expressions, gaze, and streamed PCM playback.
- [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) provides local face landmarks and viewer position.
- [Three.js](https://threejs.org/) renders the fire, particles, portal rings, and perspective room.
- [Gemini Live](https://ai.google.dev/gemini-api/docs/live-api) provides optional streaming conversation.
- [Open-Meteo](https://open-meteo.com/) provides weather without another API key.

The supplied `src/assets/avatar.glb` is used as the initial character. Replace it with another Ready Player Me-compatible GLB at the same path to change the character while preserving animation and lip-sync support.

## Next hardware/software upgrades

- Replace the starter avatar with a purpose-built magical head using ARKit/Oculus facial blendshapes.
- Add calendar authorization and real agenda data.
- Improve live garment fit with body segmentation, sleeve articulation, and fabric rendering beyond the current pose mesh; retain the existing consent boundary for any external rendering.
- Refine gesture recognition against recorded standing-at-TV sessions, including false triggers and deliberate transitions.
- Add a media-provider launcher for supported installed apps instead of trying to iframe DRM services.
- Package the Electron app as an installer and configure watchdog/auto-restart for the PC stick.

### Embedded YouTube playback

Electron loads the official YouTube IFrame API in a separate loopback player frame, without the mirror preload bridge. Playback events report readiness, buffering, playing, paused, ended, and player errors. Pinch play/pause and left/right seek gestures apply to this player too. The packaged app ID identifies desktop embed requests as required by YouTube; playback still depends on network access, video embedding permissions, and autoplay rules. Real YouTube play/pause/seek has passed in the Electron service check; gesture timing and playback on the installed TV remain to be verified.

### Real Gemini connection check

`npm run check:computer:live` checks actual Gemini screen inspection and input against a local shuffled-button page. `npm run check:computer:form` checks selecting a field, Ctrl+A, Unicode replacement, Enter submission, and reading the saved result. `npm run check:computer:scroll` checks scrolling to a hidden button, activating it once, and reading a random message below the viewport. `npm run check:computer:double` checks one intentional double-click on a shuffled target and its visible result. All four use the packaged Linux app and configured Gemini key on an isolated display; they upload that display and incur API usage. Prefix with `xvfb-run -a` on a headless host, and pass `-- --kiosk` to exercise the portrait kiosk layout. `npm run test:managed-keys` verifies Chromium form submission, textarea newline/space, and button activation with the production keyboard events without calling Gemini.

`npm run check:gemini:live` uses the configured Gemini key and the production ephemeral-token and live-adapter code. It sends synthetic text and solid-blue/green preview video, saves a short Gacrux greeting to `artifacts/gemini-live/greeting.wav`, and requests mirror-state and avatar-position tools against a fixture. It verifies streamed audio/transcription, tool execution, and the live model identifying successive preview colors; it does not test a physical microphone, camera, speaker, or actual desktop input. This check calls the live service and may incur API usage charges. On a headless Linux host, prefix it with `xvfb-run -a`.

### Real YouTube connection check

`npm run check:youtube:live` loads a public YouTube video through the production isolated player, app-identification hook, and shared Watch controls. It waits for actual player events while checking play, pause, and a forward seek, then saves a screenshot and result to `artifacts/youtube-live/`. It requires YouTube network access; it does not use an account, upload media, or need an API key. Set `MIRROR_YOUTUBE_CHECK_VIDEO` to another embeddable video ID if the default demonstration video becomes unavailable. On a headless Linux host, prefix the command with `xvfb-run -a`.

Watch voice commands use the same controls as gestures: “pause the video,” “resume,” and “skip forward 15 seconds.” The live assistant can also load a supplied video URL or inspect player status through `control_watch`. A source selection or command acknowledgement is not treated as proof that playback started.

### Local wake recognition check

`npm run check:wake:recognition` runs the actual Vosk WASM model through the production wake listener using synthetic WAV speech. On Linux, generate those fixtures with `python3 tools/generate-wake-fixtures.py` (requires an installed eSpeak NG library), then run the check under `xvfb-run -a` on a headless host. Results are saved to `artifacts/wake-word/result.json`. The English model is bundled in the app and served locally; subsequent checks reuse its browser cache.

Standby uses ordinary speech decoding to distinguish the wake phrase from nearby words. Active conversations use a small stop-command grammar with an unknown-word path. Switching sessions resets the recognizer, and stale recognizer/audio callbacks are ignored. The synthetic check covers wake, stop, mute, similar phrases, and ordinary speech; physical microphone distance, accents, room noise, and TV speaker echo still require testing on the installation.

### Parallax geometry and calibration

The off-axis camera stays parallel to the screen plane; its frustum accounts for head movement. The 2D projection matches the neutral 3D scale, and 2D disables positional scene/avatar parallax. Calibration requires a recent, steady face sample spanning roughly two seconds and stores separate baselines for top and center camera mounting. Lost face tracking returns smoothly to center; mouse preview applies when camera tracking is unavailable. Smoothing follows elapsed time so it behaves consistently across frame rates. Face tracking falls back to CPU if the GPU delegate cannot initialize.

`npm run test:depth` checks fixed screen corners, eye-to-window ray geometry, matching 2D/3D projection, stable timed calibration, mount isolation, stale-face rejection, and frame-rate-independent smoothing. The Electron player integration checks removal of the duplicate 3D face when switched to 2D. Camera alignment and comfort on the physical TV remain unverified.

### Live fit stability

Live garment placement uses motion-adaptive pose smoothing: small jitter is reduced, while large movement, camera changes, and lost/reappearing poses reset the filter. Inference requests carry unique IDs so late results cannot unlock or replace a newer request. A watchdog gives initial inference time to warm up and detects later stalls; camera changes hide the previous pose immediately. `npm run test:body` covers these races and filtering rules, and `npm run test:live-fit` exercises the real MediaPipe worker and rendered UI.

Voice garment names match complete words and prefer an exact name. Ambiguous requests return choices without changing the selected garment. Try-on tool results and mirror state distinguish an image that has loaded from an overlay actually visible on the live camera, and include camera availability, body detection, frame age, and positioning guidance. Ended camera streams clear the garment instead of retaining the last outfit frame.

The local mesh still does not simulate realistic cloth. Optional **Live AI outfit preview** now connects to Decart's neural video service: enter a Decart key in Settings, import/select a garment, turn on the camera, confirm its separate live-camera sharing checkbox, then select **Start live AI**. Say “start live AI” after consent, or change garments by voice while the session runs. **Stop live AI**, “mirror stop,” hard mute, camera loss/change, leaving Try On, and hiding the app stop video sharing. An existing rendered still remains a separate option.

`npm run test:live-tryon` covers the token/session lifecycle without contacting Decart. The packaged check imports the bundled SDK and exercises real 720×1280 portrait video capture using a synthetic local stream. Cloud output quality, network latency, garment fidelity, and operation on the target PC stick remain unverified. See [neural evaluation notes](docs/NEURAL-TRYON.md).

Live AI becomes visible only after a frame is presented. A three-second returned-video stall stops sharing, and mirror state reports presented-frame age plus SDK latency/FPS when available. `npm run check:live-tryon:ui` checks the production packaged UI using actual local video frames and a simulated cloud transport: consent, garment changes, old-stream rejection, frozen-video cleanup, shared camera ownership, assistant Stop, hard mute, consent withdrawal, mode exit, and camera loss. On headless Linux, prefix it with `xvfb-run -a`. This check does not contact Decart or evaluate generated clothes.

Assistant vision follows the displayed try-on content: the mirrored local camera with garment/effect layers, the generated live outfit, or the selected rendered still. A connecting/stale live AI view withholds frames. Mirror state names the current vision source and last sent source/time, and the sharing checkbox applies immediately. Ordinary camera input remains available outside Try On; desktop/app pixels use the explicit screen observation tool. Frames are limited to 640 pixels on the longest edge. `npm run test:assistant-vision` checks routing and compositing; the packaged UI check verifies the outgoing blue/green preview pixels through a local socket fixture without uploading images to Gemini.

### Native companion verification

`npm run test:companion` covers window-region geometry and restoration. `npm run check:companion` opens a local fixture beneath the actual mirror, captures the composed display, and checks input through the native window region. Run it on a dedicated Windows or X11 desktop; on headless X11, a window manager is required to enforce window stacking. Set `MIRROR_TEST_WINDOW_MANAGER` to an installed window-manager executable to launch one for the check. The fixture is local and does not open an account or external app. Actual Windows/TV stacking remains to be checked on the PC stick.

### Packaged app verification

Run `npm run pack`, then `npm run check:packaged` on the same architecture.
On headless Linux, use `xvfb-run -a -s '-screen 0 1200x2100x24' npm run check:packaged`.
The check launches the actual built binary with a temporary `--user-data-dir`
profile. It verifies startup, bundled assets, writable memory, the Settings
form, player file serving, managed-browser scrolling, and the real body/mask
worker loaded from `app.asar`. It uses a public test photograph and synthetic
connection data, then removes its profile. It does not connect an account or
start Gemini conversation. Pass an unpacked binary path as the first argument
on another platform. Results and a startup screenshot are written to
`artifacts/packaged/`. Windows and physical TV checks are still required.

### Full voice journey verification

Generate prerecorded speech with `python3 tools/generate-wake-fixtures.py`,
build with `npm run pack`, then run `npm run check:voice:journey` on an isolated
desktop (headless Linux: `xvfb-run -a -s '-screen 0 1200x2100x24' npm run check:voice:journey`).
This optional service check uses the configured Gemini key and incurs live API
usage. It feeds synthetic WAV speech through a `MediaStream` into the actual
packaged app, with real microphones/cameras excluded. It checks the reveal,
Gacrux greeting, spoken follow-up, growing heard captions before speech ends, caption rows/colors,
local stop recognition with standby wake switched off,
audio-graph silence, ordinary-speech suppression after stop, a second wake,
and hard mute during active playback. It does not measure TV speaker echo,
room noise, accents, or physical input/output latency.

### Full goal verification

See [completion audit](docs/COMPLETION-AUDIT.md) for the original requirements, inspected evidence, and remaining installation/account/realism gates. The full mirror goal is not yet verified.

### Spotify on the Windows stick

Install Spotify on the stick, sign in, and play a song. Select the TV as the Windows audio output. Music follows Spotify’s local Windows media session and offers classic/pocket views plus play/pause/skip, without a Spotify developer client ID. Use **Open Spotify app** in Music to launch it. The optional account connection/device picker is for Spotify Connect on other devices. This Windows backend is implemented and tested with fixtures; actual WinRT/Spotify playback on the stick remains unverified.

### Interactive verification

The packaged portrait app was explored using screenshots and actual mouse/keyboard input. That found and fixed an external wake-model download stall and Watch covering Settings. Wake/stop now uses the bundled English model; a loading error or 45-second stall exits cleanly. The latest full Gemini voice journey passed with synthetic microphone audio. See `artifacts/exploration/REPORT.md` for the session’s observed results and remaining hardware/realism gates.

### Local photo wardrobe

Try on includes 30 bundled starter garments in five styles and six colors. **Add garment** opens a photo preview: upload a photo, take one with the mirror camera, or choose **From phone** to scan a QR and upload over local Wi-Fi, choose a name/type, adjust a plain-background cutout, and save on this device. Say “add garment”, “take photo”, “name it my blue dress”, “type dress”, and “save garment”. In the editor, swipe changes type and pinch captures/saves; outside it, swipe selects clothes. Say “make it red” or “change style to blouse” for starter variations. Your own photos retain their original colors.

See [AR wardrobe progress and limitations](docs/AR-WARDROBE.md). This front-image mesh preview does not yet provide realistic 3D fabric or measured fit.

### Verified assistant delegation

The live voice host can delegate longer screen/computer/wardrobe tasks to an
installed Codex signed in with ChatGPT. Stop and hard mute cancel its task.
Actual local-screen and packaged cancellation checks passed; Windows and real
service accounts remain unverified. See [assistant harness](docs/ASSISTANT-HARNESS.md)
for setup, test evidence and limits. Local AR does not require Codex or a paid
generative API.

### October 8 local audit

[Adversarial UI and account audit](docs/ADVERSARIAL-AUDIT-2026-10-08.md) records
current-machine evidence, repaired portrait layouts, typed assistant input,
account prompt protection, software 3D cadence, and the remaining integration
gaps. Find Devices on iCloud.com is not a configured friends-location connector.
