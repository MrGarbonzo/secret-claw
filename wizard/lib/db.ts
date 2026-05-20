/**
 * In-memory deployment record store.
 *
 * Chunk 3 placeholder — Chunk 4 swaps this for Supabase without
 * touching the consumers (route handlers and the agent detail page).
 * The Db interface is the swap point.
 *
 * Caveats:
 * - State is lost on dev-server restart and on Vercel cold-start.
 * - Not safe across multiple processes / serverless invocations on
 *   production runtimes — single-process dev only.
 */

import type { DeploymentRecord } from "./types";

export interface Db {
  insert(record: DeploymentRecord): Promise<void>;
  update(id: string, patch: Partial<DeploymentRecord>): Promise<void>;
  get(id: string): Promise<DeploymentRecord | null>;
}

declare global {
  // eslint-disable-next-line no-var
  var __secretClawDb: Map<string, DeploymentRecord> | undefined;
}

function store(): Map<string, DeploymentRecord> {
  if (!globalThis.__secretClawDb) {
    globalThis.__secretClawDb = new Map<string, DeploymentRecord>();
  }
  return globalThis.__secretClawDb;
}

class InMemoryDb implements Db {
  async insert(record: DeploymentRecord): Promise<void> {
    store().set(record.deployment_id, record);
  }

  async update(id: string, patch: Partial<DeploymentRecord>): Promise<void> {
    const current = store().get(id);
    if (!current) {
      throw new Error(`db.update: deployment ${id} not found`);
    }
    store().set(id, { ...current, ...patch });
  }

  async get(id: string): Promise<DeploymentRecord | null> {
    return store().get(id) ?? null;
  }
}

export const db: Db = new InMemoryDb();
