#!/usr/bin/env node
// SecretAI portal API-key validator.
//
// Confirms that an API key generated in the SecretAI portal works against
// the documented bearer-auth endpoints. Read-only — never calls
// POST /api/vm/create or anything else that mutates state.
//
// Usage:
//   node validate.mjs                  # reads SECRETAI_API_KEY from env
//   node validate.mjs <api_key>        # reads from argv[2]
//   SECRETAI_BASE_URL=...  to override portal base URL

const DEFAULT_BASE_URL = "https://secretai.scrtlabs.com";

const ENDPOINTS = [
  {
    name: "auth.session",
    path: "/api/auth/session",
    note: "candidate validate-key endpoint — NextAuth session probe",
  },
  {
    name: "vm.instances",
    path: "/api/vm/instances",
    note: "lists user's VMs; definitely needs auth",
  },
  {
    name: "templates",
    path: "/api/templates",
    note: "may or may not require auth; useful to compare",
  },
];

function shapeOf(value, depth = 0) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${shapeOf(value[0], depth + 1)} × ${value.length}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (depth > 0) return `{${keys.length} keys}`;
    return `{ ${keys.join(", ")} }`;
  }
  return typeof value;
}

function previewBody(text, limit = 300) {
  if (!text) return "(empty)";
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;
  return collapsed.slice(0, limit) + "...";
}

async function callEndpoint({ baseUrl, path, apiKey, withSwaggerHeader }) {
  const url = `${baseUrl}${path}`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (withSwaggerHeader) headers["x-swagger"] = "true";

  const t0 = performance.now();
  let res;
  try {
    res = await fetch(url, { method: "GET", headers });
  } catch (err) {
    const elapsed = Math.round(performance.now() - t0);
    return {
      ok: false,
      transportError: err.message || String(err),
      elapsedMs: elapsed,
    };
  }
  const elapsed = Math.round(performance.now() - t0);

  const text = await res.text();
  let parsed = null;
  let parseError = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (err) {
    parseError = err.message;
  }

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    contentType: res.headers.get("content-type") || "",
    cors: {
      allowOrigin: res.headers.get("access-control-allow-origin"),
      allowCredentials: res.headers.get("access-control-allow-credentials"),
    },
    elapsedMs: elapsed,
    parsed,
    parseError,
    bodyPreview: previewBody(text),
    bodyLength: text.length,
  };
}

function formatResult(label, result) {
  if (result.transportError) {
    return `  ${label}: TRANSPORT ERROR after ${result.elapsedMs}ms — ${result.transportError}`;
  }
  const shape = result.parsed !== null ? shapeOf(result.parsed) : "(not JSON)";
  const lines = [
    `  ${label}: HTTP ${result.status} ${result.statusText} (${result.elapsedMs}ms)`,
    `    content-type: ${result.contentType || "(none)"}`,
    `    shape:        ${shape}`,
  ];
  if (result.parseError) {
    lines.push(`    parse-error:  ${result.parseError}`);
  }
  if (result.cors.allowOrigin || result.cors.allowCredentials) {
    lines.push(
      `    cors:         allow-origin=${result.cors.allowOrigin ?? "(none)"}` +
        `, allow-credentials=${result.cors.allowCredentials ?? "(none)"}`
    );
  }
  if (!result.ok || result.bodyLength < 400) {
    lines.push(`    body:         ${result.bodyPreview}`);
  }
  return lines.join("\n");
}

async function main() {
  const apiKey = process.argv[2] || process.env.SECRETAI_API_KEY;
  const baseUrl = process.env.SECRETAI_BASE_URL || DEFAULT_BASE_URL;

  if (!apiKey || apiKey === "sk-replace-me") {
    console.error(
      "ERROR: provide an API key via SECRETAI_API_KEY env var or as argv[1]."
    );
    console.error("       Get one from https://secretai.scrtlabs.com (API keys section).");
    process.exit(2);
  }

  console.log(`SecretAI portal API-key validator`);
  console.log(`base URL: ${baseUrl}`);
  console.log(`key:      ${apiKey.slice(0, 6)}…${apiKey.slice(-4)} (${apiKey.length} chars)`);
  console.log("");

  let anyAuthSuccess = false;

  for (const ep of ENDPOINTS) {
    console.log(`--- ${ep.name}  (GET ${ep.path})`);
    console.log(`    ${ep.note}`);

    const withSwagger = await callEndpoint({
      baseUrl,
      path: ep.path,
      apiKey,
      withSwaggerHeader: true,
    });
    console.log(formatResult("with x-swagger: true ", withSwagger));

    const withoutSwagger = await callEndpoint({
      baseUrl,
      path: ep.path,
      apiKey,
      withSwaggerHeader: false,
    });
    console.log(formatResult("without x-swagger    ", withoutSwagger));

    if (withSwagger.ok || withoutSwagger.ok) anyAuthSuccess = true;
    console.log("");
  }

  if (!anyAuthSuccess) {
    console.error("No endpoint returned a 2xx. Either the key is invalid,");
    console.error("the bearer-auth path isn't enabled for this account, or");
    console.error("the portal moved. Check FINDINGS.md notes.");
    process.exit(1);
  }

  console.log("Done. Capture observations in FINDINGS.md.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
