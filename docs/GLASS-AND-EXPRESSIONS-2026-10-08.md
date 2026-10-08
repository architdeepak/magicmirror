# Dark glass and expressive face

The user rejected the preceding wake as fake/clipart-like and identified a halo that did not follow the face. This pass replaces the reveal and improves the existing performer. [Smooth preview](media/mirror-glass-awakens.mp4) · [smoke still](media/mirror-glass-smoke.jpg) · [closed-eye pose](media/mirror-blink.png) · [brow pose](media/mirror-brow.png).

## Art direction and implementation

The [original mirror sequence production archive](https://snowwhitemuseum.com/images/production-art/sequence-1b-first-queen-and-mirror-sequence/) shows the face appearing amid smoke/flames. That informed the dark glass, layered smoke, restrained light and emerging face here. Reference imagery was not copied into the application.

- The wake uses a local advected density field with coarse/detail/fine noise, domain warping, rising motion, soft transmitted silver light and a faint warm source. It replaces rotating ribbon strokes, outlined circular graphics and star sprites. The field continues across the wake/arrival boundary and disperses around the face.
- Summoning lasts three seconds, followed by a 1.1-second face emergence through the remaining smoke. Reduced motion retains a short clear transition. Stop/mute cancel RAF, the optional chime and pending expression resets. No cloud frames or new provider were added.
- The detached world-space rings are removed. A diffuse glow lives with the avatar and follows its eye/mouth-derived face center, gaze, head pose, responsive layout and all five positions. Position changes use the existing layout transition and agent tool.
- Eye texture compresses during closure; gaze shifts the textured iris region. Existing brow pixels move within feathered crops. The mouth's textured corners lift for smiles, while matched speech patches remain responsible for speaking. Rounded OU and EE inputs now use the existing mouth channels instead of silently staying neutral. These changes avoid drawing duplicate eyebrows and painted ellipse lids.
- The performer has occasional brief autonomous blinks and glances, with settled periods in between. Listening lifts the brows slightly; thinking raises one brow. Tracked eyes retain ownership when camera puppeting is enabled. Resume resets stale acting events; reduced motion disables autonomous glance/head motion.
- Local commands include “blink,” “raise an eyebrow,” “look left,” “look right,” “look surprised,” “look thoughtful,” “look at me,” and “smile.” Existing “move yourself [to] left/right/upper/lower/center” commands and the agent position tool reposition the host. Commands use the shared local dispatcher; the new phrases were tested through that dispatcher, not acoustic recognition of every phrase.
- Requested gaze has a separate temporary owner, so the per-frame tracking update cannot overwrite it. The audit waits through painted frames before checking direction.
- Stop/mute clear an explicitly requested gaze and expression, so a canceled reset timer cannot strand the face looking sideways or with closed eyes.

## Evidence

Results are saved in [GLASS-AND-EXPRESSIONS-VERIFICATION.json](GLASS-AND-EXPRESSIONS-VERIFICATION.json). Tests run on the current Linux arm64 DGX Spark, with software graphics and isolated profiles.

- Full `npm test` regression, including new autonomous-presence checks for brief full blinks/glances, tracked-eye ownership, reduced motion and resume reset.
- Packaged acting audit poses neutral/blink/brow/surprise/smile/gaze, checks actual glow geometry at five positions, verifies local expression dispatch and Stop/mute clearing, and samples animation cadence without screenshot readback.
- In the cadence sample, RAF median was about 33.3 ms, p95 about 50 ms, and the fog painted about 27.2 frames/second under concurrent audit load. These are actual software-runtime measurements, not a physical TV or PC stick result. Fog calculation alone measured approximately 1.9 ms median and 3.9 ms p95 in a local Node benchmark; this excludes browser composition.
- The real packaged Gemini Live Gacrux journey passed again with recorded WAV through a MediaStream: reveal, conversation, two colored caption rows, timer tool, Stop, standby wake, hard mute and synthetic microphone loss. Output RMS reached zero after Stop; handler response was 5 ms after recognition, about 1.15 seconds from phrase onset. Physical microphone/speaker echo remains untested.
- Four viewport UI audit passed with no renderer exceptions. The native lookbook/wardrobe journey also passed with synthetic camera/pose state.
- Runtime power audit separates natural acting from a genuinely settled pose. One earlier run failed an overly narrow short-window repaint limit because a glance occupied the sample; another failed a strict zero-room-frame assertion on a single invalidation. The test now checks substantial reuse during natural acting, explicit zero repaint in a settled-pose fixture, and sparse rather than continuous flat-room drawing. Sleep/hidden rendering must still be zero. This records the changed acting requirement; it does not establish full-device efficiency.

## Preview scope

The smooth preview advances the production fog at explicit 30 Hz steps and poses the host with an equivalent emergence fade. It is an offline visual export, not proof of live 30 fps. The original actual-timing screen capture is retained as `artifacts/magic-animation/mirror-awakens-live.mp4`; its capture intervals are recorded. Reading screenshots itself substantially slows capture on software graphics, so separate runtime cadence measurements are used above.

## Remaining limits

The performer remains front-facing textured artwork with localized deformation, not a full 3D facial rig. Side turns, physically simulated skin/cloth, perfectly phoneme-specific lip shapes, convincing extreme expressions and cinematic fluid simulation remain separate work. User aesthetic approval is not inferred from passing tests. Windows installation, actual microphone/camera/gesture inputs and TV-distance viewing remain unverified. The older monitor tests its own frozen build; a new isolated monitor is started for this revision after saving it.
