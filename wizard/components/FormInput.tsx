import { forwardRef } from "react";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  monospace?: boolean;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput({ invalid, monospace, className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        className={`block w-full rounded-md border bg-portal-bg px-3 py-2 text-sm text-portal-text placeholder:text-portal-mutedDim focus:outline-none focus:ring-2 focus:ring-portal-accent ${invalid ? "border-portal-red" : "border-portal-border focus:border-portal-borderStrong"} ${monospace ? "font-mono" : ""} ${className || ""}`}
        {...rest}
      />
    );
  },
);
