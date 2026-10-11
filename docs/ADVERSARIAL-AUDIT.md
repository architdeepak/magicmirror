# Adversarial audit — October 10, 2026

The ongoing goal covers performance, visual quality, interaction reliability,
animation and the strength of the software checks. This pass does not establish
PC stick performance or physical mirror-glass readability.

## Fixed and verified

- Portrait idle invalidation included tracker channels that do not paint any
  pixels. The signature now includes the channels used by the portrait renderer.
  Changing nose/tongue channels no longer repaints; blinks and brows still do.
- Speaking frames repeatedly updated three glow layout properties. Glow geometry
  now updates only when its quarter-pixel values change. In a real Chromium canvas
  fixture, 60 speaking frames produce three style writes while all 60 face frames
  continue painting. This is an operation-count result, not a whole-app CPU claim.
- Caption pacing assumed whitespace word boundaries. Chinese, Japanese and Thai
  captions now reveal during speech using Unicode word segmentation, preserving
  whole words and symbols. English partial-word behavior remains checked.
- The voice lifecycle fixture omitted the imported voice gate. Its asynchronous
  test could terminate before the final assertions with exit code zero. The
  fixture now loads the gate, checks silence suppression and speech preroll,
  and fails if it exits before completion. Injecting an unresolved promise was
  verified to exit with failure.

## Validation

- `npm run test:avatar`
- `npm run test:power`
- `npm run test:experience`
- `npm run test:voice`
- `npm run test:health`
- Chromium `tools/test-face-caption-render.cjs`: production CSS at portrait
  widths 320, 540, 1080 and 2160; streaming and new-turn word identity; long
  tokens and Chinese text; Efficient and reduced motion; face warp cache and
  full-blink ownership; real canvas repaint and glow-write checks.
- `git diff --check`

The Chromium result is saved to `artifacts/face-caption-render/result.json`.
These checks use synthetic state and no physical sensors or external accounts.

## Next investigations

1. Profile the remaining renderer/style cost under severe CPU stress. Camera
   and PC stick GPU workloads remain unmeasured. The portrait now adapts, but
   12× CPU stress still cannot sustain the requested cadence.
2. Extend interaction coverage to dialog focus, managed apps, simultaneous voice
   requests, and pending search/pop-up responses after Stop. Physically validate display transitions
   and the 30 Hz TV cap when hardware testing resumes.
3. Continue visual inspection of transitions, including independent asymmetric
   expressions and mouth-patch edges.
4. Physical mirror glass and the Access3 stick remain deferred to user feedback
   and hardware validation.

## Benchmark and interaction pass

- Replaced RAF callback counting with actual app/face/scene/effect paint counts
  and Chromium task/layout/style metrics. No extra RAF loop is introduced by
  measurement. Each run uses a unique debug endpoint and temporary profile;
  CPU throttling is labelled as stress, rather than a hardware simulation.
- Fixed explicit development profiles sharing checkout memory, closet and
  lookbook data. Packaged, ordinary development and explicit-profile paths are
  checked. A native IPC write is verified inside the benchmark profile.
- Keyboard shortcuts now ignore OS modifiers, repeated keys and consumed
  events. Tests cover normal shortcuts and text/editable focus. The real app
  audit covers 16 rapid mode switches, typing, held keys, modifiers, consumed
  keys, and search popup dismissal with Escape.
- Read viewport dimensions once before frame writes and reuse them for follow,
  camera projection and adaptive canvas sizing. In comparable 540×960 Efficient
  fixtures, dimension reads per speaking frame fell from about four to two;
  face paints stayed near the 30 Hz target. Short CPU timings vary and are not
  sufficient to claim a whole-app CPU reduction.
- Saved actual avatar screenshots at 540×960 and 1080×1920 for inspection. The
  benchmark now checks that the mode stays correct throughout each phase;
  a delayed return to Ambient had invalidated an early speaking fixture.

Repeatable commands and configuration are documented in the README. Results
and screenshots are retained per run under `artifacts/bench-perf/`.
The final Efficient-tier run, `1791687855280`, verified the complete speaking
activity: 29.3 face paints/s at 1× and 25.6 at 6× CPU stress, with no renderer
exceptions. Its native profile isolation and real-app interaction checks passed.
The complete `npm test` suite and health check passed after the product changes.

## Adaptive quality pass

- The background governor was resizing a cached scene in response to missed
  avatar frames or an intentional standby heartbeat. Flat conversation and
  standby now preserve that scene; active depth still adapts.
- Added measured motion adaptation: overloaded 60 Hz motion goes to 30 Hz
  before portrait detail drops. Further overload scales actual canvas dimensions
  down to a bounded 60% floor and lowers feature-warp work. This also works at
  DPR 1, where merely lowering a pixel budget did not shrink the canvas.
- Recovery requires six healthy two-second windows with spare frame-work time.
  It restores portrait detail before probing higher motion cadence. Long resume
  pauses are excluded, while genuinely slow rendering remains measurable.
- Under load, caption/status decoration quiets and later reveal effects respect
  the motion cap. Efficient CPU fog now honors its 20 Hz profile limit.
- Chromium checks cover actual canvas scaling, repaint after resizing, restoring
  full detail, and static captions under load. Policy checks cover mixed targets,
  idle/pause isolation, severe overload, scale floors and sustained recovery.
- Run `1791688402803` retained full portrait resolution under 6× stress and
  switched to the 30 Hz motion cap; its subsequent reveal painted at about 30 Hz.
