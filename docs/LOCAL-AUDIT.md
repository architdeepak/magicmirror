# Local adversarial audit

Windows execution is deferred until the final installation stage, as requested.
This report covers the current Linux ARM64 development machine.

## Rendering and CPU

Actual portrait Electron app, real mouse/keyboard navigation, Chromium renderer
TaskDuration over four-second windows. GPU acceleration was disabled to expose
CPU work. Values are renderer CPU as a fraction of one core, excluding the main,
GPU, audio and worker processes. They are not whole-machine wattage. Short
samples and varying software-renderer load limit exact comparisons.

| Mode | Before CPU | Current CPU | Current scene frames/sec |
| --- | --- | --- | --- |
| ambient | 99.0% | 34.3% | 11.5 |
| queen | 98.7% | 46.4% | 18.4 |
| try-on | 51.6% | 33.9% | 25.7 |
| watch | 59.6% | 26.7% | 11.4 |
| music | 98.2% | 27.9% | 11.7 |
| sleep | 95.8% | 1.7% | 0.0 |
| wake-resume | 98.0% | 48.5% | 17.9 |
| synthetic-hidden | 96.3% | 2.9% | 0.0 |

Sleep uses the production idle handler with an accelerated timer; hidden state
is an explicit test property override. These are not physical-presence or OS
window-minimization tests. Both produced zero scene and face rendering; wake
resumed frames. The tests counted actual renderer frames for the hidden audio
GLB, and staged rig updates: both were zero. The experimental rig no longer
loads in normal startup. TalkingHead's audio/viseme clock remains active.

## Findings addressed

- Sleep ran the complete render loop; hidden pages had no explicit render gate.
- Invisible TalkingHead and experimental rig were drawing extra GLB scenes.
- Adaptive quality treated deliberate low frame rates as overload; thresholds
  now follow the selected frame budget and use actual frame intervals.
- Camera models depended on runtime network downloads. Pose, detailed body
  occlusion, face and hand models now ship locally with sizes/hashes/provenance.
  Actual workers initialized and returned expected results with networking off.
- Captions were small; wake status overlapped the dock. Text/spacing increased.
  Mode labels now remain on one line.
- A saved hard-mute preference still advertised the wake phrase at startup.
  Startup/status callbacks now honor mute and wake-off state.
- Snow speech showed a cheek/nose patch: smaller cached feathered mouth crops
  now preserve the surrounding face. Late asset loads are guarded on host change.
- Advit drew an extra mouth. His fallback now animates the existing painted mouth;
  this remains a simple raster puppet, not a fully articulated 3D lip rig.

## Verification evidence

- `npm test`: offline regression suite including cadence/sleep/resume policy.
- `artifacts/power-ui/`: baseline/current CPU metrics and actual UI screenshots.
- `artifacts/power-ui/personas/`: actual Queen/Snow/Advit rest and AA poses via
  deliberate viseme inputs, not recordings of live speech.
- `artifacts/adversarial-face-offline.log`, `adversarial-hand-offline.log`,
  `adversarial-body-offline.log`: offline worker execution on public test photos.
- `artifacts/adversarial-cast.log`: real local media decoding, Settings, companion
  layout at 540×960, 1080×1920 and 2160×3840. An initial exact-size failure was
  caused by the virtual display constraint; the larger test display passed.
- `artifacts/adversarial-voice.log`: actual packaged app plus real Gemini,
  synthetic microphone; final run passed Stop/re-wake/hard mute/microphone loss, with 2.6 ms recognition-to-stop and about 1.29 seconds phrase-onset-to-stop. No physical speaker, accent/echo or subjective voice
  quality claim follows from waveform and lifecycle checks.
- `artifacts/adversarial-packaged.log`: actual packaged startup, app tooling,
  local Spotify UI fixtures and real tracking workers; generated try-on remains
  a separate experiment.

## API-free generation

FASHN 1.5 generated outfits with offline local inference on this GPU. See
`NEURAL-TRYON.md` and `artifacts/fashn/benchmark.json`: approximately 10 and 17.6
seconds for individual stills, around 3.2 GB peak allocated GPU memory. No paid
try-on API is required for this experiment. It is not yet integrated into the
mirror, and it does not establish smooth realistic moving clothing.

## Remaining work

Broader garment/pose testing, integrating a local generation path, sustained
resource measurement with camera/wake/voice/media active together, longer
conversation and multiple host voices, and additional lifecycle fault injection.
All edge cases cannot be established by the current test set. Physical tracking,
room audio and final Windows installation verification remain later gates.
The last Windows ZIP predates this local audit's changes and must be rebuilt
before delivery; the Linux package contains the current application code.
