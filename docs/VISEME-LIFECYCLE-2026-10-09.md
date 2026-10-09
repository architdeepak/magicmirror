# Speech classifier lifecycle and combined workload

Status: current-machine lifecycle/combined regressions verified; full-suite goal,
G1, G2, G5 and G7 remain open.

Application implementation: `2a41d00`.
Archive: `236891f20f54132429bc9a402ba93578b96f33d675d75612ae012c2ee01fa12b`.
This checkpoint strengthens audits/monitoring; the packaged application is unchanged.

## Adversarial packaged checks

Both NVIDIA and software runs use copied immutable packages and actual Web Audio:

- A 600 ms deliberate renderer stall expires the old model prediction. Actual
  waveform fallback remains active; a fresh prediction must resume afterward.
  Each run observes a stale audio-clock packet. Message counters record the brief
  delivery window; structural queue bounds also retain their 10,000-message unit
  check. Renderer responsiveness during an imposed synchronous stall is not claimed.
- Six immediate Stop/restart cycles create independent current detectors. Every
  observed detector closes its actual port and disconnects exactly once; Stop
  clears level/model state. Late registration cannot construct a cancelled node.
- A second cancellation holds actual native worklet registration pending in a
  context kept running. Registration is then released and succeeds after the
  controller interrupt. The old owner creates zero detector nodes and stays idle;
  this checks cancellation independently of closing the audio context.
- A separate diagnostic port instruments the production processor class body and
  the actual detector retirement function. With the context still running, the
  final runs process 80 blocks before retirement, return false on block 81, and
  remain at 81 afterward. The retirement message is delivered despite closing the
  primary port. This is audio-thread execution evidence, not a garbage collection
  or physical-platform proof. The diagnostic subclass/port exists only in the audit.
- Existing real stream/fallback silence, audible tail, output Stop and injected
  model-constructor failure checks pass in the same runs.

[NVIDIA lifecycle report](VISEME-STRESS-GPU-VERIFICATION.json),
[software lifecycle report](VISEME-STRESS-SOFTWARE-VERIFICATION.json).

Reproduce with
`MIRROR_REQUIRE_VISEMES=true MIRROR_VISEME_STRESS=true MIRROR_PLAYBACK_GRAPHICS=vulkan MIRROR_PLAYBACK_LABEL=viseme-lifecycle-gpu xvfb-run -a node tools/check-playback-sync.cjs`.
Omit the graphics variable for software rendering.

## Camera, wardrobe and media regression

Eight actual NVIDIA combined phases pass with recorded camera transport, bundled
local face/body workers, AR and real local PCM. Both portrait and rig speech phases
must observe a ready model and a predicted class; stopped/muted phases must show
an idle model, suspended head clock, no worklet connection and no hidden animation.
Camera-off stops pose updates; sleep has zero new rendered frames and a zero draw
budget. Current portrait/rig speech CPU averages are about 142% of one core on
this shared DGX Spark. These short phases are not controlled before/after benchmarks,
physical camera/display FPS, power consumption or Windows performance.
[Combined report](VISEME-COMBINED-VERIFICATION.json).

The same archive passes actual decoded local-media speech ducking, Stop/hard-mute
volume restoration, native SOAP user-volume overrides, media mute and paused-state
preservation. Actual public YouTube speech/Stop playback also passes. These checks
do not qualify native Spotify, a physical phone or streaming accounts/DRM.
[Watch/audio report](VISEME-WATCH-AUDIO-VERIFICATION.json).

The full unit suite passed. All active-source work remains scoped separately from
physical recognition, voice accuracy and installed-system acceptance.

## Monitor changes and records

The older immutable `248e023` crown cohort finished 30 minutes, 590 samples and zero
errors with camera/cloud/media off. [Final record](CROWN-MONITOR-FINAL.json).

`MIRROR_MONITOR_SPEECH=true` now adds a two-second local PCM burst about every
30 seconds while awake. It uses real stream playback/model setup and actual Stop,
keeps microphone/wake/cloud/camera/Internet media off, and records model/playback
state. Idle audio graphs, unavailable models and failure to observe any prediction
are errors. Sleep skips new bursts. No captions or other-app screens are logged.
This developer fixture calls the PCM path directly; it is not a voice-provider,
microphone or acoustic wake test. Speech/idle CPU windows can overlap burst edges.

The 90-second smoke completed 30 samples, three model-ready bursts and zero errors.
Final added model/idle predicates are also checked against those saved samples.
[Smoke record](SPEECH-MONITOR-SMOKE.json). A fresh longer cohort can use the same
flag with `MIRROR_MONITOR_GRAPHICS=vulkan MIRROR_MONITOR_AVATAR=rig`.

Broader phonetic/voice clips, quiet/noisy physical audio, Windows native app/input
journeys and the frozen eight-hour combined release remain open. Continue these
alongside wardrobe/camera realism; no full acceptance gate closes here.
