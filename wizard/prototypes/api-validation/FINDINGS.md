# API-validation prototype — FINDINGS

**Status:** Filled in from two live runs against the production portal,
2026-05-19. Node-based validator + Puppeteer-driven headless Chrome CORS
test both complete.

**Date run:** 2026-05-19
**Run by:** Claude Code (automated) on Garbonzo's behalf
**Key source:** test key, scheduled for deletion post-demo (no fingerprint
recorded here)
**Portal version:** unknown (no version surface exposed)
**Browser:** system Google Chrome 148.0.7778.x via Puppeteer
**Origin tested:** `http://localhost:8765`

---

## 1. Does an API key generated in the portal UI actually work?

_Expected:_ yes, per scope doc and `secretvm-cli` `src/services/apiClient.ts:85-87`.

- [x] Yes, at least one endpoint returned 2xx with `Authorization: Bearer <key>`.

All three probed endpoints returned 200 with the bearer header. The key
is real, the bearer-auth path is live, and the portal accepts it for at
least read operations. We did not exercise `POST /api/vm/create`.

---

## 2. Which endpoint should the wizard use to validate a key?

**Critical finding: `/api/auth/session` is NOT a usable validator.** It
returns `HTTP 200` with body `{}` for every input — good key, bad key, no
key. That's NextAuth's stock "no session" response; the bearer-auth path
bypasses NextAuth sessions entirely, so this endpoint cannot distinguish
authenticated from unauthenticated callers.

`/api/templates` is **also not usable** — it returns the same 8 templates
regardless of auth state (200 with good key, 200 with bad key, 200 with
no key). It's a public endpoint.

`/api/vm/instances` is the only endpoint of the three that cleanly
differentiates: **200 with valid key, 401 with bad/missing key.**

| Endpoint              | HTTP (valid key) | HTTP (bad key)         | HTTP (no key)          | Latency (median of 5) | Notes                                                                |
|-----------------------|------------------|------------------------|------------------------|-----------------------|----------------------------------------------------------------------|
| GET /api/auth/session | 200 `{}`         | 200 `{}`               | 200 `{}`               | 167ms                 | NextAuth probe; bearer auth doesn't populate it. Useless for valid.  |
| GET /api/vm/instances | 200 (VM array)   | 401 (structured error) | 401 (structured error) | 183ms                 | **The validation endpoint.** Returns user's actual VM list.          |
| GET /api/templates    | 200 (templates)  | 200 (same templates)   | 200 (same templates)   | 113ms                 | Public. Useful for the wizard's template UX, not for key validation. |

**Recommendation:** `GET /api/vm/instances` with `Authorization: Bearer <key>`.
It is the only endpoint of the three that returns 401 for an invalid key.
The response body on success is an array of VM objects (potentially large
if the user has many VMs); the wizard only needs the status code, so it
can read the response shape lazily or stream-discard the body.

A lighter-weight alternative would be ideal — paying ~5KB of VM-list JSON
to validate a key is wasteful — but none of the probed lightweight
endpoints (`/api/me`, `/api/user`, `/api/auth/me`, `/api/account`,
`/api/users/me`, `/api/profile`) exist. `/api/auth/me` returns `HTTP 400`
which is interesting and may indicate a real endpoint expecting different
input; not worth chasing for v1.

---

## 3. What user identity is available in the response?

**Critical finding: no user identity is exposed to bearer-token callers.**

The first VM instance in the returned array has these identity-relevant
fields:

```
ownerSub: null
teamId:   null
teamName: null
userRole: null
```

All null. The portal does not annotate VM records with the owner's
identifying information when accessed via the bearer-auth path. (Plausibly
because the bearer key *is* the identity, and the portal sees no reason
to round-trip it back.)

No dedicated identity endpoint exists either:

```
GET /api/me          → 404 "Page not found"
GET /api/user        → 404 "Page not found"
GET /api/auth/me     → 400 (unusual — may exist but needs different params)
GET /api/account     → 404 "Page not found"
GET /api/users/me    → 404 "Page not found"
GET /api/profile     → 404 "Page not found"
```

The full per-instance shape (35 keys) for reference, sanitized of values:

```
id, name, nameFromUser, vmTypeId, hostId, memory, vcpus, disk_size,
status, vmDomain, dev_token_name, dev_token_hint, createdAt, updatedAt,
teamId, teamName, ownerSub, userRole, isCluster, clusterName,
lbClusterId, vmType_type, vmType_cpu, vmType_ram, vmType_disk,
vmType_traffic, vmType_pricePerHour, host_host, host_port, vmType,
host, teamInfo, state, k8sCluster, k8sWorker
```

