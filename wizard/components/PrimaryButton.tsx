interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function PrimaryButton({ loading, children, className, disabled, ...rest }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md bg-portal-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-portal-accentHover disabled:bg-portal-accent/50 disabled:cursor-not-allowed ${className || ""}`}
      {...rest}
    >
      {loading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
      {children}
    </button>
  );
}
