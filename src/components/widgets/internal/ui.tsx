/**
 * INTERNAL WIDGET PRIMITIVES
 * ============================================================================
 * Owned by the *widgets* agent.
 *
 * WHY THIS EXISTS
 *  `src/components/ui/**` belongs to frontend-core and may not exist yet, so the
 *  widgets would be unbuildable without it. These primitives are deliberately
 *  tiny, token-only (no hardcoded hex) and unopinionated, and every one of them
 *  can be swapped for the shared `ui/` primitives once they land — the widget
 *  API does not change.
 *
 *  If `src/components/ui/index.ts` exists at build time, the widgets still use
 *  these. Keeping the widgets self-contained is what makes them droppable into
 *  the homepage, `/book` or any future page without dependency churn.
 * ============================================================================
 */
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

// ── Surfaces ────────────────────────────────────────────────────────────────

type SurfaceTag = "div" | "section" | "article" | "li" | "aside";

export function WidgetCard({
  className,
  as: Tag = "div",
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: SurfaceTag }) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-border bg-surface p-4 shadow-plate sm:p-5",
        className,
      )}
      {...rest}
    />
  );
}

/** Small uppercase kicker above a heading. */
export function Eyebrow({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("eyg-eyebrow text-muted-foreground", className)} {...rest} />;
}

/** Pill. `tone` always pairs a colour with text, never colour alone. */
export function Pill({
  tone = "neutral",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "brand" | "success" | "danger" | "warning" | "info";
}) {
  const tones: Record<string, string> = {
    neutral: "border-border-strong bg-surface-muted text-muted-foreground",
    brand: "border-brand-300 bg-brand-50 text-brand-800",
    success: "border-pit-300 bg-pit-50 text-pit-800",
    danger: "border-racing-300 bg-racing-50 text-racing-800",
    warning: "border-brand-400 bg-brand-100 text-brand-900",
    info: "border-border-strong bg-surface-muted text-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-bold",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Stretches to the container width. */
  block?: boolean;
}

export function Button({
  variant = "primary",
  block = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-55";
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-brand-500 text-accent-foreground shadow-cta hover:bg-brand-400 hover:shadow-cta-hover active:translate-y-0.5 active:shadow-none",
    secondary:
      "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
    ghost: "text-foreground underline decoration-brand-400 decoration-2 underline-offset-4 hover:text-brand-700",
    danger: "border border-racing-400 bg-racing-50 text-racing-800 hover:bg-racing-100",
    link: "min-h-0 p-0 text-brand-700 underline underline-offset-4 hover:text-brand-800",
  };
  return (
    <button
      type={type}
      className={cn(base, variants[variant], block && "w-full", className)}
      {...rest}
    />
  );
}

/** Anchor styled like a button. Always a real `<a>`. */
export function ButtonLink({
  variant = "primary",
  block = false,
  className,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; block?: boolean }) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 py-2 text-sm font-bold transition-colors";
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-brand-500 text-accent-foreground shadow-cta hover:bg-brand-400 hover:shadow-cta-hover",
    secondary: "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
    ghost: "text-foreground underline decoration-brand-400 decoration-2 underline-offset-4",
    danger: "border border-racing-400 bg-racing-50 text-racing-800 hover:bg-racing-100",
    link: "min-h-0 p-0 text-brand-700 underline underline-offset-4",
  };
  return (
    <a className={cn(base, variants[variant], block && "w-full", className)} {...rest} />
  );
}

// ── Form fields ─────────────────────────────────────────────────────────────

export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  id,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  children: ReactNode;
  className?: string;
  /** Id of the element holding the error text, for `aria-describedby`. */
  id?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-bold text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-racing-700" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1 text-xs font-medium text-muted-foreground">(optional)</span>
        )}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p
          id={errorId ?? id}
          className="flex items-start gap-1.5 text-xs font-semibold text-racing-700"
        >
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export const controlClass =
  "w-full min-h-11 rounded-card border border-border-strong bg-surface px-3 py-2 text-base text-foreground placeholder:text-ink-300 focus:border-brand-500 disabled:opacity-60";

export const controlInvalidClass =
  "border-racing-500 bg-racing-50 focus:border-racing-600";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
}

export function TextField({
  label,
  hint,
  error,
  className,
  id,
  required,
  ...rest
}: TextFieldProps) {
  const fieldId = id ?? `f-${rest.name ?? label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <input
        id={fieldId}
        name={rest.name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
          .filter(Boolean)
          .join(" ")
          .trim() || undefined}
        className={cn(controlClass, error && controlInvalidClass)}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
}

export function SelectField({
  label,
  hint,
  error,
  className,
  id,
  required,
  children,
  ...rest
}: SelectFieldProps) {
  const fieldId = id ?? `s-${rest.name ?? label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <select
        id={fieldId}
        name={rest.name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
          .filter(Boolean)
          .join(" ")
          .trim() || undefined}
        className={cn(controlClass, "appearance-none pr-8", error && controlInvalidClass)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/** A 44×44 minimum tap target — the size a thumb on a ₱3,000 phone needs. */
export function TapTarget({
  as: Tag = "div",
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { as?: "div" | "span" }) {
  return <Tag className={cn("min-h-11 min-w-11", className)} {...rest} />;
}

// ── Feedback ────────────────────────────────────────────────────────────────

/** Shimmer placeholder. `aria-hidden`; the caller owns the live status. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-card bg-surface-muted", className)}
    />
  );
}

/**
 * A designed notice block. `tone` always carries an icon/glyph AND a word so the
 * message is never communicated by colour alone.
 */
export function Notice({
  tone = "info",
  title,
  children,
  className,
  actions,
  role,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
  role?: "status" | "alert";
}) {
  const map = {
    info: {
      wrap: "border-border-strong bg-surface-muted text-foreground",
      glyph: "ℹ️",
      word: "Note",
    },
    success: {
      wrap: "border-pit-300 bg-pit-50 text-pit-900",
      glyph: "✅",
      word: "Done",
    },
    warning: {
      wrap: "border-brand-400 bg-brand-50 text-brand-900",
      glyph: "⚠️",
      word: "Heads up",
    },
    danger: {
      wrap: "border-racing-400 bg-racing-50 text-racing-900",
      glyph: "⛔",
      word: "Problem",
    },
  } as const;
  const t = map[tone];
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cn("rounded-card border p-3 text-sm", t.wrap, className)}
    >
      <p className="flex items-center gap-2 font-bold">
        <span aria-hidden="true">{t.glyph}</span>
        <span className="sr-only">{t.word}: </span>
        <span>{title}</span>
      </p>
      {children ? <div className="mt-1.5 leading-relaxed">{children}</div> : null}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Visually hidden, still announced. Used for screen-reader-only live regions. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
      {children}
    </span>
  );
}

/** Five stars with a guaranteed text equivalent for assistive technology. */
export function Stars({
  value,
  max = 5,
  size = 16,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  const items = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 leading-none text-brand-500", className)}
      role="img"
      aria-label={`Rated ${rounded} out of ${max}`}
    >
      {items.map((i) => {
        const state = rounded >= i ? "full" : rounded >= i - 0.5 ? "half" : "empty";
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{ fontSize: size }}
            className={
              state === "empty"
                ? "text-ink-300"
                : state === "half"
                  ? "text-brand-400"
                  : "text-brand-500"
            }
          >
            {state === "full" ? "★" : state === "half" ? "★" : "☆"}
          </span>
        );
      })}
    </span>
  );
}

/** Section heading used across widgets. `id` becomes the aria-labelledby target. */
export function WidgetHeading({
  id,
  eyebrow,
  title,
  description,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="text-h3 text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}