Identifiers present: **none usable.**

- [ ] wallet address — not exposed
- [ ] email — not exposed
- [ ] sub / user ID — `ownerSub` field exists but is null in the sample
- [ ] display name — `teamName` exists but is null
- [x] none — response only confirms validity by returning rather than 401-ing

**Implication for Chunk 3:** the wizard cannot show "Connected as
`<wallet>`" or "Connected as `<email>`" on screen 2. The only feedback
the wizard can show after validation is "API key valid ✓" plus
optionally "found N existing VMs in your account" (if N > 0, derived
from the array length). Even that wording is awkward because the array
might be 0 for a first-time user, which would read as "no VMs" rather
than a meaningful confirmation.

---

## 4. Does the `x-swagger: true` header matter?

- [x] Optional — both header variants returned 2xx with identical bodies on
      every endpoint.

The CLI (`src/services/apiClient.ts:85-87`) sets `x-swagger: true` on the
bearer-auth branch, but the portal does not appear to require it. The
status code, body shape, content-type, and latency were all identical
across the with/without variants in our two runs.

**Recommendation for the wizard:** don't set `x-swagger: true`. It's
incidental, not required, and dropping it removes one piece of
incidental-complexity copy from "what makes a Secret Claw request."

If the portal ever starts gating endpoints behind it for non-Swagger
clients (unlikely but possible), the wizard can add it back as a
single-line change.

---

## 5. Does bearer-token auth work cross-origin from a browser?

**Empirically tested. Verdict: NO. Blocked across all three endpoints.**

The wizard frontend **cannot** call the SecretAI portal directly from the
browser. A Next.js backend proxy (or equivalent server-side request
forwarder) is required for Chunk 3.

### Test setup

- **Origin:** `http://localhost:8765` (Python `http.server` serving
  `validate.html` from the prototype directory)
- **Browser:** system-installed Google Chrome (148.0.7778.x), headless,
  driven by Puppeteer's `cors-test.mjs`
- **Caveat:** the Puppeteer-bundled Chromium is blocked on the test host
  by a Windows Application Control policy. Tests ran against system
  Chrome via `executablePath` override. Real-Chrome behavior should be
  identical to what an end-user's browser would see.
- **Full per-request capture:** `cors-test-results.json` (gitignored)

### Empirical results

For every endpoint, the browser issued a preflight `OPTIONS` (because
the `Authorization` header is not CORS-safelisted) with these request
headers:

```
Origin: http://localhost:8765
Access-Control-Request-Method: GET
Access-Control-Request-Headers: authorization, x-swagger
```

The portal's response to each preflight:

| Endpoint              | OPTIONS status | `Access-Control-Allow-*` headers |
|-----------------------|----------------|----------------------------------|
| GET /api/auth/session | **400**        | **none returned**                |
| GET /api/vm/instances | **404**        | **none returned**                |
| GET /api/templates    | **404**        | **none returned**                |

Because the portal returns zero CORS response headers, every actual GET
request was blocked by the browser before it left the network stack.
Each of the three endpoints (× 2 header variants) produced a
`net::ERR_FAILED` and an identical browser-console error:

```
Access to fetch at 'https://secretai.scrtlabs.com/api/<path>' from
origin 'http://localhost:8765' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested
resource.
```

### Observations

- **The portal does not implement CORS preflight handling at all.** The
  OPTIONS routes are not registered (`404` on the VM/templates paths)
  and the auth route handles OPTIONS but rejects it (`400`). Either way,
  no `Access-Control-Allow-Origin` is ever produced.
