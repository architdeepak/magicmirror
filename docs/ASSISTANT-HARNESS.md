# Codex delegation in the mirror

Command Center now has Ask the mirror. Typed requests use connected live voice;
when it is unavailable, they use Codex and report missing sign-in or executable
errors honestly. System speech can read a completed typed answer. Hard mute
rejects a submission while preserving the draft.

The live voice host can call `delegate_agent_task` for a task that needs several
screen, computer, or wardrobe steps. Codex operates through the mirror's existing
application callbacks. The available tools are screen capture, observed computer
input, structural mirror state, website/search opening, display/face placement,
and local wardrobe/try-on commands. This preserves the worker-based local AR
implementation and the existing Windows/managed-browser input validation.

Install Codex on the mirror computer and sign in with `codex login` using ChatGPT.
The bridge rejects an API-key account; it does not silently switch to API billing.
A ChatGPT subscription and its usage limits still apply. `MIRROR_CODEX_PATH` may
point to the installed native executable if it is unavailable on PATH. Windows
executable discovery/runtime remains to be tested at the final Windows stage.
Gemini remains the live audio host; this addition does not make live voice offline.
The local AR wardrobe needs neither a generative service nor a Codex account.

The integration uses the experimental dynamic-tool flow described in
[official OpenAI documentation](https://learn.chatgpt.com/docs/app-server).
The installed Codex 0.161.0 generated schema was also checked for the `inputImage`
result format. Screenshots are sent as image content, with observation metadata
in a separate text item. Websites and screen text remain untrusted observations.

## Lifecycle and input

Each task has a renderer run ID and an independent tool epoch. Stop, hard mute,
renderer navigation, and application exit cancel the child and tool waiters.
Late screenshots are discarded. A running agent shows the existing Stop control;
hard mute rejects new tasks. Codex is started only for a task and killed when it
finishes, with a three-minute timeout and a twenty-call limit. It has no persistent
idle process introduced by this integration.

Tool requests are serialized, and duplicate request IDs reuse their result.
Client and server RPC IDs are tracked separately. Every computer action needs a
fresh one-use screenshot. Coordinates are normalized from 0 to 1000 and converted
using the captured dimensions. Main-process checks additionally verify snapshot
age, display, focus, and browser bounds. Repeated activation at the same location
is rejected until another operation resets the guard. Screenshots after input
allow visible verification; sending an event alone is not a successful task.
Spotify content remains in the local player and is excluded from these captures.

## Evidence

- `npm test`: full existing suite plus protocol/tool tests passed.
- `CODEX-COMPUTER-VERIFICATION.json`: actual installed Codex, packaged Linux mirror,
  real display screenshots and actual Chromium click. A shuffled local fixture
  received exactly one FEATHER activation, and the model read its randomized
  visible message. No physical sensors or production accounts were used.
- `CODEX-LIFECYCLE-VERIFICATION.json`: actual packaged Stop/mute controls and IPC
  with a synthetic app-server and delayed screenshot. Stop/mute cancelled tasks,
  late observations were discarded, hard mute rejected new tasks, and no late
  input or renderer exceptions occurred.
- The packaged eight-garment photo workflow passed again after this integration.

Run the optional checks on an isolated display with
`xvfb-run -a node tools/check-codex-computer.cjs` and
`xvfb-run -a node tools/check-codex-lifecycle.cjs`. The first makes a real subscription inference
request and sends the isolated display image to Codex. Neither check proves
physical-camera interaction, Windows input, production service behavior, or
realistic moving cloth.

This incorporates the Codex integration idea from remote main's `9897da6`.
It is a selective integration, not a full merge of main: persistent embedded
browser/media controls, multi-slot outfits, and clap/face navigation still need
reconciliation with the tested local AR, voice, and power lifecycle.

Account prompt and shared-location freshness checks are described in
`ADVERSARIAL-AUDIT-2026-10-08.md`. Managed-browser account detection pauses
screen/input during recognized sign-in prompts; it does not establish coverage
for native OS dialogs or external sign-in popups.
