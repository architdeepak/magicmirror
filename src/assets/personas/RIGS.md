# Mirror host rig contract

The portrait artwork establishes visual direction only; it is not used as a live
avatar. Each production host must be a local GLB at the path below:

- `evil-queen.glb`
- `snow.glb`
- `advit.glb`

Every rig must have a textured face, a compatible head/neck armature, and the
52 standard ARKit expression targets. Before activating a rig, run:

```bash
npm run rig:check -- src/assets/personas/evil-queen.glb
```

The gate requires all lip-sync essentials and at least 48/52 named ARKit
targets. This is what allows local MediaPipe tracking, streamed speech visemes,
blinks, gaze, smiles, and expressions to carry across all three hosts.

## Custom face-only candidates

`velora-3d-source-v1.png` and `solenne-3d-source-v1.png` are original,
front-facing source portraits. `velora-3d-v1.glb` and `solenne-3d-v1.glb` are
their compact exports from the local Face-to-Blendshape lab. They pass the
52/52 ARKit naming gate and are useful for motion/latency integration, but are
**staging assets**, not production artwork: the lab currently adds a neutral
underlay skull that fails the mirror's visual review.

Rebuild a candidate with:

```bash
electron --no-sandbox --headless --disable-gpu tools/build-stylized-rig.cjs \
  src/assets/personas/velora-3d-source-v1.png src/assets/personas/velora-3d-v1.glb
```

Promotion requires both `rig:check` passing and a clean `npm run
preview:rig-gate` screenshot: face-only silhouette, no neutral underlay,
stable proportions, and no texture seams during mouth movement.
