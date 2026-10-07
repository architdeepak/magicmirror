# Local AR wardrobe progress — 2026-10-07

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
