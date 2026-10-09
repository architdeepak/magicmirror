# Watch companion transitions

Status: specific placement journeys verified; full-suite goal remains active.

## Defect and change

The former layout reserved space only at the destination while the avatar's global
inset transition moved it through the intervening Watch stage. A new audit samples
actual rendered geometry on every observed RAF: the previous immutable package
failed with 110 overlapping/out-of-bounds visible samples across 12 journeys.

Horizontal movement now slides within its reserved band. Movement between the
upper/lower bands fades out, relocates while invisible, then fades in. Both content
bands remain reserved during fade-out. If the current host is outside newly
available bounds, it hides immediately for relocation. Reduced motion relocates
without the slide/fade-out sequence. Stop, hidden document, sleep, superseding
requests and disposal cancel outstanding timers/frames; callbacks also recheck
current active state before publishing a destination.

## Verification

- Full `npm test` passed, including deterministic pending-timer and post-relocation
  RAF cancellation, superseding position, reduced motion, sleep, hidden document
  and disposal. A mock timer test initially retained a fired timer in its map;
  the fixture now models the real scheduler removing a fired timer.
- Final packaged transition audit: 12 portrait/rig journeys, portrait and wide
  windows, no observed visible overlap with Watch stage, captions or response
  card and no out-of-bounds host. Rapid destinations followed by Stop leave the
  host hidden and release transition state. Actual reduced-motion style checked.
- A first reduced-motion test failed because its explicit test-only visibility
  was overwritten by entering stopped Watch mode. It now enters the mode before
  explicitly showing the fixture host and asserts active layout before checking
  movement. This was a fixture error; the failure was not hidden by relaxing the
  movement assertion.
- Existing packaged audit: all 40 settled placement/viewport/style cases pass,
  portrait/4:3 video framing, native pairing QR, reachable scrolling Stop control,
  compact cast reserve, Stop and Portal restoration pass.
- Archive: `bd28b20644d9fb5c8a8266843ede3ceb16ae8f5aca4173c92dba39875c3d071b`.

Reports: [before](WATCH-TRANSITIONS-BEFORE.json), [after](WATCH-TRANSITIONS-VERIFICATION.json), [settled geometry](WATCH-TRANSITIONS-SETTLED-VERIFICATION.json). The audit reads geometry each observed RAF and can perturb timing.
It uses software rendering, synthetic camera-less media/transcripts and interpreted
placement callbacks. It does not measure accelerated display FPS, acoustic voice,
real phone casting or hardware readability. Rapid-change checks verify final
cancellation state; the 12 normal journeys provide the continuous geometry traces.
Avatar facial realism and the remaining full-suite gates stay open.
