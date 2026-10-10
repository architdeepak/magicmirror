# Photographed sleeve taper

## What changed

Long photo sleeves previously sampled the garment contour for UV placement while their displayed radius followed a linear cone. This inflated some upper sleeves and discarded the photographed taper. At image ingestion, each existing sleeve row now stores its cross-sectional width relative to a linear root-to-cuff reference. Geometry interpolates that bounded profile once per existing mesh row.

Scale is limited to 0.5–1.5 and exactly 1 at the shoulder root and cuff. Shared torso seams, tracked wrist binding, source UV identity, foreground occlusion, visibility gating, missing-arm recovery and source originals remain intact. Short sleeves and legacy patterns without width metadata keep their original taper. There are no additional triangles, image readbacks or inference requests; a small bounded profile computation is added at mesh construction. This is approximate visual shaping, not measured fit or cloth simulation.

## Evidence

- `npm test`, photo-sleeve geometry/profile tests, packaging and whitespace checks pass. Tests cover source bounds, interpolation, endpoints, legacy/invalid-value fallbacks, down/raised/crossed arms, fitting lengths, shoulder seams and missing-arm recovery.
- [36-photo corpus report](PHOTO-WIDTH-CORPUS-2026-10-09.json): all 11 accepted long photos retain classification; 33 identical pose pairs have finite full-sleeve meshes and unchanged triangle counts. Native contact sheets reviewed: [shirts/sweaters](media/photo-width-corpus-1.png), [blouses/outerwear](media/photo-width-corpus-2.png), [shirts/jacket](media/photo-width-corpus-3.png). Each pose pair shows linear then photographed width.
- [Frozen replay report](PHOTO-WIDTH-REPLAY-2026-10-09.json): `MIRROR_REPLAY_WIDTH=true xvfb-run -a node_modules/.bin/electron --no-sandbox tools/check-long-photo-replay.cjs`: four frozen camera/pose/world/mask inputs retain three visible fits and the fourth lost-body state. Both versions use articulated geometry with identical source pixels and occlusion; removing width metadata selects the linear baseline. Each visible mesh remains 448 triangles. Default cuff centers match projected wrists to numerical precision. [Frozen turn comparison](media/photo-width-frozen-turn.png).
- [Final packaged lifecycle run](PHOTO-WIDTH-LIFECYCLE-2026-10-09.json): 65 seconds, 18 samples, zero recorded errors. Actual recorded stream, native photo ingestion, local pose/segmentation, NVIDIA optional rig and synthetic PCM/local classifier; AR/camera mirror/off/accelerated owned sleep/wake cleanup pass.
- [Exact archive and source/tool hashes](PHOTO-WIDTH-BUILD-2026-10-09.json). Archive `df3827d0cddc1c020b0103c6c20d3ec158852e12c895ce7ba1ba944daa43638b`.

The corpus harness first used a hidden non-offscreen window and completed slowly. Its positive terminal result was verified; an attempted termination found the process already absent. The final harness uses offscreen rendering, disables background throttling and has a 90-second deadline; its separate run also passes. No application failure or lost-window diagnosis is inferred from that observation delay.

## Still open

Armhole and shoulder geometry, stretched fabric through bends/turns, side/back continuity and natural folds still need improvement. Frozen camera backgrounds contain existing motion ghosting; this change does not fix that. Synthetic poses do not validate physical fit or sensor accuracy. These short shared-host checks establish bounded geometry and cleanup, not power savings, display FPS, natural speech accuracy or Windows/TV qualification. G3 and G7 remain open.
