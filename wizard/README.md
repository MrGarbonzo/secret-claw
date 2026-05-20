# Secret Claw wizard (Chunk 3)

Next.js (App Router) wizard that lets a user deploy their own AI agent on
SecretVM via the SecretAI portal API. Implements the Chunk 3 product
surface from `../docs/secret-claw-v1-build-plan.md` (v0.8) and the design
sketched in `../docs/wizard-design.md` (v0.3).

Two views:

- `/create-agent` — single-page configuration form with five sections
  (Tier / SecretAI key / Anthropic key / Telegram / Submit)
- `/agents/<deployment_id>` — agent detail page with Overview + Logs tabs

## Running locally

```powershell
cd C:\dev\secret-claw\wizard
npm install
copy .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000/`. The root path redirects to `/create-agent`.

## Build, type-check, test

```powershell
npm run build       # production build (Next.js)
npm run typecheck   # tsc --noEmit
npm test            # runs tests/*.test.ts including the render byte-equivalence test
```

The render byte-equivalence test (`tests/render.test.ts`) shells out to
`../deploys/byo/scripts/render.py` with a fixed config and fixed random
values, runs `lib/render.ts` with the same inputs, and asserts the
generated `docker-compose.yml`, `openclaw.rendered.json`,
`cron-jobs.rendered.json`, and four workspace markdown files are byte
identical. Python 3.10+ on PATH is required.

## What's in here

| Path                                | Purpose                                                                 |
|-------------------------------------|-------------------------------------------------------------------------|
| `app/create-agent/page.tsx`         | The single-page configuration form                                      |
| `app/agents/[deployment_id]/page.tsx` | Agent detail page (Overview + Logs)                                   |
| `app/api/portal/validate-secretai-key/route.ts` | Proxy → `GET /api/vm/instances` (key validation)            |
| `app/api/portal/submit-deployment/route.ts` | Submission endpoint (sync record + `waitUntil` continuation)    |
| `app/api/deployment-status/[deployment_id]/route.ts` | Status read for detail-page polling                    |
| `app/api/validate-anthropic-key/route.ts` | Anthropic key validation (test one-token call)                    |
| `app/api/validate-telegram/route.ts` | Telegram bot-token validation (`getMe`)                                |
| `components/*`                      | Portal-style component primitives (Position A visual language)         |
| `lib/render.ts`                     | TypeScript port of `../deploys/byo/scripts/render.py`                  |
| `lib/portal-client.ts`              | Helpers for talking to the SecretAI portal server-side                 |
| `lib/db.ts`                         | In-memory deployment record store (Chunk 4 swaps for Supabase)         |
| `lib/types.ts`                      | Shared TypeScript types                                                |
| `tests/render.test.ts`              | Byte-equivalence test against the Python renderer                      |

## Manual end-to-end test (when ready to submit to the live portal)

The build is not wired to the real portal during local dev by default —
the `submit-deployment` handler does call the portal when given a real
API key. To run an end-to-end test:

1. Generate a real SecretAI API key (https://secretai.scrtlabs.com → API keys).
2. Generate a real Anthropic API key.
3. Optionally generate a real Telegram bot token + chat ID via BotFather.
4. `npm run dev`, open `http://localhost:3000/create-agent`.
5. Paste the SecretAI key into Section 2; tab out. The "Validating…" pill
   should flip to "Valid".
6. Paste the Anthropic key into Section 3; tab out. Same flip.
7. Enable Telegram if you have credentials, paste them; tab out.
   ("Skip" works too.)
8. Click **Create**. Watch the browser navigate to `/agents/<deployment_id>`.
9. The Overview tab should show the deployment ID, the agent name
   (Secret Agent), tier (BYO), Telegram flag, creation time, and a
   status pill ("Submitted" → "Provisioning"). Polling fires every 3s.
10. When status flips to "Ready", the page should render the agent URL,
    gateway token (click-to-reveal + copy), and Telegram bot username
    (if applicable).
11. Click the Logs tab. It fetches the latest log lines from the
    gateway endpoint on activation; manual refresh button available.

## Known gaps / decisions made during Chunk 3 build

- **VM_HOSTNAME ambiguity.** `render.py` requires VM_HOSTNAME at render
  time. The portal returns the hostname only *after* `vm/create`. The
  wizard form has no hostname input by design. `lib/render.ts` accepts
  an optional `vmHostname`; when omitted (the production submit path) it
  burns the wildcard `*.vm.scrtlabs.com` into
  `controlUi.allowedOrigins`. The byte-equivalence test passes a
  concrete hostname so the Python comparison is meaningful. Flagged for
  follow-up — confirm the wildcard is accepted by OpenClaw's control UI
  origin check, or move the hostname substitution to seed-script-time
  using `vmDomain` from `usr/.env`.
- **Logs tab endpoint.** The OpenClaw gateway log path is not
  documented in FINDINGS.md. The Logs view fetches via a placeholder
  endpoint (`https://<vm_hostname>/_logs?n=200`) and gracefully shows
  "Logs unavailable" when the call fails. Real endpoint should be
  wired in once we confirm OpenClaw's log surface — flagged in the
  design doc's Logs tab open questions.
- **In-memory deployment record store.** Chunk 4 will replace this
  with Supabase. The `Db` interface in `lib/db.ts` is the swap point.
  In-memory state is lost on dev-server restart.
- **`waitUntil` reliability** is not yet smoke-tested against a real
  Vercel deploy. The fallback (polling-driven progression) is *not*
  implemented preemptively — see the build plan's Chunk 4 fallback
  note.
- **Anthropic Sonnet 4.6 access detection.** Anthropic validation
  does a single one-token call; the model ID is read from the rendered
  template. We do not separately probe whether the key has Sonnet 4.6
  access — if it doesn't, the agent surfaces the error at first
  inference rather than at form validation. Matches the simpler
  option in design doc Section 3 question 5.

## Files NOT to touch

`../deploys/byo/` is the canonical deploy template — `lib/render.ts` is
a faithful Node port, not a modification. The Python renderer
`../deploys/byo/scripts/render.py` is the source of truth; the byte
test enforces equivalence.
