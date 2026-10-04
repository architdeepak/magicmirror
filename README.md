# Reflect Magic Mirror

A portrait-first desktop magic mirror built with Electron, Three.js, TalkingHead, and MediaPipe. It runs without an API key in demo mode and can use Gemini Live for low-latency speech-to-speech conversation.

The product shell is intentionally split into four simple modes, so the screen stays calm and useful behind two-way glass:

- **Ambient** — glanceable time, weather, agenda, and a low-distraction idle state.
- **Converse** — the animated assistant, wake word, transcript, and real-time voice session.
- **Try on** — a local-camera face-effects studio today, with a reserved integration surface for a virtual wardrobe/makeup provider.
- **Watch** - a persistent browser panel for Spotify, YouTube, Netflix and other HTTPS pages, plus a direct-video player. Cookies stay in the local mirror profile. Protected-content playback still depends on browser/service support.

## What is included

- **Oracle mode:** a living 3D head, animated mystical depth room, head-tracked off-axis perspective, voice conversation, and lip movement.
- **Three host concepts:** Evil Queen (the charming witch), Snow (the bright storybook guide), and Advit (the grounded friend). The selector already persists personality and visual direction; each can receive a dedicated ARKit-blendshape GLB without changing the interface.
- **Face puppet (experimental):** MediaPipe’s local webcam tracker emits ARKit-style facial blendshapes and can drive matching morph targets on an avatar. Enable **Animate host from your face** in settings. The supplied starter GLB is only a compatibility test; premium results require a dedicated rig with the full facial target set.
- **Ambient mode:** clock, date, live Open-Meteo weather, daily message, and agenda placeholders.
- **Try-on studio:** mirrored camera view with MediaPipe-tracked crown, runes, aura, glasses, masquerade mask, cat, halo, emoji-orbit, and face-scan effects.
- **Watch mode:** a media section that stays open during assistant speech, including while signing in. Close it with the panel Close button, STOP or sleep.
- **Hardware mode:** 9:16 portrait layout, fullscreen/kiosk startup, camera selector, tracking controls, and mouse fallback.
- **Secure AI configuration:** the permanent Gemini key is read only by Electron's main process. The renderer receives a one-use short-lived token.
- **Assistant mode:** say “mirror mirror,” ask general questions, optionally share one camera frame per second while active, and keep durable non-sensitive preferences in a local memory file.

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
key to `.env` only when you want live AI conversation.

