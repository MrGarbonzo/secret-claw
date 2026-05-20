export function SecondaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-portal-border bg-portal-surface px-3 py-1 text-xs font-medium text-portal-text transition-colors hover:border-portal-borderStrong hover:bg-portal-surface2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}