- Run `1791688535451` forced 12× stress: the speaking canvas shrank from 562×922
  to 393×645. After removing throttling without resetting the tier, the 65-second
  recovery restored 562×922, feature detail 1.8 and the 60 Hz cap; the final
  measured window was about 58.4 face frames/s. No renderer exceptions occurred.
  This does not establish PC stick performance; the extreme stressed phase still
  painted only about six face frames/s.
The complete regression suite (260 syntax checks), health check and Chromium
render checks passed for this pass. Visual inspection of the stressed and
recovered screenshots confirms readable captions. Mouth-patch blend arithmetic
was addressed in the following pass; art alignment still merits inspection.

## Mouth blending and rendering-check pass

- Sequential source-over blending weakened the AA pose and retained extra
  neutral lips. At weights AA 0.4 and O 0.6, the old composition retained 0.24
  neutral weight instead of zero in the opaque lip region.
- Mix the two poses with additive premultiplied weights in a native-size mouth
  crop, then composite that crop once over the head. This also preserves correct
  feathered-edge weights; a simple global-alpha correction only fixed the
  opaque center. Single-pose and missing-asset paths remain direct blits.
- The small crop is reused for unchanged weights and released on persona
  changes. There is no full-head intermediate surface or extra animation loop.
- Chromium pixel checks verify opaque and 50%-alpha mouth weights, missing
  assets, cache reuse and resource retirement. The fixture now explicitly uses
  DPR 1 for its scaling check rather than assuming the Windows display density.
- Fixed the Chromium check's shutdown ordering so a failed assertion cannot
  be followed by a successful app quit. A deliberately injected assertion was
  verified to return exit code 1 via a Node child-process launcher.
- Avatar, face-cache, HD and Chromium checks passed. Benchmark run
  `1791689120587` recorded about 57.3 face paints/s normally and 26.9 under
  6× stress, with no renderer exceptions. Short-run timing differences do not
  establish a speed improvement; this change corrects visual composition.

## Display cadence pass

- The requested cadence now includes Electron's refresh-rate metadata for the
  display containing the mirror window. Fractional 29.97/59.94 Hz rates normalize
  to 30/60; 24 Hz is supported, high-refresh displays retain the 60 Hz product
  ceiling, and invalid metadata falls back safely.
- Moves, resizes and display changes publish timing updates. Repeated values are
  deduplicated; reloads republish timing; closed windows remove screen listeners;
  destroyed web contents receive no messages.
- Avatar motion, quality recovery and reveal cadence use the same display cap.
  Thus normal 30 Hz output is not classified against a 60 Hz target. Metadata
  limits do not lower portrait resolution or mark a healthy display overloaded.
- A fresh read after renderer initialization covers missed startup events.
  Versioning prevents a stale read from overwriting a newer event. Browser
  previews and unavailable timing APIs preserve their normal fallback.
- Policy and lifecycle tests passed, including fractional/24/30/60/high refresh,
  invalid metadata, publisher dedupe/reload/disposal and stale startup replies.
  Real-app benchmark `1791689384691` passed rapid interaction checks without
  renderer exceptions. Physical monitor transitions and the TV remain deferred.
The full regression suite (262 syntax checks), focused cadence tests, browser
preview fallback checks and health check passed after this change.

## Mode restoration and user-control pass

- Old delayed returns could hide a newer assistant view, or run during voice
  connection, an active agent, desktop use or sleep. Restoration now owns one
  timer, invalidates stale callbacks when mode changes, and requires an inactive
  ready/offline state before restoring. Unload retires the timer.
- Number-key mode shortcuts previously changed only the visible mode, leaving
  the requested mode unchanged. Voice completion could then restore the wrong
  mode. Keyboard and mode buttons now share a user-control request: cancel old
  restoration immediately, await agent/desktop handoff if needed, and preserve
  the newest requested mode.
- Focused tests cover duplicate timers, forced stale callback delivery, active
  voice/agent/desktop/sleep guards, queued user intent and subsequent restoration.
  Settings, Codex handoff, voice, syntax and health checks passed.
- Real-app run `1791689881964` verified 16 rapid keyboard changes with requested
  mode retention, then waited beyond the 850 ms restore delay to verify a newer
  assistant stays visible and keyboard-selected Watch survives voice completion.
  The run reported no renderer exceptions.

### Pending search ownership

- Search results and errors now belong to the request, voice session and manual
  interaction that started them. Stop, mute, dismiss, newer searches and direct
  answer cards retire pending searches before they can reopen a card or frame.
- Native search requests abort superseded network work. Cancellation also blocks
  grounded-search retries and memory fallback; renderer reload, window close and
  application shutdown retire requests. Search IPC requires the trusted frame.
- Synthetic delayed-response tests cover stale successes/errors, newer request
  preservation, direct cards, voice/manual epochs and URL fallback. Transport
  tests cover pre-aborted requests and cancellation while parsing a response.
  These tests use fixtures and do not make paid API calls.
- Full `npm test` passed, including 265 syntax checks, plus health and whitespace
  checks. Laptop smoke report `1791690441225` passed seven native interaction
  checks with no renderer exceptions; this smoke run did not use live searches.

### Shell geometry outside the render loop

- The main render loop previously read shell width and height on every painted
  frame, including frames after portrait writes. Dimensions are now cached and
  refreshed by native resize events and a shell ResizeObserver. Shell-only
  changes update the camera and overlays; unchanged notifications do not loop.
- Fixture tests exercise 10,000 geometry requests without additional DOM reads,
  native/shell-only resize, zero-size fallback and observer teardown. Power,
  depth, Watch, settings, health and focused syntax checks passed.
