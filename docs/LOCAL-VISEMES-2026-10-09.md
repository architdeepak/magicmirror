# Local speech mouth shapes

Status: local output-driven prediction integrated; G2 and the full-suite goal remain open.

## Choice and implementation

[HeadAudio](https://github.com/met4citizen/HeadAudio) provides an MIT-licensed
browser audio-worklet classifier using MFCC features and Gaussian prototypes.
Its authors explicitly describe imperfect prediction/VAD accuracy. The project
is vendored at revision `d3af5f9ff86ab6b2b1913d411a4e1922ec101953`, with its
license and provenance preserved. The mixed English model is 14,352 bytes with
39 prototypes. No runtime model download, paid API, GPU or server is required for
this mouth classifier. Conversation still uses its configured voice provider.

The assistant's actual playback gain bus feeds the detector. It never receives
microphone, Spotify or other desktop audio. Audio starts normally while setup is
pending. Existing RMS/zero-crossing animation covers loading, unsupported worklets
and model/processor errors. No speech-audio delay is inserted.

Predictions map to the seven existing shapes: AA, EE, O, OU, MBP, FV and rest.
Several unsupported detailed consonant classes share an existing narrow/open pose;
this does not add 15 distinct anatomical shapes. Silence always gates the mouth
through the actual output waveform. Predictions expire after 150 ms and cannot
replace silence, suspended output or stopped playback. Raw predicted IDs and
model loading/ready/unavailable/idle status are included in diagnostic state.

The application wrapper handles ID 0 correctly (the upstream UI node's truthiness
check would skip it). The upstream DSP modules/model are unmodified. Stop, natural
completion, bus replacement and shutdown retire the owned node. Generation checks
reject setup/predictions from old utterances. Model/worklet registration is cached;
no separate rendering timer is added. One result is in flight and one latest result
can replace it. Acknowledgements bound message growth; audio-clock timestamps
reject old results when the renderer stalls. Retirement makes the processor return
false rather than leaving an inactive inference node alive.

## Actual tests

- Full `npm test` passed on final production source.
- Detector/worklet units cover AA ID 0, valid/invalid IDs, MBP/FV mapping, shared
  registration, cancelled setup, stale callbacks, processor errors, idempotent
  graph retirement, old clock timestamps, 10,000 coalesced predictions and a
  processor that returns false after retirement.
- Controller units cover duplicate chunks, Stop during setup, immediate restart,
  late prediction/setup rejection, silent output, completion and error fallback.
- Immutable packaged NVIDIA worklet/fallback checks plus three software repeats
  pass eight playback routes. Silent onset/gap stays at zero, queued audible tails
  retain visible mouth shapes, actual Stop reaches silent/parked output and the
  local detector returns to idle. The tail assertion checks visible mouth/jaw
  channels rather than requiring an open jaw through a closing consonant. Mouth motion starts around 464–515 ms for audio
  whose tone begins at 450 ms. This is a sampled synthetic-output check, not a
  physical microphone/speaker latency claim.
- Both packaged backends inject an actual detector constructor failure: waveform
  animation remains active, the model reports unavailable and Stop clears output.
- Existing recorded Gacrux greeting (“Yes, your evil highness”) is replayed locally
  through the real worklet, captured with its PCM and rig canvas. In 189 sampled
  rows, the model is ready for 143; active speech exercises AA/EE/O/OU/FV. MBP is
  not demonstrated by this phrase. Prediction diversity is verified; classification
  accuracy and exact consonant alignment are not qualified by this short clip.

[Queen speech replay](media/local-visemes-queen-speech.webm),
[rendered speech still](media/local-visemes-queen-speech.png).
[NVIDIA verification](LOCAL-VISEMES-GPU-VERIFICATION.json),
[software verification](LOCAL-VISEMES-SOFTWARE-VERIFICATION.json).

Archive: `236891f20f54132429bc9a402ba93578b96f33d675d75612ae012c2ee01fa12b`.
Model SHA-256:
`0358f68989b5861f9b7d18871b010fa6cbf88a53bda4954a954d8c548bbcf251`.

An offline CPU probe processed the 2.30-second recording in 13.84 ms, mean 0.032 ms
per 128-sample block, p99 0.242 ms and max 0.917 ms on this shared DGX Spark.
[Probe and raw predictions](LOCAL-VISEMES-CPU-PROBE.json). It is a Node execution
cost check, not the browser audio-thread deadline, an accuracy score, watts or
Windows-stick performance. Reproduce with
`node tools/check-local-speech-model.mjs path/to/mono-pcm16.wav`.

For runtime replay: `npm test`, `npm run pack`, then
`MIRROR_REQUIRE_VISEMES=true MIRROR_PLAYBACK_GRAPHICS=vulkan MIRROR_CAPTURE_GREETING=true MIRROR_PLAYBACK_LABEL=local-visemes-final-gpu xvfb-run -a node tools/check-playback-sync.cjs`.
The optional recording fixture is the existing `artifacts/gemini-live/greeting.wav`.

## Remaining qualification

The model was trained on a small set of English TTS voices. Broader recorded
consonant sentences, different voices/languages, direct visual/auditory review,
classifier timing, physical audio interruption and PC-stick efficiency remain
open. No transcript receipt-time guessing or offline batch analysis is used in
live playback. Portrait remains default while the entire 3D visual gate is open.
The current monitor owns the preceding `248e023` crown build, camera/cloud/media
off; it does not qualify this active-audio implementation or the combined release.
