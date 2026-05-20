"use client";

import { useState } from "react";
import { SecondaryButton } from "./SecondaryButton";

interface GatewayTokenDisplayProps {
  token: string;
}

export function GatewayTokenDisplay({ token }: GatewayTokenDisplayProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available; ignore silently
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all rounded border border-portal-border bg-portal-bg px-3 py-2 font-mono text-xs text-portal-text">
          {revealed ? token : "•".repeat(Math.min(token.length, 40))}
        </code>
      </div>
      <div className="flex gap-2">
        <SecondaryButton onClick={() => setRevealed((r) => !r)}>
          {revealed ? "Hide" : "Reveal"}
        </SecondaryButton>
        <SecondaryButton onClick={copy}>{copied ? "Copied ✓" : "Copy"}</SecondaryButton>
      </div>
      <p className="text-[11px] text-portal-muted">
        This token grants access to your agent's web UI. Treat it like a password.
      </p>
    </div>
  );
}