- Real-app report `1791690584166` passed eight interaction checks, including
  native and shell-only resize with correct camera aspect, and no renderer
  exceptions. All measured phases recorded zero shell-dimension reads per
  second, compared with about 57 while speaking in `1791690441225`.
  Short-run FPS/task-time variability does not establish an overall speed gain.

### Repeated transcript work

- Repeated cumulative captions now preserve existing DOM and skip scroll-width
  and scroll-height reads. A cleared caption is repaired even if the transcript
  itself did not change; voice activity still updates before the early return.
- Caption decoration keeps a reference to the newest word instead of querying
  all highlighted words and removing/readding the same class on every partial
  word update. Corrections and new turns retire the old highlight.
- Tests verify 100 duplicate messages cause zero scroll-geometry reads and that
  external clearing still repairs the caption. Real Chromium tests verify one
  latest highlight after corrections, stable streaming nodes, wrapped text at
  320/540/1080/2160 pixels and reduced/efficient motion.
- The prior resize change exposed ambiguous source-extraction boundaries in
  two caption fixtures; both now search for their end marker after their start.
- Full `npm test`, the real Chromium face/caption fixture, health and whitespace
  checks passed after these changes.

### Dock popup keyboard interaction

- Settings, persona and launcher panels used opacity/pointer rules to hide;
  their controls remained focusable. A shared panel controller now makes closed
  content inert, publishes expanded/controls/hidden metadata, focuses opened
  content and keeps only one dock panel open. Existing CSS reveal motion stays.
- Escape closes panels and restores an opener when focus was inside. Outside
  clicks preserve outside focus; desktop handoff blurs hidden controls without
  bringing the dock back into focus. Camera enumeration only runs on opening.
- Settings, agent handoff, focused syntax, health and whitespace checks passed.
  Real-app report `1791690843088` passed nine interaction checks with no renderer
  exceptions, including input shortcut isolation, Escape focus restoration,
  inert closed-panel focus rejection and exclusive dock panels.

### Sleep atmosphere restoration and bounded timers

- Open dock panels already prevent automatic sleep. The actual sleep defect was
  that sleep muted ambience while wake never restored its context. Wake now
  restores atmosphere according to hard mute, speech, media and desktop state.
- Bell scheduling retained every expired timer ID. Fired handles now retire
  before scheduling the next bell, and epoch checks prevent old callbacks from
  adding a second loop after audio stops and restarts.
- Synthetic lifecycle tests exercised wake context guards, 10,000 bell callbacks
  with one pending handle, Stop and forced old callbacks after restart. Settings,
  voice, health, focused syntax and whitespace checks passed. Audible playback
  through physical speakers was not tested in this pass.

### Atmosphere follows mode transitions

- Mode changes previously left atmosphere volume context unchanged until a
  voice-state event. One synchronization helper now applies the same mute/duck
  policy on mode, state, atmosphere preference, hard mute and sleep/wake changes.
  Connecting is included when enabling atmosphere as well as during voice.
- Enabling atmosphere while muted now preserves the preference without creating
  or resuming an empty AudioContext. Unmute resumes the saved enabled preference.
- Settings, voice, focused syntax, health and whitespace checks passed. Real-app
  report `1791690986736` passed ten interaction checks with no renderer errors,
  including conversation-to-Watch/Music changes and connecting-to-ready context
  recovery. This verifies state transitions; physical speaker output is untested.

### Atmosphere startup ownership

- An old AudioContext resume failure could stop a newer successful atmosphere
  startup. The error handler now checks its startup epoch before retiring audio.
  Current failures still clean up, and stopped pending successes cannot rebuild.
- Bell callbacks now belong to their audio graph instead of the startup epoch.
  This replaces the earlier epoch timer guard: repeated enable requests may
  advance startup epochs while keeping a live graph, and must preserve its bells.
  Callbacks from stopped graphs still cannot reschedule after a replacement starts.
- Deterministic delayed-resume tests cover newer success before older failure,
  Stop before late success and current failure cleanup. The 10,000 timer test
  also advances startup epochs while retaining the live graph. Settings, health,
  focused syntax and whitespace checks passed.

### Spotify refresh attempts

- Automatic playback refresh used the last successful snapshot timestamp. When
  disconnected or offline it stayed unchanged, causing a refresh every second.
  Polling now uses a separate attempt timestamp and keeps the intended eight
  seconds between attempts without altering the playback progress clock.
- Explicit refreshes remain immediate; hidden, sleeping and inactive Music
  states do not poll. The interval now retires on renderer unload.
- Deterministic fixtures verify disconnected/error cadence, successful-fetch
  timestamp preservation, visibility/sleep/mode guards and explicit refresh.
  Spotify, health, focused syntax and whitespace checks passed. No authorized
  Spotify account or live playback was used for this pass.

### Gallery visibility and decode ownership

- Gallery rotation previously decoded photos while hidden/asleep and startup
  decoded even when another background was selected. Decoding now starts only
  for a visible ambient gallery, excluding desktop presentation. Late results
  recheck visibility and ownership before changing the active image.
- Background, mode, sleep and desktop transitions retire pending completions;
  visible gallery selection, wake and foreground return request a fresh image.
  Decode errors retain the current layer.
- Delayed-image fixtures cover inactive/hidden/sleep/desktop guards, latest
  request ownership, retired completion and failure. Settings, voice, health,
  focused syntax and whitespace checks passed. Laptop report `1791691196756`
  passed ten existing interaction checks without renderer exceptions; gallery
  decode ordering was tested with fixtures rather than imported user photos.

### Gallery startup versus import

- A late startup list could replace newly imported images. Gallery list loading
  now retains its revision and ignores completion after an import succeeds or
  the renderer unloads. A cancelled import leaves startup loading valid.
