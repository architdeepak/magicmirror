# Three-dimensional lip contact with expression

## Findings and change

The old `mouthClose` pinched lips toward a constant height and left depth/side gaps. The new unit regression fails on the previous source. The target now brings nine paired inner lip vertices together in all three axes; shared corners stay joined. Left/right press accents act on surrounding lip tissue, with side-specific weights, instead of moving the sealed inner line.

The first live check also exposed Snow's default happy mood reopening a manual closed-mouth pose. Smile/frown targets now move each paired inner edge together; jaw motion owns the aperture. This permits an emotional lip line and closure simultaneously. No mood is disabled in the final live checks. Neutral positions, topology, texture/source identity, eyes, independent lids and the 38 supported morph channels remain preserved.

## Evidence

- Full `npm test`, exact contact/press/emotion unit checks, packaging and whitespace checks pass. Both character meshes have paired X/Y/Z contact at full closure; smiles/frowns preserve the paired aperture and press targets leave the sealed edges alone. Existing normals, eyelids, accessories, batching and bounds tests pass.
- [Previous live build](LIP-CONTACT-BEFORE-2026-10-09.json) versus [final live build](LIP-CONTACT-AFTER-2026-10-09.json): actual packaged NVIDIA rig, default persona moods, two characters × front/left/right turn cues. Old maximum lip gaps are about 0.00968 (Queen) and 0.00443 (Snow); final maxima are below 0.0000003 **model units**, not physical measurements. Separate teeth geometry stays hidden under full closure.
- Reviewed turn captures: Queen [before](media/lip-contact-velora-before.jpg)/[after](media/lip-contact-velora-after.jpg), Snow [before](media/lip-contact-solenne-before.jpg)/[after](media/lip-contact-solenne-after.jpg). Frontal appearance changes are subtle; renderings and numerical contact do not establish overall realism.
- [Actual stream/fallback playback regression](LIP-CONTACT-PLAYBACK-2026-10-09.json) passes audible onset/tail, queued silence, quiet tracked-mouth ownership, independent upper face, completion recovery, Stop silencing and local detector failure fallback.
- [Final camera/AR/speech lifecycle regression](LIP-CONTACT-LIFECYCLE-2026-10-09.json): 65 seconds, 18 samples, zero recorded errors. Actual recorded transport/local workers, native photo ingestion, optional NVIDIA rig and synthetic PCM/model; camera-off, owned accelerated sleep and wake cleanup pass.
- [Final archive/source/tool hashes](LIP-CONTACT-BUILD-2026-10-09.json). Archive `45d7e6335d0260545f11e34d4c15ca3c6867e48c46ab0fb3ffb0cb5b6efb3ccd`.

The first new live diagnostic had a syntax error and was rejected. After correcting it, Snow's smile/contact failure was an application geometry finding, not a harness error. Neutral-mood comparisons isolated the closure shape, then the paired smile/frown correction was validated in the default moods. Those intermediate runs are excluded from the final before/after claim.

## Limits and next work

These are explicit expression cues plus real synthetic-PCM playback, not natural phoneme labels, physical sensors or TV validation. Baked lip texture, mouth interior/tongue, speech timing and expressive continuous motion still need review. Hair/hairline, crown contact and general anatomy remain visibly unfinished. Portrait remains the default; G2 remains open.

The change adds only bounded initialization work while authoring existing targets, with no additional animation loop, per-frame vertex patch, morph target, triangle or draw call. These checks do not establish power savings or Windows performance. The active 30-minute camera/speech monitor is the older immutable utterance build; preserve its separate scope.
