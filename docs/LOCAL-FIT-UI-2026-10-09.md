# Local fit in the main Wardrobe controls — 2026-10-09

Width, length and vertical-position sliders previously lived inside the hidden optional-tools section with neural preview and still-render settings. They now appear in the main Wardrobe panel, alongside normal clothing controls. A compact “Adjust fit” heading includes the existing local voice command “make it wider”; “Height” is labeled “Up / down” to describe its actual action. View-dependent hiding remains attached to the same fit element.

[540 portrait](media/local-fit-main-540.png), [720 portrait](media/local-fit-main-720.png), [1080 portrait](media/local-fit-main-1080.png).

## Exact-build verification

Package `457fdd7df5cd1fa2ed6777cf3e332e473e17c538425451278315bb9ecafdcc46`; embedded layout/style sources match current source. [Saved runtime/viewport tests and source hashes](LOCAL-FIT-UI-VERIFICATION.json).

- Actual packaged checks at three portrait sizes confirm fit is inside Wardrobe and outside optional tools, with optional tools still closed. Real Chromium ArrowRight input moves width from 1 to 1.2; Reset restores 1. The compact closed tray remains below 22% of each viewport height.
- Existing full wardrobe journey passes 30 starters, native saved photos/persistence, originals, paired views, photo capture, synthetic gesture routes, editor Stop/mute/captions, phone upload and camera release/restart checks.
- General four-viewport UI audit and full tests pass. Reviewed screenshots confirm the fit controls occupy the regular panel and retain its bounded scrolling.

This rearranges existing controls; it adds no camera work, worker or animation loop. Photo/pose/gesture fixtures do not establish physical garment drape, recognition or Windows behavior. Broad usability with physical inputs and all G1–G8 gates remain open. The current camera/AR monitor freezes older source `c14aa05` and does not qualify this layout.
