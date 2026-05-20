interface SelectionCardProps {
  title: string;
  description: string;
  selected?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

export function SelectionCard({
  title,
  description,
  selected,
  disabled,
  badge,
  onClick,
  className,
  icon,
}: SelectionCardProps) {
  const base =
    "relative flex flex-col items-start gap-2 rounded-lg border p-5 text-left transition-colors";
  const stateClasses = disabled
    ? "cursor-not-allowed border-portal-border bg-portal-surface/40 opacity-50"
    : selected
      ? "cursor-pointer border-portal-accent bg-portal-surface2 ring-1 ring-portal-accent"
      : "cursor-pointer border-portal-border bg-portal-surface hover:border-portal-borderStrong";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${stateClasses} ${className || ""}`}
    >
      {badge ? (
        <span className="absolute right-3 top-3 rounded-full bg-portal-surface2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-portal-muted">
          {badge}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-portal-text">{title}</span>
      </div>
      <span className="text-xs leading-relaxed text-portal-muted">{description}</span>
    </button>
  );
}
