# "Mirror, Mirror" — Evil Queen Persona Mode: Technical Spec

A software mode for your magic mirror project: black background, animated dark fire, a talking face that moves as it speaks, an illusion of 3D depth, and a real-time voice AI brain behind it. This spec covers what's actually possible today, what the real building blocks are, and a phased plan to get from laptop prototype to mirror hardware.

## Locked decisions (v2)

- **Platform:** Electron (Chromium under the hood, so full WebGL/Three.js performance, plus clean camera/mic permissions and real kiosk mode for the eventual TV mount).
- **Face:** a real Memoji-based 2D "cutout puppet" — see §3 for exactly how to get pixel-perfect Memoji assets (not a lookalike style, the actual thing).
- **Voice AI:** start prototyping on **Gemini Live's free tier** (genuinely free, rate-limited but fine for dev) since your Google AI Pro subscription doesn't carry over to API billing anyway; keep the code structured so swapping to OpenAI Realtime later is a small change, not a rewrite.

---

## 1. The short answer to your core questions

- **Memoji itself: not accessible.** Apple's Memoji/Animoji rendering runs on a private framework (`AvatarKit`) with no public API — even iOS developers can't pull a Memoji face into their own app. There are community projects that reverse-engineer it, but Apple explicitly blocks that from shipping. So we won't be *using* Memoji — we'll build something in that visual spirit instead (see §3).
- **3D illusion: no special hardware required.** A single webcam is enough. The "looks like a window into another world" effect is done with **head-tracking + off-axis projection** — moving the virtual camera as your head moves so the parallax fools your brain into perceiving depth on a flat screen. This is the classic Johnny Lee "Wii head tracking" trick, and it's very buildable in-browser today with MediaPipe. Your RealSense D435i (already in your parts list for the other mode) would make this *more* robust (real depth instead of estimated depth), but it's not required — plain RGB is enough to start.
- **Real-time voice AI: yes, this exists and is mature now.** OpenAI's Realtime API (currently `gpt-realtime-2.1`) and Google's Gemini Live API both do speech-in → speech-out in one streaming connection, sub-300ms, with interruption handling — this is the "GPT Live" you were thinking of. WebRTC transport gets you the lowest latency and gives you a live audio track you can also use to drive lip-sync.

---

## 2. System overview

```
Microphone ──► Realtime Voice API (OpenAI/Gemini) ──► Audio out ──┐
                        (speech-to-speech,                        │
                         function calling)                        ▼
Webcam ──► Face/head tracking (MediaPipe) ──► parallax camera   Avatar renderer
                                                    │             (Three.js/WebGL)
                                                    ▼                 │
                                          Off-axis 3D projection ◄────┘
                                                    │
                                                    ▼
                                        Composited scene → TV/display
                                        (fire background + frame + face)
```

Everything here runs as **web tech (Three.js/WebGL in a browser or Electron shell)**. That's the right call for you: fastest iteration, huge ecosystem for avatars/shaders, and it moves to the TV later with zero rewrite — just point the same browser session at the TV (or package it in Electron/kiosk mode).

---

## 3. The face — how to get the ACTUAL Memoji, animated

Important finding: I checked the `Tapback-Memojis` repo you sent — it's not a rig. I cloned and read its actual code: it's just 58 pre-made complete flat PNG stickers, picked by hashing a name string, no separated mouth/eyes/eyebrow layers, nothing to animate. It's a lookalike-style *picker*, not an asset pipeline. Same problem as trying to use real Memoji directly: Apple's rendering (`AvatarKit`) is a private framework, no public API, no export of layered parts.

**But there's a much better trick: your iPhone already has your real Memoji, pre-rendered, as a set of static expression stickers — and Apple lets you export them.**

When you build a Memoji on iPhone, iOS auto-generates ~20+ sticker variations of it in the Messages sticker drawer: neutral, big smile, laughing (mouth wide open), surprised "oh" mouth, wink/eyes-closed, kissy-face, etc. — all rendered by Apple's actual engine, all of *your* Memoji, completely free for personal use. You can save each one as a transparent PNG straight from the Stickers app (long-press → Save Image, or share to Photos). That's real pixel-perfect Memoji artwork, zero illustration work needed.

**How this becomes an animated talking face:**
1. Export ~6-8 of your Memoji stickers covering the mouth-shape range we need: closed/neutral, small-open, wide-open (laughing), rounded "oh" (for O/W sounds), smile-talking. Grab 1-2 blink/eyes-closed variants too.
2. Since Apple renders your Memoji from a consistent head position across stickers, they line up closely enough to crossfade between — we treat this as a sprite-swap "puppet": one image on screen at a time, swapped/crossfaded based on which mouth shape the AI's speech audio calls for right now (either simple amplitude-based open/closed, or proper viseme timing if we pull that from the TTS).
3. This sprite sits as a flat plane inside the 3D scene at a fixed depth, so it reads as "a presence in the mirror" while the fire and frame around it still get full parallax depth (the classic 2.5D "diorama" look — flat character layers at different depths, very effective, used all over animation/games).
4. Later, if you want the face itself to rotate/tilt with your head movement (not just the background), that's the "Phase 6" upgrade in §7 — sculpting an actual 3D head is the only way to get that, since a photo-real Memoji sticker is inherently 2D.

This gets you the literal, actual, pixel-perfect Memoji look — not a lookalike — for free, using assets Apple already generated for you.

