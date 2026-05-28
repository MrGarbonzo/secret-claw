#!/usr/bin/env node
/**
 * Copy canonical deploy templates into wizard/templates/<runtime>/<tier>/
 * so `lib/render.ts` can find them when the wizard runs on a platform whose
 * build context is wizard/-only (Vercel, Cloudflare Pages, etc.).
 *
 * Source: ../deploys/<runtime>/<tier>/templates/
 * Dest:   ./templates/<runtime>/<tier>/
 *
 * Runs as `prebuild` and `pretest` npm hooks. Behavior:
 *  - If a (runtime, tier) source exists, copy (overwrite) it. Local-dev
 *    and Vercel paths take this branch.
 *  - If source is missing but the dest is already populated (sentinel
 *    file present — openclaw.json for OpenClaw, config.yaml for Hermes),
 *    skip silently. Handles the Docker builder stage, where the
 *    Dockerfile pre-populates ./templates from the build context.
 *  - If neither exists for a required (runtime, tier), fail loudly.
 *    Optional combos skip with a warning so the repo builds before
 *    all four trees are populated.
 *
 * wizard/templates/ is .gitignored — it's a build artifact, not source.
 * deploys/<runtime>/<tier>/templates/ remains the canonical source of
 * truth.
 *
 * Layout (post-2026-05-27 restructure that added Hermes alongside OpenClaw):
 *   deploys/openclaw/byo/templates/      (canonical, required)
 *   deploys/openclaw/secret/templates/   (canonical, required)
 *   deploys/hermes/byo/templates/        (canonical, optional)
 *   deploys/hermes/secret/templates/     (canonical, optional)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const WIZARD_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEPLOYS_ROOT = path.resolve(WIZARD_ROOT, "..", "deploys");
const DEST_ROOT = path.resolve(WIZARD_ROOT, "templates");

/**
 * @type {{runtime: string, tier: string, required: boolean, sentinel: string}[]}
 *
 * `sentinel` is the file inside a populated dest that, when present, lets
 * us skip the copy step (the dest is already in place — e.g. inside a
 * Docker build stage where the Dockerfile pre-populated it).
 */
const COMBINATIONS = [
  { runtime: "openclaw", tier: "byo", required: true, sentinel: "openclaw.json" },
  { runtime: "openclaw", tier: "secret", required: true, sentinel: "openclaw.json" },
  { runtime: "hermes", tier: "byo", required: false, sentinel: "config.yaml" },
  { runtime: "hermes", tier: "secret", required: false, sentinel: "config.yaml" },
];

for (const { runtime, tier, required, sentinel } of COMBINATIONS) {
  const source = path.join(DEPLOYS_ROOT, runtime, tier, "templates");
  const dest = path.join(DEST_ROOT, runtime, tier);
  const label = `${runtime}/${tier}`;

  if (fs.existsSync(source)) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(source, dest, { recursive: true });
    console.log(`[copy-templates] ${label}: ${source} -> ${dest}`);
  } else if (fs.existsSync(path.join(dest, sentinel))) {
    console.log(`[copy-templates] ${label}: source missing, using pre-populated ${dest}`);
  } else if (required) {
    console.error(
      `[copy-templates] ERROR: required ${label} not found at ${source} or ${dest}`,
    );
    process.exit(1);
  } else {
    console.warn(
      `[copy-templates] WARN: optional ${label} not present at ${source}; skipping`,
    );
  }
}
