import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { focusRing, inputClass } from "./styles";

export { focusRing, inputClass };

type FieldProps = {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Field({ label, error, hint, children, className = "" }: FieldProps) {
  return (
    <label className={`block space-y-2 text-sm font-medium text-slate-200 ${className}`}>
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {hint && <span className="font-data text-[11px] text-slate-500">{hint}</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="block font-data text-xs text-red-300">
          {error}
        </span>
      )}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ invalid, className = "", ...props }: InputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={`${inputClass} ${invalid ? "border-red-400/60 focus:border-red-400 focus:ring-red-400/10" : ""} ${className}`}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ invalid, className = "", ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={`${inputClass} min-h-24 resize-y ${invalid ? "border-red-400/60 focus:border-red-400 focus:ring-red-400/10" : ""} ${className}`}
    />
  );
}