- The import control disables for the complete picker/import operation and
  rejects duplicate requests. Current errors remain visible; retired errors
  remain silent, and the control recovers on success, cancellation or failure.
- Delayed fixtures verify import success before startup completion, cancellation
  before startup completion, duplicate clicks, retired failure and current error.
  Settings, health, focused syntax and whitespace checks passed.
- Full `npm test` passed after integrating the recent popup, atmosphere, Spotify
  polling and gallery changes (`artifacts/gallery-audit-test.log`).

### Fractional spoken timers

- The timer parser consumed pre-unit “and a half” without adding it, so “two and
  a half minutes” became two minutes. It also read “half an hour” as one hour,
  and punctuation normalization changed “2.5 minutes” into five minutes.
- Parsing now retains decimal points between digits, recognizes half a/an unit,
  and adds half units before or after the unit. Existing labels, cancellation
  and the one-second/twelve-hour range remain covered.
- Timer regression tests cover fractional minutes/hours, both spoken placements,
  half a minute, half an hour, sentence punctuation and the upper boundary.
  Timer, health, focused syntax and whitespace checks passed.

### Stable countdown chips

- Countdown rendering rebuilt every chip and recreated the interval each second.
  Chips now retain identity by timer ID, change text only when needed, and update
  structure only on membership/order changes. A single interval runs while any
  timers exist and pauses display work while hidden; foreground refresh is immediate.
- Fixtures verify 100 identical renders create one chip, one text write and one
  interval, plus added/removed timers, handle zero, hidden suppression and empty
  cleanup. Timer, health, focused syntax and whitespace checks passed.
- Real-app report `1791691531687` passed eleven interaction checks with no
  renderer exceptions. The new check observes a changing countdown on the same
  DOM node and verifies cancellation hides the chips.

### Readable gesture feedback

- Gesture/shortcut feedback used fixed 9-pixel text and a 1.4-second timeout even
  for long instructions. Toasts now scale from 12 to 26 pixels with portrait
  container width, wrap long words and remain inside the mirror. Reading time
  scales with Unicode character count, bounded from 1.8 to seven seconds.
- Real Chromium layout checks cover short text, guidance and unbroken tokens at
  widths 320/540/1080/2160. Timing fixtures cover short/long/bounded messages,
  Unicode and replacing the pending dismissal timer. Existing reduced-motion
  rules continue to apply. Chromium, timing, health, focused syntax and whitespace
  checks passed; physical mirror-glass readability remains untested.

### Stationary motion style writes

- Every painted frame rewrote the follow and two viewer-offset CSS properties
  even when stationary or in flat mode. These exclusively owned properties now
  retain their rounded pixel values and write only when the values change.
- A 10,000-frame fixture writes each stationary property once and verifies moved
  offsets, flat reset and changed follow values still write. Power, depth, health,
  focused syntax and whitespace checks passed.
- Baseline `1791691657863` measured about 83 motion-property writes/second during
  speech. Updated `1791691682261` measured zero repeated writes in idle, speech
  and reveal, passed eleven interaction checks and recorded no renderer errors.
  Short-run FPS/task-time variation does not establish an overall speed gain.

### Mixed-unit timer requests

- Requests such as “one hour and thirty minutes” previously discarded the second
  duration. Adjacent duration parts now sum, including comma-separated parts
  and fractional units, before applying the twelve-hour limit. Unrelated later
  instructions do not contribute time.
- The timer manager also validates finite numeric durations and range before
  scheduling, so direct calls cannot create invalid countdowns.
- Regressions cover mixed hours/minutes/seconds, labels, half units, unrelated
  later durations, combined upper limits and invalid direct inputs without any
  scheduled work. Timer/display, health, syntax and whitespace checks passed.

### Timer bell lifecycle

- Timer notes previously left gains connected and ignored rejected AudioContext
  resume promises. Bells now await resume, check request ownership, disconnect
  ended nodes and suspend their idle context. Hard mute retires pending and
  playing notes; renderer unload also closes the context.
- Simultaneous completions replace the prior bell rather than stacking notes.
  A stopped resume re-suspends its context, and stale errors cannot stop a newer
  bell. Current failures clean up without an unhandled rejection.
- Synthetic audio tests cover muted creation, cancellation during resume, stale
  failure, ended-node release, active mute and rejected resume. Voice, timer,
  timer-display, health, syntax and whitespace checks passed. Physical speaker
  output remains untested.

### Gallery import commit

- Native imports overwrote active photo files before saving the manifest. A
  failed write could therefore mix old and new images. Replacement photos now
  use unique filenames and a temporary manifest; rename switches the manifest
  after all photos are written. Failed staging preserves the active gallery.
- Reads and imports share a queue, so cleanup cannot remove a photo mid-read.
  Obsolete photos retire after commit, and cleanup errors do not misreport a
  successful import. Legacy manifests remain readable; missing individual
  photos no longer hide other valid photos.
- Real temporary-filesystem tests inject failed second writes and failed commit,
  verify original bytes and staging cleanup, and block import while queueing a
  read. Duplicate import, empty selection, legacy/path filtering and obsolete
  cleanup also pass. Settings, health, syntax and whitespace checks passed.
  These tests cover write failures, not power-loss durability.

### Composition-safe keyboard input

- Watch URL Enter handling and Escape dismissal did not distinguish IME
  composition from commands. Composition events and legacy key code 229 now
  leave global shortcuts, Watch loading, dock/search dismissal and Settings
  search clearing inactive. Ordinary Enter/Escape retain their behavior; held
  or already-consumed Enter events do not reload media.
