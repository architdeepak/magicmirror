# Wardrobe reply ownership and conversational confirmations

## Reproduced issue

On baseline archive `da69c7d73c427d05debf1538ac561457325c768c4ccf1e0b5fe5294021141291`, submitting `put me in Black t-shirt`, holding its image load, then submitting a direct `wear` selection for another item caused the old reply to speak: “The garment selection changed while loading. Use the current mirror state before continuing.” It also changed the assistant caption and oracle. This direct closet route did not create a newer navigation request or change the manual-control generation, so the existing request guards missed it. [Actual packaged baseline](WARDROBE-SELECTION-REPLY-BEFORE.json).

## Changes

The navigation reply captures `garmentRevision` immediately after its handler makes its synchronous selection. This preserves the request's own reply while discarding late success/error effects after direct wardrobe, color, style or card selection, including reselecting the same item. Existing voice/manual/request guards remain; gesture navigation also retains its user-control handoff.

Try-on results now include a separate `userMessage` for local speech/captions. Structured agent results and live-fit state retain their detailed grounding. For example:

- Camera off: “Black t-shirt is selected. Turn on the camera to see your fit.”
- Visible fit: “Black t-shirt is on the mirror.”
- Tracking initializing: the camera fit is getting ready.
- Body out of view: step back so the body is in view.
- Ambiguous names: ask which named garment; missing names explain how to choose/add a photo.
- Image errors retain the actionable cutout/load message.
- Photo rendering distinguishes unavailable connection, required sharing consent and an absent preview. A connected provider returning no preview is no longer falsely labeled unconfigured in the agent result.

The visible-fit statement requires the current live-fit snapshot to report visible; selection alone does not claim an outfit is displayed. The changes do not qualify fit realism or decoded still-image readiness.

## Validation

- Full `npm test` passed. Twelve production-function delayed success/error cases cover Stop, mute, manual mode, selection revision, newer navigation and current replies. The mock selection increments its revision synchronously, checking that a request does not invalidate itself. User-facing messages take precedence over internal instructions.
- Production handler tests cover camera-off, visible, initializing, body-out-of-view and selected states; ambiguity/missing garment, image failure, active live AI, unconfigured still rendering and sharing consent. Configured/unconfigured no-preview branches are tested separately with explicit provider fixtures; no paid renderer was invoked.
- Twenty actual packaged Linux cases pass: late success/failure after Stop, mute, mode, interpreted `wear`, card, color, style or gesture callback; current success/failure; supersession by a newer navigation request. No recorded renderer exceptions. The retained current camera-off speech request is short and excludes tool instructions. [Packaged report](WARDROBE-CONVERSATION-AFTER.json).
- Archive `9857b9c6167895a9e51330910005a7765025a5489f242c8c6953a03fe8c5c87b`; renderer source equals the packaged source. [Build record](WARDROBE-CONVERSATION-BUILD.json).

The packaged checker uses the real task form, navigation, card/control listeners and Stop/mute/mode paths. It holds garment selection Promises and spies on native speech queue attempts. The gesture callback is injected. This proves these runtime ownership paths, not physical acoustic/gesture recognition, spoken voice quality or Windows behavior. Provider/no-preview tests use fixtures; local AR and image originals are unchanged.

The preceding immutable `692b453` NVIDIA mode/sleep/local-PCM monitor finished with 585 samples and zero recorded errors. Camera/microphone/cloud/Internet media were off. It does not qualify this newer conversation source, garment fitting or combined release performance. [Final record](SHOULDER-GRID-MONITOR-FINAL.json).

All master completion gates remain open. Continue camera/cloth quality, avatar acting/voice, combined active efficiency and final Windows/TV/sensor/account qualification.
