#!/usr/bin/env node
// Headless CORS test for the SecretAI portal.
//
// Runs the three validate.html endpoint probes from a real browser origin
// (http://localhost:8765) under headless Chromium via Puppeteer. Captures:
//   - the preflight OPTIONS request (if any) and its CORS response headers
//   - the actual GET request, its status, and its response headers
//   - all browser console messages, including any CORS policy errors
//
// This is the answer to "can the wizard frontend call the portal directly
// from the browser, or does it need a Next.js backend proxy?"
//
// Output: cors-test-results.json (gitignored).

import puppeteer from "puppeteer";
import { readFileSync, writeFileSync, existsSync } from "fs";

const PORTAL = "https://secretai.scrtlabs.com";
const ORIGIN = "http://localhost:8765";
const PAGE_URL = `${ORIGIN}/validate.html`;
const ENDPOINTS = ["/api/auth/session", "/api/vm/instances", "/api/templates"];

function loadKey() {
  const envFromShell = process.env.SECRETAI_API_KEY;
  if (envFromShell && envFromShell !== "sk-replace-me") return envFromShell;
  if (existsSync(".env")) {
    const envText = readFileSync(".env", "utf8");
    const m = envText.match(/^SECRETAI_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error("No SECRETAI_API_KEY in env or .env");
}

const apiKey = loadKey();

// Bundled Puppeteer Chromium is blocked by Windows Application Control on
// this host. Use system-installed Chrome instead.
const SYSTEM_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  headless: true,
  executablePath: SYSTEM_CHROME,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();

const consoleMessages = [];
page.on("console", (msg) => {
  consoleMessages.push({
    type: msg.type(),
    text: msg.text(),
  });
});
page.on("pageerror", (err) => {
  consoleMessages.push({ type: "pageerror", text: err.message });
});

// Track every request/response that hits the portal.
const portalEvents = []; // { url, method, type, status, requestHeaders, responseHeaders, failed, failureText }
const requestById = new Map();

page.on("request", (req) => {
  const url = req.url();
  if (!url.startsWith(PORTAL)) return;
  requestById.set(req, {
    url,
    method: req.method(),
    type: req.resourceType(),
    requestHeaders: req.headers(),
    aborted: req.isInterceptResolutionHandled?.() ?? false,
  });
});

page.on("response", async (res) => {
  const req = res.request();
  if (!req.url().startsWith(PORTAL)) return;
  const captured = requestById.get(req) || { url: req.url(), method: req.method() };
  let bodySnippet = null;
  try {
    const text = await res.text();
    bodySnippet = text.length > 300 ? text.slice(0, 300) + "..." : text;
  } catch {
    bodySnippet = "(unreadable)";
  }
  portalEvents.push({
    ...captured,
    status: res.status(),
    statusText: res.statusText(),
    responseHeaders: res.headers(),
    bodySnippet,
  });
});

page.on("requestfailed", (req) => {
  if (!req.url().startsWith(PORTAL)) return;
  const captured = requestById.get(req) || { url: req.url(), method: req.method() };
  portalEvents.push({
    ...captured,
    failed: true,
    failureText: req.failure()?.errorText || "unknown",
  });
});

console.log(`Origin: ${ORIGIN}`);
console.log(`Target portal: ${PORTAL}`);
console.log(`Endpoints under test: ${ENDPOINTS.join(", ")}`);
console.log("");

await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });

// Fill in the API key field and trigger the validation.
await page.$eval("#apikey", (el, key) => {
  el.value = key;
}, apiKey);

// Click "Run validation" — this triggers all 3 endpoints × 2 header variants
// inside validate.html.
await page.click("#run");

// Wait for the button to re-enable (indicates all probes complete).
await page.waitForFunction(
  () => !document.getElementById("run").disabled,
  { timeout: 30_000 }
);

// Brief pause to let any trailing console events flush.
await new Promise((r) => setTimeout(r, 500));

