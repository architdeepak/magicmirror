# Mouth ownership through queued speech

## Reproduction and changes

The expression mixer granted voice ownership only when speech energy exceeded 0.025. A tracked open mouth/smile could therefore reopen the Queen's mouth during silent gaps in an otherwise active utterance. A new unit regression reproduces the failure on the previous source. The controller now passes actual playback ownership to the mixer, which retains voice control through queued silence and releases it when playback finishes or Stop interrupts. Eyes/brows remain independently tracked.

M/B/P's authored `mouthClose` target also used loudness as its strength. Recognized quiet speech now requests the full authored closure target while keeping jaw/vowel amplitude driven by energy. This is expression control; it does not establish physical lip contact or classifier accuracy. Existing smoothing remains unchanged.

## Verification

- Full `npm test`, expression and controller lifecycle tests, packaging, and whitespace checks pass. New tests cover quiet queued speech, upper-face independence, completion/Stop release, and M/B/P at energies 0.04/0.15/0.9.
- [Packaged playback report](UTTERANCE-MOUTH-2026-10-09.json), [exact build/source/tool hashes](UTTERANCE-MOUTH-BUILD-2026-10-09.json): NVIDIA optional rig, real TalkingHead worklet and Web Audio fallback, local mouth classifier and queued synthetic PCM. A stable injected tracking input requests jaw 0.95, smile 0.8, blink 0.2 and brow 0.3; it is not physical camera inference.
- Stream/fallback quiet-gap maximum jaw: **0.00134 / 0.00296**. Blink/brow remain **0.2 / 0.3**. Completed utterances restore the tracked jaw to **0.9499**. Real waveform onset/tail, silence, Stop output silencing, graph/model retirement and detector failure fallback pass.
- Existing recorded Gacrux greeting replays locally through the actual output/model and captured rig: [continuous recording](media/queen-utterance-speech.webm), [still](media/queen-utterance-still.png). Five visible output shapes (AA/EE/FV/O/OU) appear. There is no labeled consonant accuracy or M/B/P natural-audio proof from this greeting.

The first packaged ownership attempt failed because the normal tracker replaced a one-time facial cue with empty camera input. That run did not establish the intended tracking stimulus and is excluded. The corrected harness keeps a stable explicit input at the existing controller boundary, then restores the setter and puppet state before subsequent tests. Audit files are saved before assertions.

## Monitor and remaining scope

The older 30-minute recorded-camera/AR/rig/PCM monitor finished with **579 samples and zero recorded errors**; [final record](CAMERA-SPEECH-MONITOR-FINAL.json). Its immutable archive predates cadence, taper and this expression change. It is lifecycle evidence for that older build, not current-build or final Windows qualification.

No additional timer, render loop, worker or queue is added. Natural consonant timing/accuracy, full lip anatomy, believable hair/crown/skin, continuous visual polish, physical audio and final Windows efficiency remain open. Portrait stays the default; G2 and the full-suite goal remain open.