- Keyboard fixtures exercise both composition markers, normal keys, held Enter
  and consumed events. Settings-search tests verify composed Escape preserves
  text while ordinary Escape clears it. Settings, Watch, health, focused syntax
  and whitespace checks passed. A native IME session was not tested.

### Bounded timer labels

- A real Chromium regression initially failed at 320 pixels: an unbroken timer
  label escaped the mirror. Timer containers and chips now bound their width,
  allow long-word wrapping and retain padding for multiline text.
- Chromium tests exercise four simultaneous chips with ordinary, long guidance,
  unbroken and Chinese labels at 320/540/1080/2160 pixels. Each chip stays within
  the mirror with no horizontal text overflow. Timer/display, Chromium, health
  and whitespace checks passed. Physical mirror-glass reading is untested.

### Repeated persona selection

- The portrait loader already guarded stale callbacks, but reselecting the same
  persona recreated all image requests and invalidated face/mouth caches.
  Pending and loaded selections now reuse their images. A current neutral-image
  failure permits retry; stale failures cannot invalidate a newer selection.
- Controlled image tests cover pending/ready reuse, preserved feature identity,
  old success/failure delivery and retry after current failure. Face cache,
  Chromium face/caption rendering, health, syntax and whitespace checks passed.

### Camera selector ownership

- Device enumeration previously allowed old lists to overwrite newer responses,
  and active selection matched camera labels. Identical webcams may share a label.
  Tracking now reports the active device ID; enumeration uses that identity and
  accepts only the latest response. Current enumeration failure preserves the
  selector and shows a retry notice; stale failure remains silent.
- Delayed list fixtures cover identical labels, reversed completion order,
  current/stale failures and an active-camera change while awaiting enumeration.
  Tracking lifecycle tests verify the exposed ID belongs to the winning stream.
  Camera, depth, health, syntax and whitespace checks passed. Physical identical
  webcams were not used in this pass.

### Clock work matches displayed precision

- The minute-only clock recreated formatting and rewrote five fields every
  second. It now formats/writes only when the displayed minute changes, skips
  clock and quote display work while hidden, and refreshes both on foreground
  or system-resume notification. Formatting refreshes timezone defaults rather
  than retaining a permanently cached default zone.
- Clock fixtures verify unchanged seconds cause no formatting/writes, minute/noon
  transitions, hidden suppression, foreground refresh and time rollback. Weather,
  clock, health, syntax and whitespace checks passed. Laptop report
  `1791692287958` passed eleven existing interaction checks without renderer errors.

### Weather refresh request ownership

- Duplicate refreshes for the same city/units previously aborted and restarted
  each other. They now share one pending request; changing city/units still
  supersedes the old load. Only the owning completion can retire request state.
- Weather decoding checks cancellation before committing data. Renderer unload
  retires the epoch, aborts transport and prevents new requests or late UI writes.
- Delayed fixtures verify same-request identity, old/new city retirement,
  cancellation during decoding and completion after unload. Existing stale
  forecast/offline behavior remains covered. Weather, clock, health, focused
  syntax and whitespace checks passed without live network access.
- Full `npm test` passed with the recent camera selector, clock, persona, gallery,
  timer, toast and keyboard updates integrated (`artifacts/weather-audit-test.log`).

### Search-answer overflow

- Chromium initially found horizontal answer-card scrolling at 320 pixels.
  Cards and source buttons now wrap unbroken text within their bounded widths.
  The bloom pseudo-element's negative inset also enlarged scrolling overflow;
  it now stays inside the card instead of extending its scrollable geometry.
- Real layout fixtures cover long headings, URL paths and source names at
  320/540/1080/2160 pixels. Cards remain within the mirror, avoid horizontal
  scrolling and retain vertical scrolling for long answers. Chromium, search
  lifecycle, health and whitespace checks passed.

### Settings search includes section context

- Settings search matched only row text, so section-heading searches could hide
  the intended section. Matching now combines each heading and row, supporting
  heading-only searches and queries spanning section and control names.
- Filtering enumerates rows once per update and waits until IME composition ends.
  App-owned hidden states and remembered section expansion remain untouched.
- Pure/DOM fixtures cover headings, mixed heading/row terms, composed input,
  composition completion and existing restoration behavior. Settings-search,
  settings, health, syntax and whitespace checks passed.

### Compound spoken timer numbers

- “Twenty five minutes” matched only its trailing five. Duration matching now
  consumes teens, tens with optional ones, hyphenated compounds and hundreds,
  then converts the complete quantity before combining units and applying limits.
- Unsupported larger-number prefixes and negative durations no longer silently
  fall through to a trailing positive quantity; they request digits instead.
- Regressions cover 25/31/11/90, hyphenation, 105/220, mixed units and rejected
  thousand/negative phrases. Existing fractions, cancellation, labels and limits
  remain covered. Timer/display, health, syntax and whitespace checks passed.

### Portrait resize allocation

- Repeated portrait resize notifications assigned both canvas dimensions even
  when unchanged, resetting canvas pixels/state and invalidating idle caching.
  Resize now returns early for identical logical/pixel geometry and only assigns
  dimensions that changed. Quality/scale changes retain explicit paint invalidation.
- A 10,000-notification fixture preserves the surface and cached signature,
  verifies width-only allocation, DPR/scale changes and quality invalidation when
  dimensions stay constant. Face resize/cache/persona, real Chromium rendering,
  health, syntax and whitespace checks passed.

### Privacy reflects recording state

