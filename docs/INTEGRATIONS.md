# Mirror integration contracts

## Local closet

`Try on → Add garment` copies an image into `data/closet/<garment-id>/front.*`.
`data/closet.json` remains the local source of truth. Prefer a clean,
front-facing transparent PNG; importing does not upload the garment.

## Try-on job boundary

Only after the explicit consent checkbox and button press, the renderer captures
one 1024px-or-smaller JPEG into `data/tryon/` with a local job manifest. No
external provider is called by the current implementation.

A provider adapter must receive `{ jobId, personFramePath, garment }` and
return a result image path plus confidence, latency, and failure reason. Keep
the consent gate and show provider retention/cost before a future dispatch.

## Connector rules

External service tokens and client secrets belong in Electron's main process or
an OS credential store—not renderer JavaScript, localStorage, or UI state.
Start connectors read-only and add write scopes only after an explicit action.
Find My remains a secure external handoff, not a personal-location connector.
