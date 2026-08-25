"use client";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Premium form primitives - white surface, near-black ink, refined motion.   */
/* -------------------------------------------------------------------------- */

const baseField =
  "w-full rounded-xl2 border border-line bg-white px-4 py-3.5 text-[15px] text-ink " +
  "placeholder:text-ink-subtle transition-all duration-200 " +
  "hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

type LabelProps = { htmlFor?: string; required?: boolean; children: ReactNode; hint?: string };

export function Label({ htmlFor, required, children, hint }: LabelProps) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium tracking-tight text-ink"
      >
        {children}
        {required && <span aria-hidden className="ml-1 text-ink-subtle">*</span>}
      </label>
      {hint && <span className="text-[12px] text-ink-subtle">{hint}</span>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(baseField, className)} {...rest} />;
  }
);

/**
 * Password field with a reveal toggle. Behaves exactly like `Input` — the
 * caller doesn't pass `type`; we flip between "password" and "text" from the
 * eye button. Use this everywhere a password is typed so the toggle stays
 * consistent across sign-in and user management.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function PasswordInput({ className, ...rest }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(baseField, "pr-11", className)}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Keep it out of the tab order so Tab still goes straight from the
        // password field to the submit button.
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-3 flex items-center text-ink-subtle transition-colors hover:text-ink"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(baseField, "min-h-[120px] resize-y leading-relaxed", className)}
        {...rest}
      />
    );
  }
);

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: readonly string[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder = "Select…", className, value, defaultValue, ...rest },
  ref
) {
  // A <select> can't be both controlled (`value=`) and uncontrolled (`defaultValue=`).
  // We support both styles by only applying one prop based on what the parent passed.
  const isControlled = value !== undefined;
  const controlProps = isControlled
    ? { value }
    : { defaultValue: defaultValue ?? "" };

  // When used as a filter, allow the empty-value option to be re-selectable
  // (i.e. "no filter"). When used in the ticket form, the empty option is
  // disabled so customers must pick a real value.
  const allowEmpty = isControlled;

  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          baseField,
          "appearance-none pr-10 bg-white",
          // Ensure native option look stays clean
          className
        )}
        {...controlProps}
        {...rest}
      >
        <option value="" disabled={!allowEmpty}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
        width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-[12.5px] text-accent-danger animate-fade-in">{message}</p>
  );
}

export function FieldGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-1", className)}>{children}</div>;
}
