# Preserve Watch controls after invalid links — 2026-10-09

The real public YouTube baseline reproduced an invalid-link failure: an invalid media load detached the player bridge, leaving a visible video classified as an uncontrolled embedded page. Validation now occurs before changing source ownership. Invalid or blank inputs preserve the current player and pending valid request; only an accepted replacement advances the load generation. Current connection failures remain visible, while stale failures cannot detach a newer source.

## Evidence

[Saved before/after, source hashes, runtime and UI results](WATCH-LOAD-OWNERSHIP-VERIFICATION.json). Final archive `2c7393af27bd769cedc584e6e33f49ebfe14e2b9cb49bbfbfb52d0551959febe`.

- Baseline actual packaged public YouTube test failed: expected `youtube`, observed `embedded-page` after submitting `not a valid media URL`.
- Final package returns the invalid-link error while keeping the actual ready YouTube player and volume 11. The installed Codex subsequently sets volume 37 and pauses it; independent reported state confirms both.
- Production-function tests cover malformed URL, forbidden protocol, malformed YouTube ID, blank input, invalid input during a pending valid load, valid replacement, stale failure and current failure.
- Public YouTube ducking/Stop/override checks, decoded local-media waveform and real local SOAP regression pass. Full tests and packaged four-viewport UI audit pass without recorded renderer errors.

The camera/AR monitor remains live on the older frozen `f9a1291` archive; it does not verify this change. Physical acoustics/Windows/accounts, broader source transitions, realistic cloth/face and all G1–G8 gates remain open.
