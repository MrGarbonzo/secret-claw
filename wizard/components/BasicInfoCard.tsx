interface InfoRow {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

interface BasicInfoCardProps {
  title?: string;
  rows: InfoRow[];
  className?: string;
}

export function BasicInfoCard({ title, rows, className }: BasicInfoCardProps) {
  return (
    <div className={`rounded-lg border border-portal-border bg-portal-surface p-5 ${className || ""}`}>
      {title ? (
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-portal-muted">{title}</h3>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <dt className="text-[11px] uppercase tracking-wider text-portal-muted">{row.label}</dt>
            <dd className={`break-all text-sm text-portal-text ${row.mono ? "font-mono" : ""}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