For the vertical TV, use:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -Kiosk
```

To create a self-contained Windows executable on a Windows x64 machine:

```powershell
npm run dist:win
```

The portable executable is written under `dist/`. If one unusual webcam does
not appear, set `MIRROR_FORCE_DIRECTSHOW=true` in `.env`, restart, and try
again; this is a compatibility fallback, not the normal configuration.

Useful scripts:

```powershell
npm run dev      # window plus detached developer tools
npm run kiosk    # fullscreen TV/mirror mode
npm test         # syntax checks for all runtime modules
npm run verify   # syntax plus local deployment invariants
npm run preview:capture # remote-SSH portrait screenshot check
```

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

## Local wardrobe and body preview

The starter wardrobe includes downloaded OpenMoji T-shirt, coat, jeans and dress illustrations. Say "put on the T-shirt", "wear jeans", "take off the jacket", or "remove all clothes". You can also pinch a wardrobe item or import a transparent garment image. MediaPipe pose tracking aligns the local 2D artwork to shoulders and hips; trousers need visible legs. This is an illustrated overlay, not photorealistic fabric fitting. Attribution and license are in `src/assets/garments/ATTRIBUTION.md`.

## Tablet browser controls

The Watch panel has Back, Forward, Reload, Fullscreen and Close controls. Enter an HTTPS address or a search. Sign in directly in the browser; its `persist:mirror-media` profile retains cookies. The assistant can read controls and click, type searches, scroll, navigate and use keys through browser tools. Form values and passwords are excluded from page observations.

Say "open YouTube Shorts", "make it fullscreen", "exit fullscreen", "next short", "previous short", "next song" or "previous song". The **Head control** switch enables deliberate down/up movement for next/previous in Shorts or Spotify. Hold briefly, then return to center before another action. Face loss never navigates. Re-center camera also re-centers face navigation.

Run `npm test`, `npm run test:browser-runtime` and `npm run test:tablet-runtime` for regression checks. Runtime tests use hidden isolated windows and no billable AI sessions. Real Spotify sign-in/playback and physical camera framing need device testing.

## Enable Gemini Live voice

The AI conversation uses a **Gemini API key** and defaults to `gemini-3.1-flash-live-preview`. Wake-word recognition uses Vosk locally and does not require another account or API key. Gemini free-tier availability and quotas are controlled by your API project, not by this app; usage is not unlimited. Check [pricing](https://ai.google.dev/gemini-api/docs/pricing) and your active limits in Google AI Studio.

1. Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Copy `.env.example` to a new file named `.env` in the project root.
3. Paste the key after `GEMINI_API_KEY=`.
4. Restart the app.

```env
GEMINI_API_KEY=your_key_here
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
GEMINI_VOICE=Aoede
MIRROR_CITY=San Francisco
MIRROR_UNITS=imperial
MIRROR_KIOSK=false
```

Do not commit `.env`; it is already ignored by Git. Live API availability, quotas, preview model names, and billing are controlled by Google. Demo mode remains available when no key is present.

On first run, Vosk downloads a small English speech model. When the status changes to **Say “mirror mirror”**, local wake-word recognition is armed. The microphone button starts a manual voice session. The red STOP button immediately interrupts speech and disables all microphone listening, including the wake word, until you start it again.

## Controls

- **SLEEP** blacks out the mirror, stops camera/hand processing and assistant audio, and keeps only local wake detection active. Say **mirror mirror** to wake it; gestures, pointer movement and keyboard shortcuts do not wake it.
- **STOP** (or Escape) immediately mutes assistant and wake microphone listening. Press the mic for a new voice session, or re-enable the wake-word setting.
- In **Try on**, point with your right hand at an effect and pinch to select it immediately. No dragging is needed. The effect appears as soon as the camera detects your face. The screen cursor follows the mirrored camera image.
- The camera status near the top distinguishes face lock, hand lock and missing tracking. Frame your face in the camera, then use **Re-center camera** at your usual standing position. **3D** must be selected for the background to respond to head movement.

- In Settings, **Character appearance → Animated Memoji-style head (2D)** enables the local layered character with animated pupils, brows, blinks, and speech. Portrait remains the default. Depth Cube uses the canvas portrait host.
- Listening, thinking, and speaking now drive distinct character poses. Live mouth opening follows playback audio, and the host stays in its speaking state until queued audio ends. This is local animation; it does not use Meta's generated-avatar technology.

- Press the microphone button for live Gemini conversation. With no key, it uses browser speech recognition when available. Press STOP to mute and immediately interrupt the assistant.
- Or say **“mirror mirror”** to wake the assistant. The wake-word switch, vision sharing, speaking pace, and a curated set of voices are in settings.
- Ask for an effect naturally: “give me arcane glasses,” “make me a cat,” “show a magical halo,” “scan my face,” or “remove the filter.” Gemini calls the local AR control tool and switches modes automatically.
- Captions float without a box or speaker label: blue for you, green for the assistant. Only the latest two lines remain visible; routine replies are one short sentence.
- The assistant can save useful non-sensitive facts in `data/memory.json`; settings show the count and provide a confirmation-gated clear button.
- Open the gear for camera, weather city, AR effect, tracking sensitivity, smoothing, and fullscreen.
- Use the portrait button in the lower-left corner to choose a host. The AI persona changes on its next live connection.
- Right-hand pointing and pinching work in every awake mode. A deliberate visible clap toggles controls; camera hand detection continues while the pointer is off. Sleep still wakes only by voice.
- Enable **Animate host from your face** to test the webcam face-puppet path. It does not share camera frames with the assistant; the separate vision-sharing switch controls that.
- Keyboard shortcuts remain available for testing: `1` Converse, `2` Ambient, `3` Try on, `4` Watch, `C` camera, `F` fullscreen.

## TV installation

1. Mount the Samsung TV in portrait orientation and configure Windows for 1080×1920 or 2160×3840 portrait output.
2. Attach the webcam near the top-center of the frame, pointed toward a viewer standing roughly 2–6 feet away.
3. Use the TV speakers or a nearby speaker; keep the microphone separated enough to reduce echo.
4. Run `npm run kiosk`, or set `MIRROR_KIOSK=true` in `.env` and start the app normally.
5. In Settings, select **Top-center of portrait TV** under Camera mounting. Stand at the normal viewing spot, wait for **Face Lock**, hold still for two seconds, then press **Re-center camera**. This turns on 3D depth and saves alignment from recent camera samples. Recalibrate after moving the webcam, TV, or usual standing position.

For automatic startup, add a Windows startup shortcut whose target is `npm run kiosk` and whose working directory is this project folder.

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
- Add body segmentation, pose tracking, and a consent-gated capture flow before attempting clothing try-on. Keep the provider behind a small adapter that receives a cropped frame, garment asset, and fit request, then returns a rendered image/video layer; this makes Drape, an in-house model, or another provider swappable.
- Add a gesture router after face tracking is stable: use a small, deliberate vocabulary (open palm = wake, swipe = change mode, pinch = select) with a visible confirmation state. Do not make the ambient screen gesture-hot by default.
- Add a media-provider launcher for supported installed apps instead of trying to iframe DRM services.
- Package the Electron app as an installer and configure watchdog/auto-restart for the PC stick.


## Hybrid Codex + Gemini assistant

Gemini Live handles the microphone, natural voice, avatar and short spoken responses. It delegates multi-step browser/account tasks through `delegate_codex_task` to the official local Codex app-server. Codex calls the same mirror UI/browser tools and returns observed results to Gemini. It does not run arbitrary page JavaScript. STOP, sleep and app exit cancel the Codex process; tasks also have a three-minute deadline and a 20-action limit.

Install the official Codex CLI if needed (`npm install -g @openai/codex`) and run `codex login`, choosing ChatGPT. The integration refuses API-key authentication so it uses your existing plan limits rather than silently switching to API billing. Set `MIRROR_CODEX_PATH` to the executable path if Codex is not on PATH. The default model follows your Codex configuration. Gemini still uses the existing `.env` configuration and its own API quotas/billing.

Restart with `npm run kiosk`. Try: "Mirror mirror, open Gmail and draft an email to Alex about tomorrow's meeting." Sign into your accounts directly on the mirror browser; the browser partition preserves cookies. Email writing means a draft; sending requires an explicit send request. Gmail compose typing is supported only on `mail.google.com`; credentials remain manual. This is browser-based account access, not a Google OAuth API integration. Google may refuse embedded-browser sign-in, and actual account workflows still require an on-device test. This integration controls the mirror browser, not the entire Windows desktop.

Validation: `npm run test:codex`, `npm run test:browser-runtime`, and `npm run test:tablet-runtime`. Codex unit tests cover subscription-only authentication, tool results, concurrent requests and cancellation. Browser tests use an intercepted Gmail fixture, never a real account or email send.
