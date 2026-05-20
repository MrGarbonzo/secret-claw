export type StatusKind =
  | "idle"
  | "validating"
  | "valid"
  | "invalid"
  | "submitted"
  | "provisioning"
  | "ready"
  | "failed";

interface StatusPillProps {
  kind: StatusKind;
  label?: string;
  className?: string;
}

const PRESET: Record<StatusKind, { dot: string; bg: string; text: string; label: string }> = {
  idle: {
    dot: "bg-portal-mutedDim",
    bg: "bg-portal-surface2",
    text: "text-portal-muted",
    label: "Idle",
  },
  validating: {
    dot: "bg-portal-amber animate-pulse",
    bg: "bg-portal-amber/10",
    text: "text-portal-amber",
    label: "Validating…",
  },
  valid: {
    dot: "bg-portal-green",
    bg: "bg-portal-green/10",
    text: "text-portal-green",
    label: "Valid",
  },
  invalid: {
    dot: "bg-portal-red",
    bg: "bg-portal-red/10",
    text: "text-portal-red",
    label: "Invalid",
  },
  submitted: {
    dot: "bg-portal-amber",
    bg: "bg-portal-amber/10",
    text: "text-portal-amber",
    label: "Submitted",
  },
  provisioning: {
    dot: "bg-portal-amber animate-pulse",
    bg: "bg-portal-amber/10",
    text: "text-portal-amber",
    label: "Provisioning",
  },
  ready: {
    dot: "bg-portal-green",
    bg: "bg-portal-green/10",
    text: "text-portal-green",
    label: "Running",
  },
  failed: {
    dot: "bg-portal-red",
    bg: "bg-portal-red/10",
    text: "text-portal-red",
    label: "Failed",
  },
};

export function StatusPill({ kind, label, className }: StatusPillProps) {
  const preset = PRESET[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${preset.bg} ${preset.text} ${className || ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${preset.dot}`} />
      {label || preset.label}
    </span>
  );
}
