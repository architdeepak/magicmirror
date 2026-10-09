# YouTube conversation volume — 2026-10-09

The embedded YouTube player now lowers its volume during listening/thinking/assistant speech and restores its owned previous volume after Stop. Direct/cast media retain their existing behavior. Explicit watch volume commands accept integer percentages from 0 to 100; measured watch state exposes `volumePercent` and mute separately.

The frame uses the official [YouTube volume API](https://developers.google.com/youtube/iframe_api_reference#ChangingThePlayerVolume). It waits for readiness, handles cached volume reports and queued quick-Stop restoration, deduplicates commands, and preserves explicit user overrides, including choosing the same value as the ducked volume. It reuses the existing reporting interval. Commands remain authenticated to the current frame/token.

## Verification

Final packaged archive: `ed9f3352ff13db9dd92f5c94e95015f132ae149bbfb07436e1baa05a6fad397a`. [Saved source hashes and results](YOUTUBE-DUCKING-VERIFICATION.json).

- Actual public YouTube playback reported 80 → 20 during local assistant PCM → 80 after Stop, with playback continuing.
- Explicit volume 45 survived Stop. A paused video's quick Stop restored 45 without starting playback. Explicitly choosing the ducked value 11 also survived Stop and remained paused.
- Real decoded local media measured RMS approximately 0.085 → 0.021 → 0.085 during speech and Stop. Hard mute restored media volume; real local SOAP overrides, mute and pause remained preserved.
- Unit cases cover late readiness, stale cached reports, immediate Stop, zero/muted volume, user overrides and invalid values. Full `npm test` passed. The first suite attempt exposed a missing YouTube stub in the existing setState VM harness; that harness was corrected before the final passing run.
- Actual packaged UI audits passed at four viewport sizes, including portrait controls, captions, typing and settings.

## Remaining qualification

YouTube volume/state is API-reported, not a physical speaker measurement. Local PCM and recorded media do not establish acoustic wake/Stop timing, microphone quality, real account behavior, native Spotify ducking, Windows performance or device wattage. Choosing the exact ducked volume in YouTube's own native slider has no observable intent event; the explicit app command is covered. Broader source replacement and real-user integration remain open. All G1–G8 completion gates remain open.