- Wake preference alone previously advertised an active local microphone even
  when wake startup failed. The chip now requires the enabled processor and
  active stream. Browser recognition is labelled as browser recognition rather
  than Gemini; voice startup has a pending state instead of claiming cloud audio.
- Unchanged labels/levels now avoid repeated DOM writes. Fixtures cover inactive
  and live wake streams, startup, browser/Gemini, hard mute and camera state, plus
  10,000 unchanged updates. Privacy, voice, health, syntax and whitespace checks
  passed with synthetic devices.

### Compact privacy layout

- Chromium found full privacy descriptions extending past a 320-pixel mirror.
  Visible microphone/camera labels are now concise, with complete recording
  descriptions retained on each indicator's accessible label. The bounded,
  wrapping chip fits the central dock space and preserves status dots.
- Layout fixtures cover all microphone states with camera-on text at
  320/540/1080/2160 pixels. Privacy-state tests verify full camera detail remains
  accessible. Laptop report `1791693470777` passed the dock collision check,
  recorded no renderer exceptions and saved a visually inspected layout capture.
  Chromium, privacy, health and whitespace checks passed.

### Event-driven privacy refresh

- Voice and hard-mute transitions now queue privacy refresh in the same event
  turn; camera UI changes refresh directly. Wake callbacks already used queued
  refresh. The two-second polling timer remains a recovery check rather than
  the primary way microphone transitions become visible.
- Voice/camera fixtures verify refresh scheduling without waiting for a poll.
  Privacy, voice, mirror-state, health, syntax and whitespace checks passed.
  Laptop report `1791693581868` passed interaction/startup checks without renderer
  exceptions; real device permission timing remains untested.

### Replacement answers start at the top

- Answer cards reused a scroll container without resetting its position. A new
  long answer could open halfway down after the previous card was scrolled.
  Presenting an answer now resets both scroll axes after making the card visible.
- Search fixtures verify reset, and laptop report `1791693626979` scrolls a real
  overflowing answer before replacing it with another overflowing answer and
  checking scrollTop zero. The run recorded no renderer errors. Search lifecycle,
  health and whitespace checks passed.

### Browser voice failure recovery

- Browser recognition startup exceptions previously escaped with the recognition
  object still active. Runtime errors reset the UI without explaining failure.
  Startup/permission/device/network errors now retire ownership and show retry
  or typed-input guidance. Permission-denied errors do not automatically retry
  through the late end callback; stale callbacks cannot alter a newer attempt.
- Normal completion from Listening clears wake's assistant-active state before
  returning Ready. Recoverable no-speech/network errors may resume the configured
  wake listener; active delegated work retains its normal Stop behavior.
- Synthetic recognition tests cover thrown startup, retry, denied permission,
  stale callbacks, no-speech and normal completion. Browser/live voice, health,
  syntax and whitespace checks passed. Native browser speech service is untested.

### Decimal timer boundaries

- Leading decimal punctuation changed “.5 minutes” into five minutes. Leading
  decimals now normalize to a zero-prefixed number, and spoken decimal digits
  such as “one point five” or “one point two five” parse as complete quantities.
- Duration limits apply before rounding, so half a second cannot round into an
  accepted timer and slightly over twelve hours cannot round back under the cap.
- Regressions cover leading/spoken decimals, sub-second values and a fractional
  upper-limit violation. Existing compound/mixed units remain covered. Timer,
  timer-display, health, syntax and whitespace checks passed.

### One browser voice request per Listen attempt

- A second final browser transcript could submit another task before recognition
  ended. The first final request now marks the attempt submitted and requests
  capture stop; later interim/final callbacks cannot resubmit or alter captions.
- Recognition error/end callbacks after acceptance retire capture without
  interrupting delegated work or showing an irrelevant retry failure.
- Synthetic recognition tests cover interim text, final capture stop, duplicate
  finals, late interims, post-submit abort and end while Thinking. Browser/live
  voice, health, syntax and whitespace checks passed. Native service timing is
  untested.

### Chromium layout is a default regression gate

- `npm test` now includes the real Chromium face/caption/layout fixture that
  caught recent timer, privacy and answer overflow bugs. Its Node launcher
  propagates Electron exit status reliably on Windows and bounds fixture runtime.
- The fixture passed through the launcher. An injected real fixture failure
  returned status 1; source was restored afterward. The current integration suite
  passed (`artifacts/integration-audit-test.log`), and the new Chromium gate also
  passed separately. Health, launcher syntax and whitespace checks passed.

### Answer close control survives scrolling

- The answer close button was absolute within scrolling content and disappeared
  after scrolling a long answer. It now stays sticky inside the card, retains
  its 44-pixel touch target and occupies heading flow rather than covering text
  at the initial position.
- Chromium regression initially failed at 320 pixels, then passed after the fix
  at 320/540/1080/2160. Narrow-width pointer hit tests verify the scrolled close
  control remains clickable. Chromium, search lifecycle, health and whitespace
  checks passed.

### Feedback avoids the clock

- Visual inspection of the laptop speaking capture showed the feedback toast
  over the clock. Feedback now sits below the clock/weather band using a
  responsive vertical position while retaining bounded wrapping and reading time.
- Chromium fixtures verify separation from actual clock/weather CSS at
  320/540/1080/2160 pixels. Real-app report `1791692850757` verified separation,
  recorded no renderer exceptions and saved `feedback-layout.png`; visual
  inspection confirmed the clock and weather remain unobscured. Chromium,
  toast-timing, health and whitespace checks passed.

### Gesture hold display writes

- The hold display queried its element and assigned hidden state each painted
  frame, then rewrote progress and hint text while holding. Element references
  are now cached, and hidden/progress/text values update only when changed.