---

## 4. The "not-flat" illusion — how off-axis projection actually works

This is the same principle as the classic "virtual window" demos:

1. Track the viewer's head position in 3D relative to the screen (webcam + MediaPipe Face Landmarker gives you this — it can output real 3D landmarks, roughly estimating distance from face size).
2. Instead of moving the *whole scene*, you recompute the 3D camera's **projection matrix asymmetrically** each frame, based on head position — this is the key trick. A normal camera has a symmetric frustum; here you skew it so it matches where your eye actually is relative to the "window" (the TV bezel).
3. Render the scene (fire, mirror frame, face) through that skewed camera.
4. Result: as you move left/right/up/down, the scene behind the "glass" appears to shift with correct parallax — like there's real depth and a real room back there, not a picture.

This is a solved problem — there are working open-source reference implementations (e.g. an "off-axis-projection" demo and a project literally called "Portal" doing exactly this with Three.js + MediaPipe) we can adapt rather than build from scratch. No RealSense, no eye-tracking hardware, no Kinect needed — a laptop webcam is enough for the prototype; a wide-FOV USB webcam mounted at the top of the TV will be enough for the final build.

Two feasibility notes:
- It works best for **one primary viewer** at a time (whoever's face is tracked/closest). Multiple people in frame need a "pick the main viewer" rule.
- It's more convincing at close-to-medium range (arm's length to ~6 ft) — which matches a mirror use case well.

---

## 5. The fire / atmosphere background

Pure WebGL/shader territory, no exotic tech needed:
- A GLSL fragment shader fire effect (classic Perlin/simplex-noise-based fire, well documented, runs great on a laptop GPU) rendered behind/around the face, in a Three.js scene.
- Layer it so the fire appears to be "inside" the mirror frame (using the parallax depth from §4, the fire can literally sit at a different virtual depth than the face — face closer to glass, fire further back — which sells the depth illusion even more).
- The mirror "frame" itself can be a simple ornate PNG/3D border overlay to visually anchor the illusion (screen edges disappearing into a dark bezel helps a lot — worth actually building/painting a real physical frame around the TV eventually, since a visible LCD bezel breaks the effect).

---

## 6. The voice/brain layer

**OpenAI Realtime API (`gpt-realtime-2.1`, or the cheaper `-mini` variant)** or **Gemini Live** — both do:
- Mic audio streamed in, model audio streamed back out, in one persistent connection (WebRTC recommended for lowest latency + built-in echo cancellation, which matters a lot for a mirror since your speaker and mic are in the same room).
- Native interruption handling (you can talk over it, like a real conversation).
- Function/tool calling mid-conversation — useful later for "mirror, what's the weather" type features.
- You get either raw audio out (drive lip-sync from amplitude/phoneme analysis of that audio) or, if you go the Azure/ElevenLabs TTS route instead for the voice, real viseme timing data for more accurate lip-sync. Worth prototyping both — Realtime API's own voice is easiest to wire up; a separate TTS gives you more control over "does this sound like an evil queen."

Cost-wise, this is metered per minute of conversation (roughly $0.03–0.08/min ballpark for full-size models as of mid-2026, cheaper with the mini variants) — fine for personal use, worth keeping in mind if it's going to be "on" and listening a lot.

---

## 7. Phased build plan

1. **Phase 0 — Static scene:** Get the fire shader + mirror frame rendering nicely on your laptop, no face yet. Nail the "black background with dark fire" look first since it's the easiest win and sets the whole mood.
2. **Phase 1 — Face, no AI:** Drop in a Ready Player Me avatar via TalkingHead.js, get it blinking/idling/lip-syncing to a canned audio file. Confirm the "living presence in the mirror" feel before wiring up AI.
3. **Phase 2 — Depth illusion:** Add MediaPipe head tracking + off-axis projection. This is the "wow" moment — do it once the face already looks good, so you're not debugging two hard things at once.
4. **Phase 3 — Voice AI:** Wire up OpenAI Realtime (or Gemini Live) for mic-in/speech-out, drive the avatar's mouth from the response audio in real time.
5. **Phase 4 — Personality:** System prompt to make it actually talk like the Evil Queen (or whatever persona you want), give it a distinct voice, maybe a wake word so it's not always listening.
6. **Phase 5 — Hardware move:** Port from laptop to TV — mount a webcam+mic+speaker at the TV, run the same Electron app in kiosk/fullscreen, point it at the TV. Minimal code changes since it was built as a web-tech app from the start.
7. **Phase 6 (optional upgrade) — True 3D head:** If the flat sprite-puppet feels too flat once everything else is working, sculpt a simple toon-shaded 3D head matching your Memoji's proportions and rig it with blendshapes, so the face itself can rotate/tilt in the parallax effect, not just sit as a flat layer.

---

## 8. Asset checklist (what you need to export from your phone before we wire up the face)

From the Messages app Memoji sticker drawer, save these as transparent PNGs:
- [ ] Neutral / mouth closed
- [ ] Small mouth open (talking)
- [ ] Wide mouth open (laughing)
- [ ] Rounded "oh" mouth (for O/W sounds)
- [ ] Smiling while talking, if available
- [ ] 1-2 blink / eyes-closed variants
- [ ] Any expression you specifically want available (surprised, kissy-face, etc. — optional flair for reactions)
