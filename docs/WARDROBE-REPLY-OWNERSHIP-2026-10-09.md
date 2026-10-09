# Delayed wardrobe reply ownership

## Reproduced failure

Baseline application `2a41d00` (current checkpoint `d552484`), packaged archive `236891f20f54132429bc9a402ba93578b96f33d675d75612ae012c2ee01fa12b`: submitting `put me in Black t-shirt` through the actual task form, holding the garment load, pressing Stop and completing the load queued a native speech request and changed both assistant caption and oracle text. See [baseline](WARDROBE-REPLIES-BEFORE.json).

The earlier `try on` fixture reached the closet's direct selection route, which does not publish this reply. It was rejected as evidence for this callback. The final fixture exercises the navigation request that awaits garment loading.

## Change

The navigation callback captures voice and manual-control generations plus its own request sequence. Successful and failed replies can publish only while all three owners remain current and hard mute is off. Stop, mute, a manual mode change or a newer wardrobe request invalidates the reply. Current replies still work. The callback returns its handled Promise for regression checks.

This suppresses obsolete reply effects; it does not roll back an already selected garment or cancel every underlying image load.

## Validation

- `npm test`: full suite passed, including ten production-function success/error ownership cases.
- `xvfb-run -a node tools/check-wardrobe-replies.cjs`: ten actual packaged cases passed: late success/failure after Stop, mute, mode change and newer wardrobe request; current success/failure retained. No recorded renderer exceptions.
- Archive `201c32b89c4fdffea7cb4ac799a049d6691d640099c497c7e51ea9a08e05d763`; [packaged report](WARDROBE-REPLIES-AFTER.json).

The actual Linux form, renderer navigation callback and Stop/mute/mode controls run in the packaged application. A held garment Promise creates the race; a native speech queue spy observes requests. This does not measure actual camera loading latency, spoken voice quality, physical speech recognition or Windows behavior. It covers this navigation callback, not all asynchronous callbacks throughout the suite.

The existing 30-minute local-speech monitor continues on its immutable previous archive `236891…fa12b`; it cannot qualify this fix. All master completion gates remain open.
