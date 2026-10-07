# Mirror integration contracts

## Local closet

`Try on → Add garment` copies an image into `data/closet/<garment-id>/front.*`.
`data/closet.json` remains the local source of truth. Prefer a clean,
front-facing transparent PNG; importing does not upload the garment.

## Try-on job boundary

The live camera fit uses [MediaPipe's Pose Landmarker Lite](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) in a local worker.
It transfers at most one reduced camera frame at a time and performs inference
only while a selected garment is shown in the live Try On view. Shoulders and
hips anchor a photographic garment mesh; bottoms require visible knees and
ankles too. Torso edges keep each shoulder paired with its anatomical hip.
Trouser meshes insert exact knee and cuff anchors, including after length
adjustment, and use a bounded continuous knee join when the leg bends.
Crossing legs retain their texture identity and paint the nearer triangles
in front using pose depth. The same worker frame also runs Google's [multiclass body segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter).
Skin contours select the visible forearms and hands nearer than the torso;
hair and face remain in front of the garment. The output mask and pose share
a timestamp, camera generation, and freshness limit. The renderer applies the
same mirrored cover crop to the mask and camera, and never saves or uploads
this mask. If segmentation cannot run, pose-based limb occlusion remains
available. Detected software GPUs select CPU segmentation immediately. Warm inference over 280 ms for three consecutive frames switches
segmentation from GPU to CPU; if CPU remains too slow, detailed occlusion is
disabled for that worker with an explicit status so it does not starve pose
tracking. These timings are measured locally, not assumptions about PC-stick
hardware. The garment canvas reuses its drawing while pose, mask, camera crop, texture,
and fit are unchanged. Tracking still updates on every display tick, and
expired landmarks, camera changes/off, or leaving the mode clear the drawing.
Missing or stale body landmarks hide the garment. Transparent
garments are used directly, and a uniform pale background can be removed
locally. Complex product photos need a cutout. Width, length, and vertical
offset are persisted per garment. This is an approximate pose-driven preview,
not fabric simulation, a size measurement, or a generated realistic video.
No frame is saved or uploaded by this path. **Live camera** and **Rendered
still** explicitly choose between the moving preview and a static result.

Only after the explicit consent checkbox and a render action (button or an
explicit voice request), the renderer captures one 1024px-or-smaller JPEG into
`data/tryon/` with a local job manifest. If
neither provider is configured, the frame and job manifest stay local and no
external provider is called. The consent label names the target host and
states that provider cost, processing, and retention terms apply. A request is
sent only after checking the consent box and pressing Render or explicitly
asking the assistant to render a still.

### Google Cloud Virtual Try-On

In Settings, select **Google Cloud** under **Try-on still renderer**, enter the
project ID and region, and save. Alternatively set `MIRROR_VERTEX_PROJECT` and
optionally `MIRROR_VERTEX_LOCATION` (defaults
to `us-central1`). Install the Google Cloud CLI and run
`gcloud auth application-default login` on the PC. Enable the Vertex AI API and
billing for that project. Electron
uses ADC in its main process to obtain a short-lived access token; credentials
are not exposed to renderer code. Each user action sends one person frame and
one closet garment to Google's `virtual-try-on-001` endpoint and requests one
watermarked output. Google accepts PNG/JPEG images up to 7 MB each; use one of
those formats for this provider. The result is one generated still image from
the captured pose, not a continuously re-rendered live video layer. The request
has a 120-second timeout. Cancel render, changing garments or cameras,
leaving Try On, withdrawing consent, Stop, and hard mute cancel the pending
request. Cancellation stops waiting and rejects late results; a remote provider
may already have received the frame or started work. Virtual Try-On is billed by Google Cloud, so review
its current pricing before using it.

If both Google Cloud and the generic endpoint are configured, Google Cloud is
used. Otherwise `MIRROR_TRYON_ENDPOINT` can point at a custom adapter.

Settings also supports **Custom renderer** with its URL and optional token.
Remembered tokens use the same encrypted OS storage as the Gemini key; blank
tokens preserve the current credential and **Remove current token** clears it.
**Off** disables rendering even when an environment provider is configured.
Changing provider settings cancels active jobs. Changing destinations clears
UI consent; each request must carry the destination fingerprint from the
current public configuration, and main rejects stale consent before capturing
or uploading a frame. Tokens are never returned to renderer code.

The custom adapter posts JSON to the configured endpoint:

```json
{
  "schema": "magicmirror.tryon.v1",
  "jobId": "tryon-…",
  "personFrame": "data:image/jpeg;base64,…",
  "garment": {
    "id": "garment-…",
    "name": "…",
    "category": "top",
    "image": "data:image/png;base64,…"
  },
  "fitRequest": {
    "preserveIdentity": true,
    "preservePose": true,
    "output": "full-frame-image"
  }
}
```

The endpoint may receive `Authorization: Bearer …` from
`MIRROR_TRYON_API_KEY`. It must return JSON containing `imageDataUrl` or
`imageBase64` and optionally `mimeType` (`image/png`, `image/jpeg`, or
`image/webp`) and a `confidence` from 0 to 1. The response image is limited to
25 MB and shown in the studio. Use HTTPS for remote services; plain HTTP is
accepted only for localhost adapters. A 120-second timeout is enforced.

Provider-specific APIs should be wrapped by a small local adapter that
implements this contract and owns credentials, retries, model-specific
request fields, and cost/retention disclosures. Do not configure an endpoint
until its data handling and charges are understood.

## Connector rules

External service tokens and client secrets belong in Electron's main process or
an OS credential store—not renderer JavaScript, localStorage, or UI state.
Start connectors read-only and add write scopes only after an explicit action.
Find My remains a secure external handoff, not a personal-location connector.

## Desktop browser actions

Gemini Live can open the fixed service launcher entries or a user-requested
HTTP(S) website in a dedicated, persistent Electron browser window. Website
navigation is validated in the Electron main process; non-web protocols and
URLs containing embedded login credentials are rejected. The assistant can
capture the TV's current display and receive a resized JPEG frame as
conversation context. Each screen image is attached to the corresponding
`toolResponse.functionResponses[].parts` as JPEG `inlineData`, including the
fresh capture after an input action. Sending the screen separately as realtime
video produced incorrect clicks in the real-service check; a 1.2 second delay
alone did not resolve that failure. Passive camera frames pause during a screen
tool turn. An input acknowledgement explicitly says that delivery is not proof
of success, and duplicate action responses omit old screenshots/observations.

The optional `node tools/check-live-computer.cjs` check uses the actual packaged
Linux application and Gemini Live on an isolated desktop. It opens a local page
with randomly arranged labeled buttons, asks the model to locate and click
FEATHER, independently records the click, and checks that its spoken result
matches the visible result line. No DOM labels or coordinates are supplied to
the model. It sends the isolated display to Gemini and incurs API usage. Passing
this simple task does not establish reliability on arbitrary sites or native
Windows applications. See `artifacts/live-computer/result.json` and `display.jpg`
for the latest check. After both fixes, three successive real Gemini checks
passed with exactly one FEATHER click and an accurate `DONE: FEATHER` result
(the latest run records the shuffled button order). Regression coverage also
checks coordinate conversion, out-of-range/mismatched snapshot rejection,
and omission of stale images on repeated action calls.

The `--form` variant (`npm run check:computer:form`) exercises the actual
packaged keyboard path: locate a prefilled input, select all, replace it with
`Velora's café`, submit once with Enter, and read the visible saved result. Its
HTTP receiver independently records the exact submitted Unicode value. The
initial run typed correctly but never submitted: Chromium requires a character
event in addition to Enter's key-down/up events. `managedKeyEvents` now sends
that event for Enter and Space. `npm run test:managed-keys` verifies native
Chromium form submission, textarea newline/space, and button activation exactly
once using the production event builder. The fixed real Gemini form check
passed in both the windowed layout and a full 1080×1920 portrait kiosk;
evidence is in `artifacts/live-computer-form`. These isolated software checks
do not verify a physical TV, Windows input, or arbitrary web forms.

The `--scroll` variant (`npm run check:computer:scroll`) places a REVEAL
button below the fold and a random two-word result below that button. The
fixture independently records scrolling and activations; the expected result
is never supplied to the model. Initial real-service runs clicked repeatedly
because the result was just outside the viewport. Prompt instructions alone
did not prevent this. The adapter now rejects another click within 12 units on
the normalized grid of the last delivered click during the same turn, including
calls with a different tool ID. A successful non-click action, navigation,
new user turn, or session stop clears this guard. Seeing the screen alone does
not clear it. This is a guard against nearby consecutive repeat activations,
not a guarantee against every possible duplicate side effect. It also prevents
intentional consecutive clicks at the same point within one turn; the current
computer tool also exposes an explicit `double_click` action for one intentional
double-click. It sends the two transitions as one observed action and is itself
subject to the repeat guard. The managed browser uses Electron click counts;
the Windows bridge sends both clicks in one SendInput batch, after foreground
validation. Actual Windows double-click execution still requires the PC stick. In the first guarded real-service run,
an out-of-range click and a repeated activation were rejected, the model then
scrolled further, and it read the random `AMBER OPAL` message accurately. The
fixture recorded one REVEAL activation. A second guarded run also recorded
one activation and correctly read `AMBER RAVEN`, recovering after stale
coordinates and a repeated click were rejected. This is evidence of recovery on this
local task, not reliable autonomous behavior on arbitrary websites.

Browser controls are limited to click, text entry,
common keys, scroll, and close; click/scroll coordinates refer to the latest
full-display image on a normalized 0–1000 grid. The live adapter converts them
to pixels using the matching snapshot dimensions; the main process then
translates them into the managed browser's content area (or native Windows
input). This follows [Google's coordinate convention](https://ai.google.dev/gemini-api/docs/computer-use.md). Out-of-range coordinates and mismatched
snapshot IDs are rejected. The first shuffled real-service run exposed the old
pixel/normalized mismatch by clicking STONE rather than FEATHER; attaching
images alone was insufficient.
Each click, scroll, key, or text action must use the snapshot ID from the latest
`see_screen` result; the ID expires after 30 seconds and is single-use. The
assistant follows an observe-act-verify loop: it captures immediately before
each action and captures again to check the result. Capture can inspect the
current TV display. On Windows, input uses the foreground native app through
[Win32 SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput);
other platforms restrict input to the managed browser. The bridge translates
screenshot pixels through Electron's DIP-to-screen conversion, checks the
foreground window/process and its bounds, and rejects focus changes or an app
on another display. Native shortcuts include Start, Ctrl+A/L/F, Alt+Tab, and
navigation keys. User text travels as base64 JSON data in a child-process
environment variable and never becomes executable PowerShell source. Only
the packaged fixed bridge runs. Stop and hard mute abort pending bridge work;
already delivered input cannot be undone. Windows may reject input into
elevated apps or secure desktops. `npm run test:desktop:windows` exercises
real Unicode input and clicks in its own test window. Sites may
restrict automation, popups, sign-in, or embedded playback. Search opens its
results in this controlled window.

## Spotify ambient player

On Windows, Music defaults to the **installed Spotify app on this PC** when no
optional Web API account is connected. Install/sign in to Spotify, start a song,
and return to Music. Audio is played by Spotify through the selected Windows
sound output (select the TV in Windows). No developer client ID or mirror OAuth
sign-in is required for this local path. **Open Spotify app** launches it.

The bridge uses [Windows media sessions](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession)
(Windows 10 version 1809 or newer). It selects Spotify sessions only, reads
local title/artist/album/timeline/artwork, and requests Play/Pause/Next/Previous
only when that session enables the control. Artwork is bounded to 1 MB. The
PowerShell helper stays running while needed rather than launching a process
for every poll. Commands bind to the freshly observed Spotify session; Stop
cancels pending bridge requests. Metadata stays in the local Music UI, including
classic and pocket views, and is not sent to Gemini. A requested command is not
reported as proven audible playback. Runtime WinRT and Spotify interoperability
remain unverified on the Windows stick; Linux tests use a helper fixture.

The device selector below applies to the optional Web API account path:

Music now includes a Spotify Connect device selector and **Use device** control.
Open Spotify on the PC/TV, select its available device, and transfer playback.
The transfer preserves the current playing/paused state. Device availability is
checked again before sending; restricted devices are rejected. Playback commands
target the device observed in a fresh player read. An acknowledged transfer is
reported as requested unless a subsequent player read confirms the target.

The [official transfer endpoint](https://developer.spotify.com/documentation/web-api/reference/transfer-a-users-playback)
requires Premium; some devices may not appear in the
[available-device response](https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices).
This feature controls an existing Spotify client; it does not make Electron a
Spotify audio receiver. `npm run test:spotify-devices` checks UI cancellation and
selection, `npm run test:spotify` checks API requests and account changes, and the
packaged check exercises the actual controls with a local bridge fixture. Actual
account playback and sound from the TV remain unverified.

Set `MIRROR_SPOTIFY_CLIENT_ID` to the Spotify developer app's client ID. Add
`http://127.0.0.1/callback` to its redirect URI allowlist. The app binds an
ephemeral loopback port and uses Authorization Code with PKCE; Spotify permits
dynamic ports for loopback IP literals. Refresh tokens are encrypted with
Electron `safeStorage` in the app user-data directory. Scopes are limited to
playback state and playback controls. Current track
metadata/artwork are fetched for local rendering only and are never passed into
Gemini. Screen capture is blocked while the Spotify player or a Spotify embed
is visible. On Windows, foreground Spotify is detected from the native process
and window title; on other platforms, capture is conservatively blocked while a Spotify
window is open. Artwork is not cropped or modified and is shown with Spotify's full
logo and a link that opens the current item in Spotify. Playback progress is
informational only. The visible control is play/pause; play/pause/skip voice
commands control the user's existing Spotify playback device and do not stream
audio. Spotify may require Premium for playback controls. Per-device
restrictions are respected. Disconnect removes the local
encrypted token file.

## LAN media casting

**Enable LAN casting** starts a local [UPnP MediaRenderer](https://openconnectivity.org/developer/specifications/upnp-resources/upnp/mediaserver1-and-mediarenderer1/)
named **Reflect Mirror**. It advertises via SSDP on UDP 1900 and serves device,
AVTransport, RenderingControl, and ConnectionManager descriptions on an
ephemeral HTTP port. Compatible phone apps can discover it and send an HTTP(S)
media resource, then play, pause, seek, stop, adjust volume, or mute. The
receiver uses the mirror's real HTML video player; playing, paused, buffering,
error, position, and duration feedback come from media events. GENA
subscriptions notify controllers of state changes. Event callbacks are
restricted to the subscribing peer's IP address. XML entities/DTDs are
rejected and request bodies are bounded at 64 KB.

No upload, cloud relay, or port forwarding is required. The phone must serve or
provide a media URL the PC can reach. Browser codec support still applies. This
is a media receiver for UPnP/DLNA-compatible applications, not a certified
DLNA device, AirPlay receiver, Google Cast receiver, or phone screen mirror.
Same-network peers can control it while enabled. The receiver starts only from
the visible control and closes on Stop, app closure, renderer crash, or reload.
Wi-Fi client isolation and firewall rules can block discovery or the HTTP
connection. `npm run test:casting` verifies actual loopback UDP/SOAP/GENA;
`npm run test:cast-player` verifies decoded video through the production
preload and Watch UI, including conversation during playback.

## Phone-to-Watch link handoff

Watch can start a temporary HTTP receiver on the selected local IPv4 interface.
The pairing QR contains a random 192-bit token; opening it sets an HttpOnly,
SameSite=Strict cookie, and each link submission must come from the paired
same-origin phone page. The receiver accepts only YouTube, Spotify, or direct
MP4/WebM/OGG URLs, then sends the URL into the mirror's Watch mode. Stop the
receiver from the Watch panel or close the app to invalidate the token.

This shares media links over the local network. It is not a general phone
screen-mirroring receiver, a DLNA/AirPlay/Chromecast device, or a DRM bypass.
The phone and PC stick need to be on the same reachable network; client
isolation or an OS firewall can block the connection.

On Windows, **Set up Windows phone casting** opens the OS Projecting settings
for its separate Miracast receiver. Install the Wireless Display optional
feature, make the PC available for projection, and then use Cast/Smart View on
the phone. This uses Windows' receiver and can take over the TV display while
casting; support depends on the PC's Wi-Fi adapter and the phone's Miracast
support. It does not route the cast through the mirror's Watch player.

## Native hand scrolling

A deliberate vertical swipe in the native companion sends a bounded wheel
message to the child window visible at the center of the exposed TV area on
Windows. This direct user input captures no screenshot and returns no window
text or track metadata. It uses DIP-to-physical coordinates, checks the target
again immediately before sending, excludes the mirror window, and times out
instead of waiting indefinitely for an app. It preserves keyboard focus and
never clicks to activate an app. Stop/mute cancels a pending bridge process;
a wheel message already delivered cannot be undone. Resizing or leaving the
native companion also cancels pending input. Managed browsers continue using
their own Electron wheel events. X11 native scrolling is not yet implemented.

Native Spotify pinch and horizontal swipes use the same connected playback API
as Music mode; pinch refreshes playback state before deciding play or pause.
The Spotify sign-in browser is excluded from this playback gesture routing.
`test:desktop-gestures` verifies routing and cancellation with fixtures;
`check:companion` includes actual wheel delivery in its Windows fixture.

## Live microphone turns

The app now sends explicit audio activity boundaries to Gemini Live. A local
PCM detector retains about 300 ms of onset audio, requires at least 120 ms of
speech-level energy, and finishes after 700 ms of quiet. It sends no idle
silence and clears its buffered samples when microphone sessions change.
Queued callbacks from an old microphone generation are discarded. The Live
setup disables server automatic activity detection to match the explicit
`activityStart` / `activityEnd` protocol described in Google's
[Live capabilities guide](https://ai.google.dev/gemini-api/docs/live-api/capabilities#disable-automatic-vad).

`npm run check:voice:journey` exercises the actual packaged app with synthetic
WAV microphone input, local Vosk, real Gemini Live, and the actual TalkingHead
audio graph. It requires the configured Gemini key and makes live service
requests; it never opens a real microphone or camera and does not request
screen sharing. Run it on an isolated display. Physical room noise, speaker
echo, accents, and mic/speaker latency still require TV validation. The local
energy detector is not a semantic speech classifier; background noise may
require tuning or a stronger local VAD model.

## Hand gesture processing

[MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
runs in a local worker. Camera frames are reduced to at most 640×480 and only
one bitmap is in flight. Software GPUs choose CPU inference; GPU initialization
failures also fall back to CPU. Model loading has a 60-second deadline; frame
processing has a 20-second cold deadline and a 5-second warm deadline.
Results older than 350 ms, disabled sessions, and superseded camera streams
cannot trigger actions. Camera changes and long inference gaps clear gesture
hold state. Frames are neither saved nor uploaded. `npm run check:hand:worker`
checks actual inference with a public hand photo through a synthetic stream;
it does not verify physical-camera gestures on the TV.

## Face and head tracking

Face inference runs in a separate local worker using the same bounded frame
transport as hand tracking. Face frames retain up to 960×720 pixels, are sampled
at most once per 32 ms, and results older than 300 ms are rejected. Landmarks,
blendshapes, and the transform matrix come from the same accepted frame.
Head projection, eye gaze, and calibration consume its capture timestamp;
render-time smoothing remains independent of inference cadence. Camera off and
camera switches invalidate pending frames. GPU initialization falls back to CPU,
with software GPUs selecting CPU immediately. `npm run check:face:worker`
checks the production head-tracking path with a public portrait and a synthetic
camera. Physical camera alignment and latency on the TV remain unverified.

The optional `npm run check:computer:double` check passed with the real Gemini
service and packaged portrait kiosk: one `double_click` command, exactly two
underlying click events and one Chromium `dblclick` event on the requested
shuffled button, followed by `OPENED: FEATHER` readback. Evidence is in
`artifacts/live-computer-double/result.json`. It does not execute Windows input.
