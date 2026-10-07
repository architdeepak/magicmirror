# Local AR wardrobe progress — 2026-10-07

## Photo sleeves and moving-camera alignment

Recognizable short-sleeved photo cutouts now get shoulder, underarm, and cuff regions inferred from their alpha outline at load time. Their source pixels are bound to the torso and upper arms, with shared sewn UV roots and depth ordering. No per-frame photo model or cloud generation is used. A real public polo photo was loaded through the packaged upload/save workflow and its sleeve pattern verified. A long-sleeved photo and ambiguous/solid outlines keep the existing torso preview. Automatic photo fitting is currently limited to short-sleeved tops/outerwear, not long sleeves, layered outfits, or a reconstructed garment.

The initial synthetic raised-arm render stretched sleeves and compressed the collar. Shoulder seam positions and body mapping were revised, then down/raised/crossed images were inspected again. Finite geometry and shared UV seams are covered by `test:photo-sleeves`; real photo raster evidence is in `PHOTO-SLEEVES-VERIFICATION.json` and ignored `artifacts/sleeves/photo-*.png`. Geometric seams being continuous does not prove clothing fit.

A 20-second recorded dance clip now runs through the actual offline pose and segmentation workers. This found stale-result gaps and a second problem: fresh video underneath an older pose made the garment drift. The worker now transfers the exact analyzed camera bitmap back to the renderer. A separate mirrored camera canvas uses that frame under the corresponding garment and mask, retaining the 400 ms freshness limit. Bitmaps are closed on replacement, camera change, disable, failure, and disposal. Assistant vision draws the same displayed camera canvas.

Software WebGL now selects CPU pose inference before model loading. Slow CPU masks run on one in three poses; intervening frames use fresh lightweight poses and the existing pose occlusion approximation. Masks stay tied to their own frame; stale masks are not reused on newer poses. Mask input is bounded to 320×240 while the displayed frame is bounded to 960×720. This trades contour detail between sampled mask frames for steadier movement; it is not the final fidelity solution.

The recorded replay kept the garment visible on 573 of 613 warm display ticks (93.5%), compared with 419 of 607 (69.0%) in the preceding full-mask run. Typical pose-only inference was about 22 ms; masked frames remained about 195–237 ms. The UI heartbeat's maximum gap was 72 ms. Blank-camera and camera-off checks cleared the garment. See `PHOTO-FIT-MOTION-VERIFICATION.json`; the test asserts over 80% visibility without lengthening the freshness limit. This is recorded human motion through a synthetic camera stream on the development machine, not physical camera/gesture validation or a Windows power test.

The reviewed moving-person images still expose gaps in side coverage, photo proportions, and fabric realism. The implementation is a front photographic surface following body joints; full 3D cloth, accurate fitting, hidden/back material, robust long sleeve ingestion, and multi-layer outfit handling remain outstanding. The full mirror goal is not complete.

`npm test`, the real-photo sleeve raster check, the packaged seven-garment workflow, and the live-fit raster/actual-worker/full-app integration check passed after these changes. The latter waits for a fresh sampled mask rather than assuming every pose contains one. Bitmap freshness/closure and assistant vision's synchronized camera selection are covered by unit checks. Future soak monitors copy the packaged build into an isolated temporary directory and record its archive SHA-256 and Git revision, so rebuilding `dist` cannot change resources under the running monitor. Recorded monitor errors now produce a failing exit code.

## Worn-photo ingestion and graphics follow-up

The editor now offers **Extract worn clothing** after upload, phone transfer, or camera capture. It uses the already bundled MediaPipe multiclass model, offline in a disposable CPU worker; it preserves source RGB and changes only transparency. The worker is cancelled when a photo changes or the editor closes, has a 30-second timeout, and never runs continuously in the AR loop. No cloud key, Python installation, or additional weights are required. Google's [model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf) identifies the clothing class and Apache 2.0 license.

Say **extract clothing**, **trim bottom**, **extend bottom**, **trim top**, **extend top**, or **restore photo**. Each trim changes the edge by five percentage points, bounded to retain at least five percent of the image. After extraction, swipe up/down trims/extends the bottom; horizontal swipes still choose type and pinch saves. The top/bottom sliders also work with a mouse or touchscreen. Save remains an explicit action. The original photo remains available; restore resets extraction and cropping.

