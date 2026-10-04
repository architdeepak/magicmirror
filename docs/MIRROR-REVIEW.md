# 43-inch portrait mirror review

Reviewed 2026-10-03. This is a source review, not a visual assessment of the installed TV. No application behavior was changed. `npm run verify` passed (syntax, expression mixer, and file/closet invariants). These checks do not establish visual quality, working voice conversation, camera accuracy, or long-running stability.

## What exists

Electron owns the desktop window, configuration, Gemini token creation, local memory, and closet files (`main.js`, `preload.js`). `renderer.js` coordinates a Three.js scene, local MediaPipe face/hand tracking, a canvas avatar, wake-word recognition, voice conversation, ambient widgets, AR, and media playback. Most styling and all screen markup live in `index.html`.

The default experience is Ambient. Conversation is the internal `portal` mode, reached through voice, host selection, gestures, or a keyboard shortcut; it has no explicit top navigation button. Clothing try-on currently captures a local frame and job metadata; it does not generate a dressed image. The visible default avatar is animated raster head art, not the experimental GLB rig.

## Priority 0: fix presentation and installation

1. **Overlapping controls.** In `index.html`, `.bottom-dock` and `.settings-toggle` share the same right and bottom offsets. The dock has a higher stacking level and contains the microphone control. Give the controls one explicit layout with separate positions and verify their bounding rectangles at each target display size.
2. **Sizing follows the wrong surface.** `#app-shell` is a constrained 9:16 rectangle, but much of its typography and spacing uses `vw`, and breakpoints use window width. A wide laptop preview can therefore size the UI differently from an equally sized portrait surface. Windows scaling also changes CSS dimensions. Use shell-relative container units and container queries, with a single coherent scale; validate 540x960, 1080x1920, and 2160x3840 surfaces plus the actual Windows scaling setting.
3. **Conflicting CSS.** Several successive visual redesign blocks override the same selectors. For example, the compact edge transcript rules are later replaced by a wide transcript while retaining right alignment. Consolidate the cascade into a stylesheet with explicit rules for each mode. Include long transcripts, settings open, and media playing in visual review.
4. **TV selection is absent.** `createWindow()` starts a 540x960 window without selecting an Electron display or setting its coordinates. Kiosk startup does not explicitly target the external TV. Add a persisted display choice and position the window on that display before entering kiosk, with recovery if the display disconnects.
5. **The camera choice does not survive restart.** Camera selection is held in module state, while automatic scoring gives integrated/front cameras a positive score. Persist the selected device and use it when available; show a clear fallback if it disappears. Otherwise the laptop camera can drive the TV after restart.

## Priority 1: make the mirror experience intentional

- **Ambient:** use a black field, readable clock/date/weather at the edges, and a clear central reflection area. Remove the brand, quote card, persistent mode/depth switches, and service promotional copy from the default installation view. Put setup controls in an operator panel. These are proposed design changes, not existing behavior.
- **Conversation:** choose one primary host and tune its size, eye-level placement, lighting, gaze, and speech together. `AvatarController` hides the TalkingHead canvas, uses `FaceHost` for visible performance, and deliberately hides `RigFaceHost`. Changing the GLB alone will not improve the visible host. Snow currently combines a v3 idle image with v2 speech images; review registration and appearance across transitions before promoting it.
- **Avatar resilience:** visible face-host initialization is inside the same `try` block as the starter TalkingHead GLB load. A failure in that load replaces the whole host with a fallback symbol. Initialize the visual host independently, so speech/rig failures can degrade separately.
- **Interaction:** wake-word voice and a deliberate visible hand pointer now offer hands-free entry and navigation. Existing text inputs still need an operator keyboard or another control surface.
- **Camera effects:** the mirrored 16:9 webcam feed uses `object-fit: cover` on a 9:16 display. At those aspect ratios it retains only about 32% of the original image width. Provide framing guidance and evaluate a portrait capture or contained studio viewport. The overlay is aligned to the displayed camera image; it is not calibrated to the viewer's physical reflection. A camera image through mirror glass can create an apparent second face; assess that on the installation before calling the effects reflection-aligned AR.
- **Depth:** the off-axis projection uses normalized dimensions and face-derived relative distance, not measured installation geometry. Keep it optional until neutral alignment, lateral movement, and face-loss behavior are validated. Add physical screen/viewing-distance configuration if a convincing virtual-window illusion is the goal.

## Priority 2: daily-use reliability

- Weather is fetched at construction or city change, with no periodic refresh. Add bounded refreshes, request timeout, validated response values, and last-updated/offline status. City selection is restricted to five hardcoded cities.
- Face and hand models come from remote URLs at initialization; fonts also load remotely. Bundle or deliberately cache critical assets and verify a cold offline start. The current offline claim needs qualification.
- The main animation loop runs tracking, avatar updates, AR clearing, and scene rendering continuously. Hand gestures are enabled by default. Measure CPU/GPU load on this laptop, then gate inactive rendering/inference and add a low-power ambient state. Preserve deliberate wake behavior.
- Memory, closet, and captures are written relative to the project/application directory. Move writable state to Electron's user-data directory, with migration, before relying on packaged installations.
- Vision sharing defaults on when no preference is stored. Make the first-use choice explicit and show when frames are being sent; distinguish camera tracking from assistant sharing in the interface.
- The renderer watchdog is useful, but repeated crash recovery has no backoff. Add bounded recovery and a visible safe mode so a persistent GPU fault does not become an endless reload cycle.
- Tests currently miss control overlap, responsive layout, startup failures, camera reselection, weather aging, and device reconnection. Add targeted layout/runtime coverage instead of interpreting syntax checks as hardware validation.

## Recommended work order

1. Record the TV resolution, Windows scaling, mount/viewer heights, viewing distance, camera position, and the most visible defect. Photograph Ambient and Conversation through the installed glass in normal room lighting.
2. Fix control overlap, consolidate CSS, make sizing shell-relative, and select/persist the display and camera.
3. Build a restrained Ambient view and one deliberate Conversation composition. Keep studio/media features secondary while validating these two core states.
4. Review on the actual glass: readability, central reflection, avatar transitions, camera crop, and depth stability. A clean laptop screenshot cannot establish these properties.
5. Complete offline assets, weather freshness, writable data paths, mode-based performance tuning, and recovery. Run a multi-hour session with network loss, camera unplug/replug, voice interruption, and TV reconnect.

Acceptance should be based on the installed mirror: separate accessible controls, legible essential text from the usual standing position, a clear reflection in Ambient, a coherent speaking host, correct display/camera after restart, honest feature states, and graceful recovery from device/network loss.