- Fixtures verify 10,000 disabled frames do not mutate DOM and 10,000 stationary
  hold updates preserve one initial write per value. Progress movement, Watch
  context and latch dismissal still update. Hold/classifier, health, syntax and
  whitespace checks passed; physical hand tracking was not used in this pass.

### Gesture hints match available actions

- Idle Converse advertised a next effect even though pinch only gives guidance
  there. Hints now distinguish Try On effects, Watch/Music playback, photo editor
  capture/save/busy states, native Spotify and other desktop controls.
- Palm hints now include browser recognition, thinking/speaking and awakening,
  matching the Stop branch instead of advertising Converse during active work.
- Context fixtures cover these branches alongside unchanged-write suppression.
  Gesture classifier/hold, desktop gesture routing, health, syntax and whitespace
  checks passed. Physical hand interaction remains untested in this pass.

### Pending Spotify gesture ownership

- Spotify pinch reads playback state before deciding play/pause. That read
  previously lacked ownership checks, so Stop or newer input could be followed
  by a stale command. The gesture now retains manual/voice ownership and checks
  it after reading state, executing the command and refreshing playback.
- Retired read/command failures stay silent, and already-sent commands cannot
  produce stale success feedback. Cancellation cannot undo a command already
  delivered to Spotify.
- Delayed fixtures cover Stop during read, newer request replacement, retired
  read failure and command completion after cancellation. Desktop gestures,
  gesture holds/classifier, health, syntax and whitespace checks passed without
  live Spotify playback.

### Two-role caption line spacing

- The caption cap used assistant line spacing even for the smaller, differently
  spaced user row. Each span now caps itself at two of its actual line heights.
- Chromium fixtures now keep both user and assistant rows visible while testing
  short, unbroken and multilingual text across 320/540/1080/2160 pixels. Both
  caps match their own line spacing and preserve the newest word. Chromium,
  voice/transcript, health and whitespace checks passed.

### Layered Escape dismissal

- Dock Escape marked the event handled, but the later answer-card handler still
  dismissed the answer. The answer handler now respects prevented events, so
  closing Settings preserves the underlying answer until a second Escape.
- Keyboard fixtures verify consumed Escape does not dismiss search. Real-app
  report `1791693150387` tested both presses and focus return with no renderer
  exceptions. Settings, health and whitespace checks passed.

### Current Electron integration evidence

- Isolated real-app report `1791694868722` passed mode, keyboard, popup focus,
  Escape, resize, timer, atmosphere and feedback-layout checks with zero
  renderer errors after the recent changes. Sensors and live services were off.
- The quick speaking sample measured 27.84 app/portrait frames per second,
  with zero shell dimension reads. One-second samples do not establish a
  sustained performance improvement or physical PC-stick performance.

### Weather freshness update budget

- Weather age skips hidden-window and unchanged-label writes, samples time
  once per update and refreshes on resume. Fixtures verify 10,000 stable
  samples, hidden suppression, foreground stale age and mismatched-city state.
  Weather, clock-budget and health checks passed.

### Quick-note persistence and dashboard rendering

- Dashboard note rendering preserves existing DOM when unchanged, compares
  serialized markup to account for entity normalization, repairs externally
  cleared content and retains the displayed note if storage reads fail.
  Fixtures verify 10,000 unchanged reads and escaped text; settings tests pass.

- Form and voice notes share a save helper. Failed storage preserves the prior
  saved note and typed text, shows retry guidance and avoids a false saved
  message. Fixtures verify failure, successful retry and clearing; settings
  and health checks passed.

### Countdown accessibility

- Countdown chips explicitly use `aria-live="off"` with an accessible label.
  The timer remains readable on demand without announcing every second.
  Completion still uses the existing bell and feedback path. Markup and timer
  fixtures verify the policy; screen-reader hardware interaction is untested.

### Spotify artwork retention

- Spotify refresh retains an unchanged artwork source, avoiding repeated image
  source assignment. Fixtures verify replacement artwork, one-time unsafe URL
  removal and allowed native artwork. Spotify and health checks passed without
  authorized live playback; network savings are not measured in this pass.

### Tracking display write budget

- Tracking UI refreshes now skip unchanged text, visibility and pressed-state
  writes while preserving disconnection handling. A 10,000-refresh fixture
  verifies stable updates, face lock, camera loss, error recovery and one-time
  live try-on shutdown. Camera tests passed using synthetic streams.

### Diagnostics display write budget

- Visible diagnostics now write only changed labels instead of replacing five
  text nodes every sample. A 10,000-sample fixture confirms zero extra writes
  while stable and checks individual tracking/video/gaze/channel/FPS updates
  and externally cleared label repair. Diagnostics and health checks passed.

### Dock action focus cleanup

- Host selection and assistant-form submission now close their dock panels
  through `PopupPanels.closePanel`, restoring opener focus and updating inert,
  hidden and expanded metadata together. Production-handler fixtures cover
  both paths; the settings suite and health check passed.

### Toast expiry ownership

- Toast expiry callbacks now check timer ownership before hiding feedback and
  release ownership when done. Forced delivery of a retired callback preserves
  the newer guidance in the toast fixture.

### Answer-card reading time

- Full `npm test` passed after the reading-deadline and source-focus changes,
  including the default Chromium face/caption gate. Complete output is saved
  in `artifacts/current-regression-test.log`. This validates the software
  fixtures, not physical TV, speaker or camera performance.
  Later toast, dock-focus, diagnostics, tracking, artwork and countdown changes
  have their focused checks recorded above; that full-run log predates them.