await browser.close();

// Group portal events by endpoint path for the report.
function pathOf(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

const grouped = {};
for (const ep of ENDPOINTS) grouped[ep] = { preflights: [], requests: [] };
for (const ev of portalEvents) {
  const p = pathOf(ev.url);
  if (!grouped[p]) grouped[p] = { preflights: [], requests: [] };
  if (ev.method === "OPTIONS") grouped[p].preflights.push(ev);
  else grouped[p].requests.push(ev);
}

const corsHeaderKeys = [
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-expose-headers",
  "access-control-max-age",
];
function extractCors(headers) {
  const out = {};
  for (const k of corsHeaderKeys) {
    if (headers && k in headers) out[k] = headers[k];
  }
  return out;
}

// Build a clean summary.
const summary = {
  meta: {
    origin: ORIGIN,
    portal: PORTAL,
    runAt: new Date().toISOString(),
    keyLength: apiKey.length,
    keyPrefix: apiKey.slice(0, 6),
    keySuffix: apiKey.slice(-4),
  },
  endpoints: {},
  consoleMessages,
  corsErrorsInConsole: consoleMessages.filter((m) =>
    /cors|cross[- ]origin|preflight/i.test(m.text)
  ),
};

for (const [path, ev] of Object.entries(grouped)) {
  summary.endpoints[path] = {
    preflightCount: ev.preflights.length,
    preflights: ev.preflights.map((p) => ({
      status: p.status ?? null,
      failed: !!p.failed,
      failureText: p.failureText ?? null,
      requestHeaders: {
        "access-control-request-method":
          p.requestHeaders?.["access-control-request-method"] ?? null,
        "access-control-request-headers":
          p.requestHeaders?.["access-control-request-headers"] ?? null,
        origin: p.requestHeaders?.origin ?? null,
      },
      responseCors: extractCors(p.responseHeaders),
    })),
    requests: ev.requests.map((r) => ({
      status: r.status ?? null,
      failed: !!r.failed,
      failureText: r.failureText ?? null,
      requestHeadersOfInterest: {
        origin: r.requestHeaders?.origin ?? null,
        authorization: r.requestHeaders?.authorization
          ? "(present, redacted)"
          : null,
        "x-swagger": r.requestHeaders?.["x-swagger"] ?? null,
      },
      responseCors: extractCors(r.responseHeaders),
      bodySnippet: r.bodySnippet,
    })),
  };
}

writeFileSync(
  "cors-test-results.json",
  JSON.stringify(summary, null, 2)
);

// Console summary
console.log("Per-endpoint observations:\n");
for (const [path, data] of Object.entries(summary.endpoints)) {
  console.log(`  ${path}`);
  console.log(`    preflights: ${data.preflightCount}`);
  for (const pf of data.preflights) {
    console.log(`      OPTIONS → status ${pf.status ?? "(none)"}` +
      (pf.failed ? ` FAILED (${pf.failureText})` : ""));
    if (Object.keys(pf.responseCors).length) {
      console.log(`        CORS headers: ${JSON.stringify(pf.responseCors)}`);
    } else {
      console.log(`        CORS headers: (none returned)`);
    }
  }
  console.log(`    actual requests: ${data.requests.length}`);
  for (const r of data.requests) {
    const f = r.failed ? ` FAILED (${r.failureText})` : "";
    console.log(`      GET    → status ${r.status ?? "(none)"}${f}`);
    if (Object.keys(r.responseCors).length) {
      console.log(`        CORS headers: ${JSON.stringify(r.responseCors)}`);
    }
  }
  console.log("");
}

console.log(`Console messages from page: ${consoleMessages.length}`);
console.log(`Console CORS-related messages: ${summary.corsErrorsInConsole.length}`);
for (const m of summary.corsErrorsInConsole) {
  console.log(`  [${m.type}] ${m.text}`);
}
console.log("");
console.log("Full report written to cors-test-results.json (gitignored).");