- **The browser's preflight included `Access-Control-Request-Headers:
  authorization, x-swagger`.** Removing the `x-swagger` header from the
  wizard's request (see §4) would shrink the preflight to just
  `authorization`, but `Authorization` alone still triggers a preflight,
  so the CORS-block is unavoidable regardless.
- **No cookies were sent** — bearer auth doesn't require credentialed
  CORS — but that's not what's blocking us. The portal simply doesn't
  serve CORS at all for arbitrary origins, credentialed or not.

### Implications for Chunk 3 architecture

The wizard frontend **must** route all SecretAI portal calls through a
server-side proxy. Concretely:

- **Architecture:** Next.js App Router with API routes under
  `wizard/app/api/portal/*`. Each route accepts the wizard's call,
  validates the shape, attaches the user-supplied bearer token to a
  server-to-server request to `https://secretai.scrtlabs.com`, and
  streams the response back. Same-origin from the browser's view; no
  CORS issue.
- **Calls that need to be proxied:**
  - `GET /api/vm/instances` (API-key validation — see §2)
  - `POST /api/vm/create` (provisioning submission)
  - `GET /api/background-job/<jobId>` (provisioning polling)
  - `GET /api/templates` (optional, if used for screen 1 template
    preview — see §8 implication #4)
- **Cost:** ~50-100 lines of API-route handler per endpoint, no new
  infrastructure (Vercel routes are first-class). Performance is one
  extra hop (~50-100ms over direct), well within the 5s validation
  timeout.
- **Security note:** the bearer token never lives on the wizard's
  server beyond the lifetime of one request. The proxy passes it
  through; nothing is persisted. This preserves the scope doc's "no
  user credentials persisted in our infrastructure" property.
- **Alternative to consider:** ask Secret Labs to allowlist the wizard's
  origin. The CORS-block is a policy decision on their end, not a
  technical impossibility. If they're amenable, that path eliminates
  the proxy. But:
  - It bottlenecks Chunk 3 on a coordination dependency.
  - It only solves CORS for our specific origin (e.g.
    `https://wizard.secretclaw.io`) — every preview/staging origin
    needs its own allowlist entry.
  - The proxy approach works today, with no external dependency.

**Recommendation:** build the Next.js proxy in Chunk 3. Treat a portal
CORS allowlist as a future optimization, not a blocker.

### Caveats to flag

- Tested with a single origin (`http://localhost:8765`). The verdict
  applies to *any* non-portal origin because the portal returns *no*
  CORS headers — there's nothing origin-specific being matched against.
- Headless Chrome with system Chrome is faithful to interactive Chrome
  for CORS enforcement; CORS is a browser-engine feature, not a UI
  feature. Firefox and Safari would behave identically.
- We did not test `mode: "no-cors"` requests — those would succeed at
  the network level but return opaque responses the wizard can't read,
  so they're useless for the wizard's needs.

---

## 6. Latency observations

5 samples of `GET /api/vm/instances` from a residential US broadband
connection (Node, Windows host):

```
179, 225, 155, 190, 183  → median 183ms, range 155-225ms
```

Earlier in the same run, three endpoints across two header variants gave:

| Endpoint              | Node (observed range) |
|-----------------------|-----------------------|
| GET /api/auth/session | 54-306ms              |
| GET /api/vm/instances | 132-437ms             |
| GET /api/templates    | 88-141ms              |

The 437ms outlier was the first call (cold connection establishment).
Steady-state behavior is sub-300ms.

**Recommendation for wizard timeout:**

- Fetch timeout: **5 seconds.** Comfortable headroom over the observed
  ceiling, gives the user a clear "took too long, retry" path.
- Loading state: show "Validating API key…" spinner if the validation
  call has not returned within ~200ms. Most calls complete fast enough
  that no spinner needs to appear, but the slower ones (~400ms) should
  be acknowledged visually rather than feeling janky.
- Browser counterpart would have included a preflight `OPTIONS` round-trip
  on top of the GET (see §5), but the preflight failure means no browser
  GET ever ran successfully. Through the Chunk 3 server-side proxy, the
  user-perceived latency will be roughly `(browser ↔ proxy) +
  (proxy ↔ portal)` — call it Node-observed latency plus ~50-100ms for
  the extra hop in production.

---

## 7. Surprises vs the research doc

1. **`/api/auth/session` is useless for bearer-auth validation.** The
   research doc (§1a, §2.1, scope doc §"Provisioning architecture" step 2)
   pointed at it as the candidate "is this key valid?" probe. Empirically
   it's a NextAuth session probe that ignores bearer auth, returning
   `{}` 200 regardless of input. This needs back-edits in two places:

   - `docs/secret-claw-v1-demo-scope.md` line 41: "Real-time validation
     against the portal's `/api/auth/session` endpoint (or equivalent
     lightweight check)" — update to point at `/api/vm/instances`.
   - `docs/secret-claw-v1-build-plan.md` line 65 and line 178: same
     correction.

2. **No identity endpoint exists at any of the obvious paths.** The scope
   doc's reference to showing user-identifying feedback assumes an
   identity payload that the portal doesn't expose to bearer-token
   callers. The wizard's UX needs to drop "Connected as `<X>`" framing.

3. **`x-swagger: true` is decorative, not required.** The research doc
   read this header as the bearer-branch signature; empirically the
   portal accepts bearer auth without it. (The CLI may set it for its
   own reasons — e.g. for the portal's internal logging to distinguish
   programmatic from interactive clients.)

4. **`/api/templates` is public.** The research doc didn't say either
   way. Worth knowing — the wizard can fetch templates before the user
   has provided a key, e.g. for a tier-selection screen that previews
   what's deployable.

5. **The user account already has 10 VMs.** Not a portal finding,
   just a context note: this key belongs to a developer with prior
   deployments, so a "no VMs yet" state hasn't been tested. The wizard
   should handle both N=0 and N>0 responses gracefully.

---

## 8. Implications for Chunk 3 (wizard frontend)

Concrete things this changes about the planned implementation:

1. **Build a Next.js API-route proxy. Don't call the portal from the
   browser.** The portal returns no CORS headers, so every browser-direct
   request is blocked at preflight. Chunk 3's architecture must include
   server-side proxy routes for `/api/vm/instances`, `/api/vm/create`,
   `/api/background-job/<jobId>`, and `/api/templates`. The browser talks
   to `wizard/app/api/portal/*` (same-origin, no CORS); those routes
   talk to `secretai.scrtlabs.com` server-side. See §5 for the
   architecture sketch.

2. **Use `GET /api/vm/instances` as the API-key validation probe**, not
   `/api/auth/session`. Check for HTTP 200 vs 401; ignore the response
   body (or expose the list length as a soft "found N existing VMs"
   tooltip if it adds UX value). Implemented behind the proxy, this is
   the wizard's screen-2 validation call.

3. **Drop "Connected as `<wallet>`" feedback from screen 2.** The portal
   doesn't expose identity to bearer callers. Screen 2's success state
   becomes: "Your SecretAI key is valid. Proceed →". If the validation
   call returns ≥1 VMs, we can optionally surface "Looks like you've
   deployed VMs here before" as friendly context, but nothing
   identifying.

4. **Don't set `x-swagger: true`.** Match the simplest spec: bearer
   header only. One less incidental header to explain in the docs and
   one less header to maintain if the portal ever changes its mind
   about Swagger gating. (Also: it appears in the CORS preflight
   `Access-Control-Request-Headers` list, so dropping it slightly
   simplifies the preflight signature — though this is cosmetic, the
   preflight is still going to be required and still going to be
   blocked.)

5. **The proxy must forward the user's bearer token without persisting
   it.** Each wizard request carries the token in the request body or
   header to the proxy route; the proxy attaches it to the upstream
   call and returns the response. Nothing is logged, nothing is stored.
   This preserves the scope doc's "no user credentials persisted in our
   infrastructure" property.

6. **(Stretch, not a Chunk 3 blocker):** the wizard *can* fetch
   `/api/templates` via the proxy before the user provides a key,
   opening the door to a richer tier-selection screen 1 that previews
   what each template does. Not in v1 demo scope, but worth knowing.

---

## 9. Open follow-ups

- [x] **Run the browser CORS test (§5)** — *was blocking Chunk 3
      architecture decision*. Done. Verdict: blocked. Architecture: Next.js
      proxy.
- [ ] **Decide whether to ask Secret Labs to allowlist the wizard's
      origin in the portal's CORS config** — *non-blocking optimization*.
      Would eliminate the proxy if granted, but the proxy works today
      without external coordination. Defer to post-demo unless other
      Chunk 3 work surfaces a reason to revisit.
- [ ] **`/api/auth/me` returned 400 instead of 404** — *non-blocking,
      curious*. Might be a real endpoint expecting POST or specific
      params. If it exposes user identity, it would let the wizard show
      "Connected as `<X>`" after all. Worth ~30 minutes if the CORS test
      surfaces other gaps anyway.
- [ ] **Back-edit `docs/secret-claw-v1-demo-scope.md` and
      `docs/secret-claw-v1-build-plan.md`** to replace
      `/api/auth/session` with `/api/vm/instances` in the validation
      flow, **and** to call out the Next.js proxy requirement — *non-blocking,
      hygiene*. Best done as part of the next planning-doc update rather
      than now.
- [ ] **Test with a first-time-user account (zero VMs)** — *non-blocking*.
      Confirms `/api/vm/instances` still returns 200 (with `[]`) for
      brand-new users; if it 404s or 401s for accounts with no VMs, the
      validation endpoint breaks for our most important user. Low risk
      because the response is "list of VMs" not "details of one VM," but
      empirically untested.
- [ ] **Confirm `POST /api/vm/create` works end-to-end through the
      Chunk 3 proxy** — *blocking for Chunk 3 integration tests, not
      for design*. Out of scope for this validation prototype by design;
      will be exercised as part of the Chunk 3 wizard build with a real
      (and ideally short-lived) test VM.
