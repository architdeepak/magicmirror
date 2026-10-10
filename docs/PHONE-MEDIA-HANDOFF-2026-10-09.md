# Phone and native casting handoff

Status: current-machine handoff verified; G4, G5 and the full-suite goal remain open.

## Reproduction and change

The actual paired HTTP `/cast` route could start decoded video while a synthetic
Codex task remained active. A delayed local browser request then completed and
covered Watch. The saved prior-build state has video readyState 4 and playing,
agent active, browser active, and a successful old navigation result.
[Before state](PHONE-MEDIA-HANDOFF-BEFORE.json).

Phone media and native AVTransport load/play now cancel pending desktop navigation,
invalidate screen observations and abort old desktop input before presenting Watch.
The renderer retires the agent before accepting the requested source or playback.
It uses the same manual-control generation as mode and launcher choices: a newer
choice wins while cancellation is pending. A superseded native cast receives an
error acknowledgement. Volume, mute, seek and pause retain their existing ownership.
The retained visible browser is hidden; a late pending load cannot reveal it.

## Verification

- Full `npm test` passed, including production callback tests for two phone requests,
  cast load superseded by phone and media volume preserving an active agent.
- Immutable packaged Linux audit uses the actual paired HTTP route and native
  AVTransport SOAP SetAVTransportURI/Play. Both retire the running task and pending
  local browser. Playback is checked through actual VP8 decode/readiness/playing,
  independently of protocol acknowledgements. Phone state shows agent inactive,
  browser inactive and the old navigation rejected as cancelled/superseded.
- The same audit passes existing Stop/hard mute, delayed observation rejection,
  navigation successor, manual mode/gesture/Return and immediate replacement cases.
- Actual decoded VP8/Opus audio passes baseline, speech ducking, Stop/hard-mute
  restoration, native SOAP volume override, media mute and paused-state preservation.
  The optional public YouTube speech/Stop playback regression also passed.

Archive: `581475de3ef4fb9ffee2ccc558ed1b94a4cfb4832c04f8ad003ef24192c76bb4`.
[Handoff verification](PHONE-MEDIA-HANDOFF-VERIFICATION.json).
[Audio and YouTube verification](PHONE-MEDIA-HANDOFF-AUDIO-VERIFICATION.json).

The agent server is synthetic and the video is generated locally. Real HTTP pairing,
SOAP and media decode run inside the packaged app; no physical phone, microphone,
Windows native desktop or signed-in streaming service is qualified. This does not
establish arbitrary native input ownership, Spotify ducking or a complete casting
compatibility matrix. Protocol acceptance is distinct from playback success.

The NVIDIA development monitor still observes the prior immutable `2743f98` build
with camera/cloud/media off. It cannot qualify these changes or the final combined
release. All eight acceptance gates in MASTER-GOAL.md remain open.