- Replacing a focused source button now transfers focus to the visible Close
  control with scroll prevention. Answers preserve focus elsewhere, including
  the existing Close control. Source replacement fixtures verify these cases.

- Answer cards formerly closed after 60 seconds even during reading or source
  button focus. Expiry now retains hovered or focused cards. Pointer, scroll
  and focus activity renew the idle deadline; idle cards still dismiss.
- Each card owns one deadline. Retired callbacks cannot dismiss a replacement,
  and hidden cards do not schedule more work.
- Scroll/focus activity advances a monotonic deadline without replacing its
  timer. A 10,000-event fixture allocates no additional timers and verifies
  dismissal exactly 60 seconds after the final interaction.
- Fake-clock fixtures cover focus, hover, renewed deadlines, stale callbacks
  and idle/hidden expiry. Search lifecycle, voice, health, renderer syntax and
  whitespace checks passed. This pass uses synthetic interaction fixtures.

### Retired gesture feedback

- The shared gesture error handler now checks voice/manual ownership captured
  after dispatch's synchronous handoff. Current errors stay visible; stopped or
  replaced work cannot show a stale error toast.
- Desktop scroll/return and Watch command success paths recheck gesture ownership
  before showing feedback. Already-delivered external actions are not undone.
- Delayed fixtures verify stopped/replaced failures, current failure after its
  own handoff, late desktop scroll and return success. Gesture, desktop routing,
  health, syntax and whitespace checks passed without physical desktop input.

### Weather city preference failure

- A failed city-preference write no longer interrupts the selected city's
  forecast. The city works for this session and the selector shows an honest
  persistence notice. A later successful save clears the session-only state.
- Weather fixtures cover failed writes, preserved stored preference, forecast
  updates and retry. Weather, clock-budget, health and renderer syntax pass.

### Failed Spotify artwork

- Missing artwork starts hidden without an empty image source. Failed images
  hide on error and remain hidden across unchanged refreshes. New loading
  artwork becomes visible, and an error cannot hide an incomplete replacement.
- Synthetic image-state fixtures, Spotify playback and health checks passed.
  Live CDN failures and authorized playback remain unverified.

### Spotify artwork hidden-style precedence

- Chromium inspection exposed that `.spotify-cover { display: block }`
  overrides the browser's default hidden styling. An explicit hidden selector
  now ensures unavailable/failed artwork is actually removed from layout.
- The default Chromium gate verifies both hidden and visible computed display
  states. Chromium, Spotify and health checks passed; the earlier state-only
  fixture did not cover CSS precedence.

### Hidden control CSS invariant

- The Spotify current-track link also had display styling overriding hidden.
  The page now explicitly enforces hidden elements' removal from layout even
  when component styles declare flex/block display.
- Chromium checks representative Spotify links, notices, render controls,
  gesture holds and timer badges for no display and no focus while hidden.
  Chromium, settings and health checks passed.

### Spotify unavailable-state cleanup

- Disconnection or unavailable playback clears artwork, track navigation,
  title/artist/album/device and progress alongside disabled playback controls.
  This prevents an old track from appearing current or remaining clickable.
- A connected-to-disconnected fixture verifies artwork removal, hidden and
  cleared track links, fallback title and zero progress. Spotify tests pass;
  live authorized playback remains unverified.

### Spotify cleanup focus return

- Unavailable-state cleanup moves focus from disappearing track links or
  disabled playback actions to Open Spotify app with scroll prevention.
  Focus outside those controls is preserved.
- Fixtures verify link/play focus return and unrelated-focus preservation.
  Spotify, health and renderer syntax checks passed.

### Spotify device refresh recovery

- Failed device refresh retains the previous options and selected target,
  clearly labels the list as previous data and keeps Refresh available.
  Native transfer validation still verifies the requested device before use.
- Fixtures verify retained option identity/selection, visible failure guidance
  and successful retry. Device-picker, playback and health checks passed.

### Spotify device option retention

- Device refresh compares option IDs, displayed names/active labels, order and
  restrictions before replacing the selector contents. Unchanged lists retain
  option identity and the user's selected device.
- Fixtures verify 100 unchanged refreshes retain options, while renamed/active
  changes repaint and preserve selection. Device tests and health checks pass.

### Spotify portrait metadata overflow

- Chromium reproduced horizontal overflow at 320 pixels with long unbroken
  artist/album names and utility buttons. Artist and metadata now wrap within
  the card, and utility controls wrap onto additional rows.
- The previously failing fixture now passes at 320/540/1080/2160 pixels.
  Chromium, Spotify and health checks passed.

### Spotify status overflow

- Long unbroken playback/device error messages reproduced portrait overflow
  despite the metadata fix. Both status regions now wrap within the card.
- The extended Chromium fixture failed before the fix and passes afterward
  at 320/540/1080/2160 pixels. Chromium and health checks passed.

### Monotonic Spotify progress

- Playback extrapolation and refresh-attempt intervals now use performance time
  rather than wall-clock time. Music mode entry preserves the previous playback
  timestamp while refreshing instead of temporarily jumping to track end.
- A simulated wall-clock rollback preserves progress, and monotonic advance
  still advances it. Playback and health checks passed.

### Latest Electron integration pass

- Real-app report `1791695255384` passes the interaction audit with an isolated
  profile and zero renderer errors after hidden-control and Spotify changes.
  Camera, device-picker and diagnostics suites also pass.
- Speaking measured 27.71 FPS in a one-second sample with zero shell dimension
  reads. This is a short laptop/software observation, not evidence of sustained
  improvement or physical camera/TV/Spotify behavior.
