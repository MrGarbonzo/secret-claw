# API-validation prototype

**Chunk 2 deliverable, Secret Claw v1 demo.** Confirms the SecretAI portal's
`Authorization: Bearer <api_key>` path works the way the research doc
predicts, so the wizard's auth assumption is empirically grounded before
Chunk 3's frontend build.

## TL;DR — headline findings (full detail in `FINDINGS.md`)

- **`GET /api/vm/instances`** is the API-key validator (200 for valid keys
  with a VM list; structured 401 for invalid/missing). `/api/auth/session`
  is unusable — returns `{}` 200 regardless of bearer-token state.
- **No identity is exposed to bearer callers** — `ownerSub`, `teamId`,
  `userRole` all null; no `/api/me`-style endpoint exists. The wizard
  cannot display "Connected as `<wallet>`".
- **The portal does not implement CORS preflight handling.** Empirical
  test via headless Chrome: every cross-origin browser request is blocked
  before it leaves the network stack (no `Access-Control-Allow-Origin`
  ever returned). **Chunk 3 must include a Next.js API-route proxy for
  all portal calls.** The browser talks same-origin to `wizard/app/api/portal/*`;
  the proxy attaches the user's bearer token and forwards to
  `https://secretai.scrtlabs.com` server-side, never persisting the token.
- **`x-swagger: true`** is decorative — optional and dropped from the
  recommended request shape.

## What this validates

The wizard's planned auth model is:

1. User generates an API key in the SecretAI portal UI (one-time, in the portal).
2. User pastes that key into the wizard.
3. Wizard sends `Authorization: Bearer <key>` (and `x-swagger: true`) on every portal call.

This prototype confirms, against a real API key, that:

- A key generated in the portal UI actually authenticates against
  `/api/auth/session` (or another lightweight read endpoint).
- The response identifies the user in some way (wallet address, email, sub,
  etc.) so the wizard can show "deploying as `<you>`" feedback.
- Cross-origin browser fetches with a bearer header work without CORS
  preflight blocking them. (Bearer auth is supposed to bypass credentialed
  CORS — this is the empirical confirmation.)
- Listing endpoints like `/api/vm/instances` and `/api/templates` work with
  the same key (they're what the wizard's status polling will use).
- The observed latency is in a sane range for real-time form validation
  (sub-second ideally; under 3s acceptable).

## What this does NOT do

- **Does not call `POST /api/vm/create`.** That actually provisions a VM and
  costs resources. The point of validation is to confirm the auth header
  works; the rest of the create flow is a separate exercise once we're
  past Chunk 2.
- **Does not store the API key anywhere.** The key is read from the
  environment per invocation and discarded. Don't commit a real `.env`.
- **Does not test the create-and-poll flow.** That's a later prototype.

## How to run

Prerequisites: Node 20+ (uses native `fetch` and ESM). No npm install.

```powershell
# 1. Get an API key from the SecretAI portal:
#    https://secretai.scrtlabs.com  →  sign in with Keplr  →  API keys  →  Generate
# 2. Set it as an environment variable (PowerShell):
$env:SECRETAI_API_KEY = "sk-..."
# 3. Run the Node validator:
node validate.mjs
```

Or pass the key as the first argument:

```powershell
node validate.mjs sk-...
```

Output: per-endpoint table with HTTP status, response top-level keys, and
latency. Each endpoint is tried twice (with and without `x-swagger: true`)
so we can see whether the header is actually required.

### Browser CORS test

Open `validate.html` in a browser — but **not** as `file://` (that gives
`Origin: null` which is its own CORS curiosity). Serve it locally:

```powershell
# from this directory:
python -m http.server 8765
# then open http://localhost:8765/validate.html
```

Paste the API key into the form, click "Run." The page does the same calls
as the Node script from a real browser origin and shows the results. If
CORS blocks, the browser console will say so — that's signal too.

## Files

- `README.md` — this file
- `validate.mjs` — Node script, no CORS, baseline that the API works
- `validate.html` — same calls from a browser, surfaces CORS reality
- `.env.example` — placeholder env vars (do not commit `.env`)
- `FINDINGS.md` — Garbonzo fills this in after running the prototype

## Reference

- `../../docs/secretvm-provisioning-research.md` — the research that
  predicts how this should work, especially §1c (auth) and §3 (CORS).
- `secretvm-cli` `src/services/apiClient.ts:85-87` — the bearer-token
  + `x-swagger: true` branch this prototype is exercising.
- `secretvm-cli` `src/constants.ts:5-22` — endpoint map.
