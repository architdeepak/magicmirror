# User control handoff

Status: mirror-control journeys verified; full-suite goal and G4 remain open.

## Changes

Mode buttons, launcher choices, Return and recognized navigation/wardrobe/media
gestures now retire a running agent before applying the user's request. The handoff
invalidates old observations and typed-answer callbacks, hides agent progress and
waits for backend cancellation. It does not disconnect an ongoing live conversation.
An open palm stops a running agent even when an experience dialog owns other
gestures. Agent tool callbacks retain their existing direct routes.

Each manual action has a generation token. A second action supersedes a first
waiting for cancellation; the first cannot resume later and overwrite the new
choice. Service/label values are captured at click time. Superseded launcher errors
and notices do not overwrite the current screen. A pending manual launcher request
is retired before a new manual action applies. Normal mode controls remain
synchronous when there is no agent or pending desktop load to retire.

Explicit Return also detaches its closing browser immediately and publishes the
inactive presentation. A following request cannot reuse a still-closing window.
Cancellation notifications now carry the retired run ID. An old notification
cannot clear a replacement run; late tool errors also check ownership before
changing progress or returning a result.

## Evidence

- Full `npm test` passed.
- Production callback unit tests cover cancellation before mode/service/Return,
  generation invalidation, immediate idle controls, latest-choice ownership and
  pending manual desktop retirement. Desktop tests include asynchronous Return
  followed by a new request. Gesture routing checks handoff before native scrolling.
- Immutable packaged IPC/UI audit uses a synthetic Codex stdio server and delayed
  observation, plus real local HTTP browser loads. Mode selection, AR upward swipe,
  Return and unavailable-service selection cancel the old task; delayed observations
  are discarded. Return closes the actual managed browser.
- Rapid Maps-then-Watch clicks retire the agent, create no new browser target and
  preserve the current response text. Two rapid mode clicks retain the newer AR
  choice. A tool-side mode callback leaves the agent active until explicit Stop.
- Existing Stop/mute, slow-load cancellation, successor preservation and visible
  reload preservation journeys pass in the same audit.
- An immediately started replacement task survives the old run's cancellation,
  captures its own observation and remains active until explicit Stop. Unit tests
  also reject stale sign-in errors without changing the replacement's progress.

Final archive: `21372784d348c548499100e374d202707409784ceb432cd9a55e8e703115fec8`.
[Packaged verification](USER-AGENT-HANDOFF-VERIFICATION.json).

The launcher runtime case exercises an unavailable service and a superseded valid
Maps request; it does not complete an external Maps/account workflow. Valid service
callback ordering is covered by the unit fixture. Gestures are interpreted callbacks,
not physical hand recognition. This test does not prove Windows native input origin
handling, acoustic voice, arbitrary account/app workflows or all user/agent races.
The prior actual Codex screen/click/result journey is separate evidence on its own
recorded archive. Physical native-control handoff remains part of final validation.

This preserves the complete scope in MASTER-GOAL.md; none of the full acceptance
gates is marked complete by this checkpoint.
