# Streamed captions preserve fragments and split Stop

Full suite remains incomplete; G1 and the other master gates remain open.

## Reproduced failures

Actual packaged baseline packet replay produced:

| Packet fragments | Previous caption | Intended caption |
| --- | --- | --- |
| `Hel`, `lo`, `,`, space, `world`, `.` | `Hel lo , world .` | `Hello, world.` |
| `no`, ` no`, ` no`, `.` | `no .` | `no no no.` |
| Chinese characters and punctuation | Extra inserted spaces | Preserve the received string |

Interleaved input/output transcription erased the assistant row and lost earlier user text. The answer card accumulated old replies and exceeded the caption bound. Input packets `mirror` then ` stop` displayed “mirror stop” but did not call Stop, because recognition checked only the last fragment. [Baseline result](STREAMING-CAPTIONS-BEFORE.json).

## Change

The live adapter marks audio transcription callbacks as deltas using internal app metadata. The renderer concatenates those raw fragments, including internal spaces and actual repetitions. Local interim text and non-delta cumulative snapshots retain their existing replacement/deduplication behavior.

Both speaker rows retain ownership while deltas interleave during the current turn. A new heard turn resets their ownership. The answer card uses the same bounded assistant text rather than a separate unbounded accumulator. The assembled current user caption is checked for Stop, including phrases split across packets; existing socket-generation cancellation rejects remaining output in the canceled packet/session.

Provider background: the [official Live API reference](https://ai.google.dev/api/live#BidiGenerateContentServerContent) describes incremental server updates and independently delivered input transcription without guaranteed ordering. The delta tag is local application metadata, not a new provider field or configuration. No model/provider migration is included.

## Evidence

- Full `npm test` passes, now including focused caption-stream tests: word/punctuation/whitespace boundaries, repetition, Chinese, interleaved roles, local interim correction, cumulative compatibility, split Stop and bounded Unicode. Transport units require raw text and delta metadata, with stale/mixed-packet cancellation retained.
- [Actual final packet path](STREAMING-CAPTIONS-AFTER.json): parser → renderer → DOM passes all three text cases, both interleaved rows, 2,000-codepoint caption/card bounds, and split Stop. Final archive `f21b2896a40b2a9e4d6150435b51c80545b65c25a79b22f85c3a92dd845c186e`; runtime renderer/adapter source matches extracted archive files exactly.
- [Portrait UI regression](STREAMING-CAPTIONS-UI.json) passes four viewport sizes, mode/control bounds, editor captions/Stop, typed input isolation and camera clarity controls. Real Chromium input with denied sensors.
- [Actual playback regression](STREAMING-CAPTIONS-PLAYBACK.json) passes real TalkingHead worklet and Web Audio fallback silence/gap/tail/Stop routes on NVIDIA. Synthetic PCM regression, not natural speech accuracy or physical latency proof.
- [Source/tool/test hashes](STREAMING-CAPTIONS-BUILD.json). [Caption DOM screenshot](media/streaming-captions.png) is a deterministic packet fixture in Ambient, not an active provider conversation.

Reproduce: `npm test`, `npm run pack`, `MIRROR_CAPTION_LABEL=caption-after xvfb-run -a node tools/check-caption-stream.cjs`. For an earlier frozen build, set `MIRROR_CAPTION_BUILD`, `MIRROR_CAPTION_BASELINE=true` and a separate label.

The first archive comparison also compared the builder-rewritten package manifest with the source manifest; that comparison was inappropriate. The two runtime files match exactly and the tested archive hash is saved. No runtime source mismatch was found.

## Remaining qualification

This uses crafted packets through production code, without a paid API call. It does not establish actual provider language recognition, caption/audio synchronization, physical acoustic Stop timing or TV-distance readability. Transcription packets have no reliable application turn identifier here: input delayed across a later turn remains a broader ordering qualification concern. The running monitor owns the prior `5fc96b7` archive and excludes this caption change. All full-suite acceptance gates stay open.
