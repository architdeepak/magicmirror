# Full-resolution wardrobe originals and safe re-editing

October 9, 2026. Full suite remains incomplete: [master goal](MASTER-GOAL.md). [Verification](FULL-PHOTO-ORIGINALS-VERIFICATION.json).

## Defect found

The editor previously reduced every upload/capture to 1024 pixels per side, then labeled that PNG “original.” Native storage imposed the same PNG/1024 limit on cutouts and originals. The phone page also discarded full source detail before sending. Existing files cannot recover discarded detail.

## New flow

- Upload or send a PNG, JPG or still WebP; the encoded source is retained byte-for-byte. Front required, back optional. Originals have recorded format, encoded dimensions, byte size and SHA-256.
- Camera capture freezes the full negotiated frame once. It stores a JPEG at quality .95 at that resolution and builds the preview from the same frozen frame. It does not create missing camera detail or promise lossless camera pixels.
- Editing/extraction still uses a bounded 1024-side preview. Clarity, cropping and masks affect the derivative; full originals are separate. This change does not make the live AR texture 4K or improve cloth drape by itself.
- Select a personal garment and choose **Edit garment photo**, or say **“edit garment photo.”** Front/back originals reopen for review and fresh cutout adjustment. Save updates the same item/creation date, so favorites and fit settings retain their IDs. Cancel keeps the saved version. Reopening begins from source photos; worn clothing may need extraction again and prior crop/clarity settings are not restored automatically.
- Earlier PNG originals remain readable, with a notice that they are smaller. Missing originals produce an error rather than inventing higher resolution. Updates must include originals for every retained photo side.

## Bounds, cancellation and publication

Originals accept at most 20 MB, 24 megapixels and 8192 pixels per side. Shared preflight checks PNG/JPEG/WebP declared dimensions before decoder allocation. Animated PNG/WebP and malformed/truncated headers are rejected. The reviewed cutout retains its stricter PNG/1024 native contract. Saved original access accepts only a known garment ID and front/back, checks real paths inside the closet, bounds file reads and verifies stored hashes.

Browser FileReader and image-load scopes abort when replaced, restored, switched or stopped. Closed/reopened editors reject old completions. Stop/hard mute cancel pending photo work while keeping the current draft; Close/Escape can cancel an in-flight save. Native photo saves have at most two active/queued jobs, serialized storage and owned abort signals. Cancellation is checked before atomic closet-index publication. Cancellation after publication cannot undo an already committed save; stale UI completions do not close a new editor, select a garment or announce success. Old revisions are cleaned after successful publication; failures/cancellation remove the unpublished directory.

Phone upload keeps the original file rather than generating a resized phone canvas. The authenticated LAN endpoint permits one incoming upload, caps the body at 27 MB, bounds inactivity to 15 seconds and checks editor generation while receiving and before delivery. An upload from a closed editor cannot arrive in its replacement.

## Packaged evidence and observed failure

Final archive: `deffa8018d10f8b3fbd6485be82335d50e6581dd535f3a20de8847a0077adddf`.

The source journey uses genuine DOM file changes, actual Chromium JPEG/WebP encoders, real native IPC/files and an authenticated HTTP endpoint:

- 3840×2160 JPG front/WebP back retained byte-for-byte, with dimensions and hashes.
- Reload, reopen, recrop and update preserve originals and item ID; canceled editing leaves the saved raster intact; obsolete asset revision removed.
- Bad originals, oversized declared dimensions, unknown garment IDs and edits omitting originals reject without publication.
- Canceled native save publishes no item; delayed partial HTTP upload rejects after editor close/reopen without touching the fresh draft.
- LAN photo upload retains full source bytes.
- Actual browser MediaStream fixture preserves a 1920×1080 full camera frame separately from the preview.
- EXIF-rotated JPG retains its encoded file and reopens with the same upright Chromium preview. Stored dimensions describe the encoded grid, not an invented camera/display capability.

The first implementation tried to validate every original using nativeImage and failed the packaged WebP save. [Electron documents PNG/JPEG support and no EXIF interpretation](https://www.electronjs.org/docs/latest/api/native-image). Chromium handles WebP decoding/orientation in the reviewed editor; native storage retains bounded, header-checked WebP bytes. Native WebP preflight is container/dimension validation, not full pixel-bitstream validation. A malformed encoded source still has to decode successfully for an editor preview. Direct IPC can archive header-valid WebP with a separate valid PNG derivative; reopening rejects invalid WebP pixels. Do not claim a native WebP decoder.

Header implementation references: [PNG specification](https://www.w3.org/TR/png-3/) and [WebP container specification](https://developers.google.com/speed/webp/docs/riff_container).

Focused tests cover format/size bounds, abortable reads/decode, stale capture/view/save/pairing ownership and late canceled success/failure. Full `npm test` passed. The existing broad packaged wardrobe regression checks real garment upload, local worn extraction, front/back fitting, voice/interpreted gestures, Stop/mute, two captions, parallel saves, persistence/reload and phone rejection cases.

Review images: [original-backed preview](media/wardrobe-original-full-resolution-preview.png), [reopened source](media/wardrobe-original-reopened-original.png). These striped fixtures prove source retention and reversible image handling, not garment realism.

## Remaining gates and next work

No physical camera/phone/gesture recognition, Windows or cloth realism is proven. 48 MP/HEIC input, saved extraction-mask/crop restoration and interactive latency under maximum-size concurrent media/voice workloads remain open. Preserve the clear bounds rather than labeling unsupported input as a successful full scan.

Next: review local garment replay for sleeves, raised/crossed arms, logo orientation, profile/back transitions and occlusion. Improve fit from actual failures while preserving same-frame pose/camera synchronization. Continue integrated voice/agent/media audits and final release qualification; the whole goal stays active.