Actual offline Electron-worker checks on two public worn-clothing photos took approximately 384–588 ms including model setup across two checks, with 224–333 ms inference. UI heartbeats advanced and no RGB channel changed. This model includes **all visible clothes**, so the seated-photo result included trousers. Reviewed upper-body cropping removed them in the packaged photo editor. It cannot reconstruct hidden fabric, flatten folds, infer accurate sizing, separate overlapping layers, or produce a complete 3D garment. Flat/hanging photos remain the easiest dependable starting point.

The packaged wardrobe check saved seven garments and exercised real file input, native persistence, local model extraction, voice tool callbacks, interpreted swipe cropping, synthetic camera capture, and paired HTTP phone upload. These do not prove physical microphone, gesture, phone-camera, or clothing fit performance. Evidence: ignored `artifacts/photo-clothing/result.json`, `artifacts/wardrobe/worn-clothing-crop.png`, and tracked `docs/AR-WARDROBE-VERIFICATION.json`.

A separate FASHN human-parser experiment ran on the Spark with about 38–51 ms warm inference. Its inherited [NVIDIA SegFormer license](https://raw.githubusercontent.com/NVlabs/SegFormer/master/LICENSE) restricts use to research/evaluation. It is not integrated or bundled. The app uses MediaPipe instead.

Flat views now retain the rendered room backdrop and animate the face independently. Room rendering resumes on depth/reveal, mode changes, resize, DPR change, wake, and WebGL context restoration. The actual power check measured zero repeated scene draws with face animation around 27 FPS. Flat Queen renderer CPU was about 7–8% in this short software-rendering check, compared with about 49% in the earlier resumed-view check; this is not a whole-process or Windows wattage measurement. Depth rendering remains expensive under software graphics. Sleep had zero scene/face draws and about 2% renderer CPU.

The previous build's 30-minute monitor (`2026-10-07T20-08-39-289Z`) finished with 589 samples and zero recorded errors, muted with camera and depth disabled. It predates these photo/graphics changes. GitHub progress remains on `codex/local-ar-wardrobe`; remote main's independent changes still need reconciliation.

## Added

- A photo editor replaces blocking name/category prompts. Upload JPG, PNG, or WebP (up to 20 MB), or explicitly capture the mirror camera. No capture is saved until Save garment.
- Local, reversible border-connected plain-background cutout, with a strength slider and contrast/complex-background errors. Light, dark, and colored backgrounds are supported; transparent PNGs bypass removal. Editing works at a maximum 1024 pixels per side and runs only when requested, outside the live render loop.
- Save a cropped transparent PNG and the original resized photo under the local app profile. Writes are serialized and the closet manifest is replaced atomically. Renderer data is validated and decoded again in Electron before writing.
- Phone photo ingestion: From phone opens a QR for a paired local Wi-Fi upload. Phone resizing happens before transmission; the mirror accepts one validated photo while the editor is waiting, then requires review and explicit save. Closing the editor stops photo acceptance.
- Thirty original bundled vector garments: T-shirt, long sleeve, blouse, dress, skirt; black, white, blue, red, green, purple. These are demonstration garments, not photographic samples or measured 3D clothing. Their assets require no downloads or API.
- Skirts use a continuous hip-to-knee mesh rather than separate trouser legs.
- Voice actions through a live assistant wardrobe tool: add garment, take photo, name it…, type dress/top/jacket/skirt/trousers, save garment, cancel photo, next/previous garment, make it red, change style to blouse.
- Editor swipe changes clothing type; pinch captures then saves. The editor intercepts those gestures so they do not change the garment underneath. Existing open-palm assistant Stop remains available. Outside the editor, horizontal swipes select garments.
- A live assistant state report includes photo-editor visibility, readiness, and save state.

## Limits and remaining work

Plain-background extraction is not general clothing segmentation. Clothing against a similar color can disappear; complex backgrounds need an existing transparent cutout. A front photo supplies a front texture, not back geometry, hidden surfaces, fabric simulation, or accurate sizing. Photos retain their real colors; color/style substitutions apply only to starter garments.

The main live overlay still uses a body-landmark mesh and contour occlusion. It is not yet the requested realistic 3D cloth system. Prepared 3D garment templates, better sleeve deformation, calibrated clothing anchors, and realistic fabric behavior remain required. Optional back-photo ingestion is outstanding. Windows and a physical camera remain later validation steps per the user's direction.

## Verification

`npm test` includes the cutout pixel tests. `npm run check:wardrobe:ui` exercises the packaged Electron UI with an actual public garment photo and real local IPC writes/reload, plus synthetic video capture, interpreted swipe/pinch routing, and an actual paired HTTP phone upload with unauthorized, cross-origin, invalid-image, and closed-editor requests checked. A real phone browser/camera has not been tested. The UI script writes ignored screenshots and its exact result to `artifacts/wardrobe/`.

The earlier 30-minute soak completed with 589 samples and no recorded errors: `artifacts/monitor/2026-10-07T06-23-16-112Z/summary.json`. It covered a muted, camera-off packaged app across modes. Its software-rendering active CPU usage was substantial (~two CPU cores); it does not establish PC-stick wattage or combined camera/voice performance.

## Follow-up: editor voice controls and starter sleeves

The photo editor now includes Start/Stop listening, Stop voice, and a hard-mute toggle. It moves the existing two caption rows into the dialog while open and restores them on close. The packaged UI check verifies mute/unmute, Stop without closing the editor, and caption restoration after save.

T-shirt, blouse, and long-sleeved starter garments have explicit sleeve/body source regions bound to shoulders, elbows, and wrists. Source UVs use the actual texture crop, sewn root endpoints remain shared with the torso, and depth sorts crossed arms. Missing or degenerate arm chains use the prior torso preview. Covered forearms are retained under long sleeves while foreground hands can still occlude them. At this stage uploaded photos kept their torso preview; the follow-up below adds outline-derived short sleeve fitting.

The first fixed-strip experiment produced visibly skinny detached sleeves and was replaced before committing. The corrected down/raised/crossed-arm synthetic previews are in ignored `artifacts/sleeves/`. `test:starter-sleeves` checks seams, finite geometry, depth sorting, and tracking fallback; `check:sleeves` rasterizes the known starter texture and checks forearm occlusion. These are useful articulation checks, not proof of realistic clothing on a moving person. Prepared 3D cloth and fitting uploaded photos remain outstanding.

The subsequent 30-minute muted/camera-off soak finished with 589 samples and zero recorded errors: `artifacts/monitor/2026-10-07T18-13-22-741Z/summary.json`. Software rendering still consumes substantial active CPU; this is not a PC-stick efficiency pass.

Camera capture now starts the mirror camera when needed. Capture and phone uploads suggest a unique editable name, with the clothing type reflected in that name until the user edits it. The packaged check includes capture/type/save using interpreted gestures without typing. It also verifies that the same two caption rows retain different colors at the screen bottom during photo editing, and return to their normal container on close.

An additional portrait-crop check prevents a detected body wholly outside the displayed camera crop from being reported as a visible garment. The assistant receives a centering hint in that case.

Camera capture is owned by the current photo-editor generation. Closing/reopening the editor or replacing a pending capture with an upload does not let the old camera result clear a newer request or replace the current photo. This is covered by the asynchronous capture ownership test.

## Sleep audit follow-up

The 18:54 soak completed with one recorded sleep-budget mismatch: the sleeping state could precede the zero-FPS telemetry update. Sleep now synchronously cancels the scheduled frame and publishes its zero budget. The packaged power check asserts the budget immediately inside the sleep callback, not just after a delay. It also verifies stopped Converse returns to sleep after inactivity; active listening, media modes, and photo editing are excluded.

The updated accelerated-timer check measured zero scene/face draws in both Ambient sleep and stopped Converse sleep, with approximately 1.55% and 1.62% renderer CPU respectively. These are short, muted, camera-off development measurements; they exclude other processes and do not measure installation wattage. Active software-rendering efficiency still needs work.
