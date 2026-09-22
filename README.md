# Obsidian Magic Mirror

A portrait-first desktop magic mirror built with Electron, Three.js, TalkingHead, and MediaPipe. It runs without an API key in demo mode and can use Gemini Live for low-latency speech-to-speech conversation.

## What is included

- **Oracle mode:** a living 3D head, animated mystical depth room, head-tracked off-axis perspective, voice conversation, and lip movement.
- **Mirror mode:** clock, date, live Open-Meteo weather, daily message, and agenda placeholders.
- **AR mode:** mirrored camera view with MediaPipe-tracked crown, runes, aura, glasses, masquerade mask, cat, halo, emoji-orbit, and face-scan effects.
- **Hardware mode:** 9:16 portrait layout, fullscreen/kiosk startup, camera selector, tracking controls, and mouse fallback.
- **Secure AI configuration:** the permanent Gemini key is read only by Electron's main process. The renderer receives a one-use short-lived token.
- **Assistant mode:** say “mirror mirror,” ask general questions, optionally share one camera frame per second while active, and keep durable non-sensitive preferences in a local memory file.

Camera tracking and AR processing happen locally. When **Share camera with assistant** is enabled, compressed camera frames are sent to Gemini only during an active question or voice session. Turn the setting off to keep every frame local.

## Run it

Requirements: a current Windows/macOS/Linux desktop, Node.js 20+, and a webcam for tracking/AR.

```powershell
npm install
npm start
```

Useful scripts:

```powershell
npm run dev      # window plus detached developer tools
npm run kiosk    # fullscreen TV/mirror mode
npm test         # syntax checks for all runtime modules
```

The first camera run downloads Google's MediaPipe face-landmarker model. If it cannot load or camera permission is denied, the portal automatically follows the mouse instead.

## Enable Gemini Live voice

The AI conversation uses a **Gemini API key**. Wake-word recognition uses Vosk locally and does not require another account or API key.

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

On first run, Vosk downloads a small English speech model. When the status changes to **Say “mirror mirror”**, local wake-word recognition is armed. The round microphone button remains available as a manual trigger.

## Controls

- Press the round microphone button for live Gemini conversation. With no key, it uses browser speech recognition when available.
- Or say **“mirror mirror”** to wake the assistant. The wake-word switch, vision sharing, speaking pace, and a curated set of voices are in settings.
- Ask for an effect naturally: “give me arcane glasses,” “make me a cat,” “show a magical halo,” “scan my face,” or “remove the filter.” Gemini calls the local AR control tool and switches modes automatically.
- Click the compact transcript (or its × button) to dismiss it.
- The assistant can save useful non-sensitive facts in `data/memory.json`; settings show the count and provide a confirmation-gated clear button.
- Open the gear for camera, weather city, AR effect, tracking sensitivity, smoothing, and fullscreen.
- Keyboard shortcuts remain available for testing: `1` Oracle, `2` Mirror, `3` AR, `C` camera, `F` fullscreen.

## TV installation

1. Mount the Samsung TV in portrait orientation and configure Windows for 1080×1920 or 2160×3840 portrait output.
2. Attach the webcam near the top-center of the frame, pointed toward a viewer standing roughly 2–6 feet away.
3. Use the TV speakers or a nearby speaker; keep the microphone separated enough to reduce echo.
4. Run `npm run kiosk`, or set `MIRROR_KIOSK=true` in `.env` and start the app normally.
5. Calibrate depth sensitivity and smoothing from the settings drawer after the acrylic mirror is installed.

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
- Add MediaPipe body segmentation and pose tracking before attempting clothing try-on.
- Package the Electron app as an installer and configure watchdog/auto-restart for the PC stick.
