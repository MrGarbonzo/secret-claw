"use client";

import { useEffect, useState } from "react";
import { SecondaryButton } from "./SecondaryButton";

interface LogsViewerProps {
  deploymentId: string;
  vmHostname?: string;
  status: string;
}

export function LogsViewer({ deploymentId, vmHostname, status }: LogsViewerProps) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchLogs() {
    if (status !== "ready" || !vmHostname) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/logs/${encodeURIComponent(deploymentId)}`);
      if (!res.ok) {
        setError(`Logs unavailable (${res.status})`);
        setLines(null);
        return;
      }
      const body = (await res.json()) as { lines?: string[]; error?: string };
      if (body.lines) {
        setLines(body.lines);
      } else {
        setError(body.error || "Logs unavailable");
      }
    } catch {
      setError("Logs unavailable (network error)");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId, vmHostname, status]);

  if (status !== "ready") {
    return (
      <div className="rounded-lg border border-portal-border bg-portal-surface p-6 text-sm text-portal-muted">
        Logs will appear after the agent boots.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-portal-border bg-portal-surface">
      <div className="flex items-center justify-between border-b border-portal-border px-4 py-2">
        <span className="text-xs text-portal-muted">Last 200 lines</span>
        <SecondaryButton onClick={fetchLogs} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </SecondaryButton>
      </div>
      <div className="max-h-[480px] overflow-auto bg-portal-bg px-4 py-3 font-mono text-[11px] leading-relaxed text-portal-text">
        {error ? (
          <span className="text-portal-red">{error}</span>
        ) : lines === null ? (
          <span className="text-portal-muted">Loading…</span>
        ) : lines.length === 0 ? (
          <span className="text-portal-muted">No logs yet.</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-words">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
