Reflect Mirror - Windows x64 package

1. Extract the complete ZIP into a local folder on the PC stick.
2. Set the TV display to Portrait in Windows Display Settings.
3. Connect the top-mounted camera and select the TV as the Windows audio output.
4. Double-click Start Mirror.cmd to launch full-screen kiosk mode.
   Open Settings Window.cmd starts a normal window for initial setup instead.
5. In mirror Settings, select the camera and the top-center TV mounting profile.
   Add your Gemini key for live voice. For music, install/sign in to Spotify on
   this PC and start a song. Music follows its local Windows media session;
   no Spotify developer client ID is needed. Select the TV as Windows output.
   Decart is the optional cloud AI that generates realistic moving outfits;
   its account/key is separate. The built-in garment overlay is approximate.
6. Use Listen, or enable Wake word and say "mirror mirror".
   "Mirror stop" stops voice/actions until the next wake. Hard mute disables
   listening and the wake detector until you unmute.
7. English wake/stop, face, hand, pose and body occlusion models are bundled.
   Tracking and local wake recognition initialize offline.
   Internet access is needed for the configured cloud services.

Optional login startup: create a shortcut to Start Mirror.cmd in the Windows
Startup folder (Win+R, shell:startup). The package does not change Windows
startup settings automatically. Keep the extracted application folder in place.

No Node.js, npm, Git, or developer checkout is needed to run this package.
Connections and personal data are stored in your Windows user profile, not here.

Troubleshooting:
- Settings > Diagnostics (or D) shows live rendering/tracking information.
- Settings > Save diagnostics writes a JSON report to a folder you choose.
  It includes runtime status, source fingerprints and recent lifecycle errors.
  It excludes keys, conversations, images, browser URLs and garment names.
- Debug Mirror.cmd opens DevTools, including when the mirror is already running.
  Use its Console to inspect errors. Review console content before sharing it.
- Local lifecycle logs rotate automatically in the application user-profile
  diagnostics folder. After repeated crashes, automatic reloads pause and a
  dialog offers Retry, Open diagnostic logs, or Close mirror.
- When updating, extract the new ZIP into a new folder and close the old app
  before launching the new one. Saved settings and wardrobe stay in your profile.

This ZIP is unsigned. It was built and its archive checked on Linux ARM64.
Actual Windows launch, camera/microphone/speakers, native computer input,
phone casting, generated try-on quality, and performance on your PC stick
still require verification. Package success is not hardware verification.
