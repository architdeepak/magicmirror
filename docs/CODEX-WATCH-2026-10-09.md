# Codex Watch controls — 2026-10-09

The subscription agent now has `control_watch` using the same application callback as live voice: status, user-supplied URL load, play, pause, relative seek and integer 0–100 volume. The tool describes acknowledgements separately from verified playback and limits volume to Watch. Returned results include current mirror state. It invalidates old computer observations and retains cancellation ownership.

## Actual verification

Packaged archive `9823726363c8fd30ee433f93b07565fee1540d02b6c2bb75a0c6ab8f550b0374`; [saved results and source hashes](CODEX-WATCH-VERIFICATION.json).

- Actual installed Codex subscription task called volume 37 and pause against public YouTube. It completed with “Verified: the Watch player volume is 37%, and it is paused (playing: false, state: 2).” The independent player report confirmed volume 37 and paused state 2.
- Packaged load/play/volume/pause checks through `MirrorAgentTools` passed for public YouTube; 80→20→80 ducking, explicit 45, quick Stop and explicit same-valued 11 stayed correct. Local decoded media waveform and real local SOAP regressions also passed.
- Tool schema/callback forwarding, observation invalidation and cancelled late watch results pass in unit tests. Full `npm test` passed.

Reproduce after packing with `MIRROR_WATCH_AGENT=true MIRROR_WATCH_AUDIO_YOUTUBE=true MIRROR_WATCH_CODEX=true xvfb-run -a node tools/check-watch-audio.cjs`. This requires the installed authenticated Codex subscription and public YouTube availability. The synthetic media/PCM tests require neither a paid generative provider nor physical inputs.

## Scope

This is one real agent/player task, not evidence for broad autonomous task reliability, physical microphone/speakers, accounts, native Spotify, Windows or power. The separately running camera/AR/rig/PCM monitor freezes the prior `f9a1291` archive and does not exercise this new bridge or Internet media. All G1–G8 gates remain open.
