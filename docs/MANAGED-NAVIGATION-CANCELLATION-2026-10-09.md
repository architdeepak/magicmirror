# Managed-browser navigation ownership

Status: specific cancellation and supersession journeys verified; G4 remains open.

## Defects and changes

Managed `loadURL` calls formerly showed the browser after awaiting the load without
checking whether Stop or a newer request had cancelled them. Their catch handler
could also close the window belonging to a newer request.

A navigation owner now invalidates pending loads on Stop, desktop cancellation,
browser return, agent completion/cancellation and a newer open request. Pending
hidden windows stop loading and retire; an already visible browser stays available.
Cancelled and superseded success/failure callbacks cannot show, refocus or close
the current browser. Invalid URLs do not cancel a valid request.

The first runtime audit exposed a second race: Electron closes asynchronously, so
the successor could reuse the closing hidden window and fail with `ERR_FAILED`.
Retired windows now detach immediately, before choosing the next browser. Their
late close events also cannot invalidate observations or refocus the mirror over
a newer browser. Native companion presentation suppresses browser-close refocus.

## Verification

- Full `npm test` passed on final source.
- Production-function unit tests cover late success after Stop, older failure,
  asynchronously closing predecessor, old-close notification/focus suppression,
  preservation of visible browsers, invalid-URL ownership, actual load failure
  cleanup and stop on a crashed webContents.
- Packaged actual IPC/HTTP lifecycle test passes with a synthetic Codex stdio
  process: actual Stop/mute buttons cancel tasks and discard delayed observations;
  a pending local page never appears after Stop; an older request cannot close its
  successor; the successor's actual Chromium document title is verified; a reload
  cancelled by Stop preserves the visible browser; explicit return closes it.
- The new packaged lifecycle test copies an immutable build and records its hash.
  It does not use a model, paid provider, physical microphone or Windows input.

- Actual installed Codex journey passed with real screen pixels and Chromium input:
  it opened the local randomized page, clicked FEATHER exactly once, inspected
  the resulting display and returned `REVEALED: OPAL 144` in six tool calls.
  The hidden message was generated before task execution and absent from its
  prompt. This uses the existing ChatGPT account; the adapter rejects API billing.
- Final archive: `3119e4111fd56a5f43eff9c7f86c37d79567dcee43ce67a1d58182af86d4e998`.
- [IPC lifecycle](MANAGED-NAVIGATION-LIFECYCLE-VERIFICATION.json),
  [actual Codex journey](MANAGED-NAVIGATION-CODEX-VERIFICATION.json),
  [observed result](media/managed-navigation-codex-result.jpg).

The synthetic delayed HTTP endpoint and local navigation page are fixtures.
These results do not prove arbitrary website/account flows, cancellation of a
native application launch already handed to Windows, or all agent/user concurrency.
The full integrated agent and media gates remain open.

## Monitoring

The earlier eight-hour software cohort finished with 9,440 samples and zero
recorded errors. Its immutable source is `2eea9ad`, archive
`7b9713a22acd17916af1b4a127bb08dbf27387e838bb6aa8f3390dd9fbfe5316`.
It had camera/cloud/media off and predates recent avatar, Watch and browser changes.
[Final record](PRIOR-BUILD-EIGHT-HOUR-MONITOR-FINAL.json). It is lifecycle evidence,
not eight-hour combined release-candidate qualification. The Watch transition
NVIDIA monitor continues on its own older immutable build.
