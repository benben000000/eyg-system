import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Form control shell. `border-ink-400` is deliberate: it is the only neutral
 * token that clears 3:1 against BOTH the light background (white) and the dark
 * background (ink-950), so a control boundary never disappears in either theme.
 */
const controlBase = [
  "w-full rounded-eyebrow border border-ink-400 bg-surface px-3 text-foreground",
  "placeholder:text-muted-foreground",
  "transition-colors duration-150 ease-rapid",
  "hover:border-ink-300",
  "focus-visible:border-brand-500",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "aria-[invalid=true]:border-racing-500",
].join(" ");

export const inputVariants = cva(controlBase, {
  variants: {
    size: {
      sm: "h-10 text-sm",
      md: "h-11 text-base",
      lg: "h-12 text-base",
    },
  },
  defaultVariants: { size: "md" },
});

export interface InputProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "size">,
    VariantProps<typeof inputVariants> {
  /** Optional leading adornment (icon, ₱ prefix). Rendered `aria-hidden`. */
  leading?: React.ReactNode;
}

/** Text input / number / date / tel. Native element, fully keyboard operable. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size, leading, ...props },
  ref,
) {
  if (!leading) {
    return <input ref={ref} className={cn(inputVariants({ size }), className)} {...props} />;
  }
  return (
    <span className="relative block">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
      >
        {leading}
      </span>
      <input ref={ref} className={cn(inputVariants({ size }), "pl-9", className)} {...props} />
    </span>
  );
});

export const textareaVariants = cva(controlBase, {
  variants: {
    size: { sm: "text-sm", md: "text-base", lg: "text-base" },
    resize: { none: "resize-none", vertical: "resize-y", both: "resize" },
  },
  defaultVariants: { size: "md", resize: "vertical" },
});

export interface TextareaProps
  extends Omit<React.ComponentPropsWithoutRef<"textarea">, "size">,
    VariantProps<typeof textareaVariants> {}

/** Multi-line input. Vertical resize only — no horizontal overflow on mobile. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, size, resize, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(textareaVariants({ size, resize }), "py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
});

/** Native select. Deliberately native: no portal, works on a ₱3,000 Android. */
export interface NativeSelectProps
  extends Omit<React.ComponentPropsWithoutRef<"select">, "size"> {
  size?: "sm" | "md" | "lg";
  /** Options. `value: null` renders a disabled placeholder. */
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  wrapperClassName?: string;
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  function NativeSelect({ className, size = "md", options, placeholder, wrapperClassName, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(inputVariants({ size }), "pr-8", wrapperClassName ?? "", className)}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
);
