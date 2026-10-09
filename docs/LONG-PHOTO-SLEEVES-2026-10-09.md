# Personal long-sleeve photos and partial tracking

October 9, 2026. Full goal remains active: [master goal](MASTER-GOAL.md). [Verification](LONG-PHOTO-SLEEVES-VERIFICATION.json).

## What changed

Long personal photos previously failed short-sleeve inference and projected their whole bitmap onto the torso. Cuffs could hang beside the chest while the wearer's arms moved elsewhere.

New local inference finds a central body and separated downward sleeve contours in the existing alpha silhouette. It samples each sleeve's visible outer/inner edges once at image load, retaining its fabric pixels. Recognized long sleeves bind through elbow and wrist chains, preserving body/root UV seams and continuous angular history. Source contour knots plus an exact elbow row prevent a single straight quad from replacing the articulated arm. At default fit length, projected cuff centers match tracked wrists. This is landmark binding, not measured sizing or physical cuff accuracy.

A hidden/degenerate elbow or wrist now omits only that sleeve, retaining the correctly mapped torso and other arm. Its old angle history is cleared before recovery. Missing shoulder/hip anchors still clear the full outfit. Per-arm occlusion retains fabric over a fitted long forearm while allowing the hand in front; an unfitted arm keeps the existing bare-forearm behavior. Structured live state exposes sleeve style and missing count, with the same partial-fit guidance the user sees. Ambiguous personal top/jacket photos are labeled torso photo fit.

Upload/phone guidance asks for sleeves spread away from the body. Clothing originals remain unchanged and local. This introduces no paid or generative service and no new animation clock/worker.

## Evidence

Final package: `a9813599fb9d3677abc401084c8cff15f4a8e7b6ea4300f02f5ef77f652a3607`.

- Full npm test passed. Focused tests cover bounded contour samples, synthetic long silhouettes, finite fitted lengths, shared body/sleeve seams, exact default wrist centers, missing one/both arms, hip/shoulder loss and old-angle cleanup. Existing short-sleeve, starter, cache and occlusion tests remain in the suite.
- The packaged journey uses a real DOM plaid-photo upload and native save, checks its original bytes, selects it by the actual wardrobe voice callback, and verifies full/partial/recovered fit plus ended-camera clearing. Camera transport is a real synthetic MediaStream; pose/mask/depth observations are explicit fixtures. It does not prove acoustic recognition or physical input.
- Actual canvas alpha checks retain the covered forearm, erase its foreground hand, and erase an uncovered forearm independently. Existing hand-without-elbow and behind-torso checks also pass.
- Four frozen recorded camera/pose/world/mask inputs compare the previous torso projection and new long sleeves on identical input. Three inputs have usable torso tracking; the fourth clears in both versions. Previously, cuff centers missed projected wrists by about 3–157 pixels. New defaults align within numerical tolerance. These numbers are geometric projections, not real body measurement or garment quality scores.
- A separate moving public-video replay runs through actual bundled offline pose/segmentation workers: 568/614 tracking display ticks visible (92.5%); worst heartbeat gap 102.5 ms; blank frame and camera-off clear. It includes screenshot/capture work on a shared host and is not presented FPS, a controlled performance improvement or physical-camera responsiveness proof.

Review: [matched camera inputs](media/wardrobe-long-matched.png), [actual worker replay](media/wardrobe-long-worker.png), [packaged partial-fit state](media/wardrobe-long-partial.png).

The first matched-replay verifier incorrectly required generic torso vertices to contain z and required usable tracking in all snapshots. Generic canvas torso meshes use x/y/UV, and one frozen input has no usable torso. The corrected verifier checks finite required coordinates, requires z for the articulated mesh, and asserts matching loss gating in both versions. Production behavior was not weakened to make these fixture assumptions pass.

## Cost and supported layouts

The plaid fixture uses 448 triangles versus the previous torso-only 128. Short, shared-host measurements of mesh construction/draw-command submission were about 3.4–5.3 ms for long sleeves versus 1.2–2.2 ms for torso-only. They exclude finishing raster work/encoding and physical display timing; they are not a G7 qualification. Contour scans occur once at load, samples are bounded and existing raster reuse remains. This feature costs more work than drawing only a torso.

The direct texture-preparation corpus has 36 author garment photos: 11 recognized long, 9 short, 13 torso-only and 3 requiring a cutout. [Example inspection sheet](media/wardrobe-photo-corpus.png). Manual review found no obvious false long labels among those accepted. This is not calibrated classifier accuracy or a whole ingestion success rate: the direct JPEG probe uses legacy pale-backdrop removal; the actual editor also supports contrasting backgrounds, extraction and cropping.

Supported long layouts are a centered flat/hanging closed top or jacket with a visible body, cuffs and gaps separating the downward sleeves. Open jackets, folded/crossed source sleeves, cropped/three-quarter styles, loose blouses, sleeveless garments and other ambiguous outlines are not universally articulated. Recognition cannot reconstruct concealed fabric, recover discarded resolution or infer physical garment size. Tops/outerwear use the new binding; photo dress sleeve support remains open.

## Remaining quality work

Matched review improves arm placement, but the shirt still looks photographically stretched, leaves parts of the underlying clothing exposed and has imperfect shoulders/armpits during turns. Ghosting/blur visible in the stored camera imagery is part of the replay input and is not eliminated by cloth deformation. Physical camera/top-camera calibration, multi-person depth, occlusion and body-size/drape accuracy remain open. G3 and G7 are not complete.

Next: use identical frozen inputs to improve torso coverage and shoulder/underarm silhouette, then broaden the supported garment/motion matrix. Measure combined camera/voice/avatar/media cost; continue integration audits and final Windows validation.

The previous immutable source 1de8323 finished its 30-minute camera/cloud/media-off monitor: 591 samples, zero recorded errors. It does not validate this newer sleeve code or qualify the eight-hour release candidate. The separate older eight-hour development run remains on its recorded prior source.
