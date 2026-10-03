/**
 * EYG — UI COMPATIBILITY ADAPTER
 * ============================================================================
 * `frontend-core` owns the design system in `src/components/ui/*`. When these
 * pages were written only `Badge`, `Divider`, `JsonLd`, `Skeleton` and `Spinner`
 * existed, so the primitives below were re-implemented locally. The real
 * components have since landed, and this file is now a **thin adapter** over
 * them: every style, focus ring, ARIA attribute and token comes from the real
 * component. Only the *call signature* is adapted, so the ~25 call sites in
 * `src/app/{services,book,deals,contact,gallery,about,privacy,terms}` and
 * `src/components/pages/**` did not have to be rewritten.
 *
 * ── HOW TO SWAP (one find-and-replace per row, then delete this file) ──────
 *   shim adapter                → real component
 *   ----------------------------------------------------------------------
 *   Button                       → @/components/ui/Button
 *                                  variant map: cta→accent, secondary→outline,
 *                                  quiet→ghost  (swap to `variant="accent"` etc.)
 *   ButtonLink                   → @/components/ui/Button  (export `LinkButton`)
 *   Card / CardHeader / CardContent / CardFooter → @/components/ui/Card
 *   CardTitle (level prop)       → @/components/ui/Card    (uses `as` not `level`)
 *   Alert (tone "neutral", live) → @/components/ui/Alert   (tones: info/success/
 *                                  warning/danger; role + aria-live instead of live)
 *   Container                    → @/components/ui/Container
 *   Section (space / raised)     → @/components/ui/Section  (uses `spacing`; tone
 *                                  `raised` → `muted`; `contained` is forced false
 *                                  because every call site nests its own Container)
 *   PriceTag                     → @/components/ui/PriceTag
 *   Field (htmlFor / hint)       → @/components/ui/Field    (uses `id` / `helper`)
 *   Input / Textarea (invalid)   → @/components/ui/Input    (`aria-invalid`)
 *   Checkbox (label + desc)      → @/components/ui/Checkbox (bare control; this
 *                                  adapter owns the label/description shell)
 *   EmptyState (body / look)     → @/components/ui/EmptyState (`description`)
 *   Eyebrow                      → @/components/layout/SectionHeading (`eyebrow`)
 *                                  or a new `ui/Eyebrow`
 *   describedBy                  → no replacement needed; `Field` now injects
 *                                  `aria-describedby` into its child automatically
 * ============================================================================
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button as UiButton, LinkButton, type ButtonProps as UiButtonProps, type LinkButtonProps as UiLinkButtonProps } from "@/components/ui/Button";
import {
  Card as UiCard,
  CardContent as UiCardContent,
  CardFooter as UiCardFooter,
  CardHeader as UiCardHeader,
  CardTitle as UiCardTitle,
  type CardProps as UiCardProps,
} from "@/components/ui/Card";
import { Alert as UiAlert, type AlertProps as UiAlertProps } from "@/components/ui/Alert";
import { Container as UiContainer, type ContainerProps as UiContainerProps } from "@/components/ui/Container";
import { Section as UiSection, type SectionProps as UiSectionProps } from "@/components/ui/Section";
import { PriceTag as UiPriceTag, type PriceTagProps as UiPriceTagProps } from "@/components/ui/PriceTag";
import { Field as UiField, type FieldProps as UiFieldProps } from "@/components/ui/Field";
import { Input as UiInput, Textarea as UiTextarea, type InputProps as UiInputProps, type TextareaProps as UiTextareaProps } from "@/components/ui/Input";
import { Checkbox as UiCheckbox, type CheckboxProps as UiCheckboxProps } from "@/components/ui/Checkbox";
import { EmptyState as UiEmptyState, type EmptyStateProps as UiEmptyStateProps } from "@/components/ui/EmptyState";

// ── Button ──────────────────────────────────────────────────────────────────

/** Page-facing variant names. Mapped to the real `Button` variants below. */
export type ButtonVariant =
  | "cta"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "quiet";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANT_MAP: Record<ButtonVariant, NonNullable<UiButtonProps["variant"]>> = {
  // `accent` is the brand-yellow action button with the 3D press shadow.
  cta: "accent",
  primary: "primary",
  secondary: "outline",
  outline: "outline",
  ghost: "ghost",
  danger: "danger",
  quiet: "ghost",
};

export interface ButtonProps extends Omit<UiButtonProps, "variant"> {
  variant?: ButtonVariant;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <UiButton
      variant={VARIANT_MAP[variant]}
      loading={loading}
      disabled={disabled}
      {...props}
    />
  );
}

export interface ButtonLinkProps extends Omit<UiLinkButtonProps, "variant"> {
  variant?: ButtonVariant;
}

export function ButtonLink({
  variant = "primary",
  ...props
}: ButtonLinkProps): React.ReactElement {
  return <LinkButton variant={VARIANT_MAP[variant]} {...props} />;
}

export { buttonVariants } from "@/components/ui/Button";

// ── Card ────────────────────────────────────────────────────────────────────

export type CardProps = UiCardProps;

/** `padding` defaults to `none` because the Header/Content/Footer own the inset. */
export function Card({ padding = "none", ...props }: CardProps): React.ReactElement {
  return <UiCard padding={padding} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">): React.ReactElement {
  return <UiCardHeader className={cn("p-5 pb-0 sm:p-6 sm:pb-0", className)} {...props} />;
}

export function CardTitle({
  className,
  level = 3,
  ...props
}: Omit<React.ComponentPropsWithoutRef<"h3">, "as"> & {
  level?: 2 | 3 | 4;
}): React.ReactElement {
  return <UiCardTitle as={`h${level}`} className={className} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">): React.ReactElement {
  return <UiCardContent className={cn("space-y-4 p-5 sm:p-6", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">): React.ReactElement {
  return <UiCardFooter className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}

// ── Alert ───────────────────────────────────────────────────────────────────

export interface AlertProps extends Omit<UiAlertProps, "tone" | "role"> {
  /** `neutral` maps to the real `info` tone. */
  tone?: UiAlertProps["tone"] | "neutral";
  /** Announce politely once the state appears (async results). */
  live?: boolean;
  /** Override the live-region role. */
  role?: "status" | "alert" | "note";
}

export function Alert({
  tone = "info",
  live = false,
  role,
  className,
  ...props
}: AlertProps): React.ReactElement {
  const resolved = tone === "neutral" ? "info" : tone;
  const isUrgent = resolved === "danger" || resolved === "warning";
  const resolvedRole: "status" | "alert" | undefined =
    role === "note" ? undefined : (role ?? (live && !isUrgent ? "status" : undefined));
  return (
    <UiAlert
      tone={resolved}
      role={resolvedRole}
      aria-live={live && !isUrgent ? "polite" : undefined}
      className={cn(isUrgent ? "border-2" : undefined, className)}
      {...props}
    />
  );
}

// ── Container ───────────────────────────────────────────────────────────────

export type ContainerProps = Omit<UiContainerProps, "size"> & {
  size?: "page" | "prose" | "narrow" | "full";
};

export function Container({
  size = "page",
  className,
  ...props
}: ContainerProps): React.ReactElement {
  return (
    <UiContainer
      size={size === "narrow" ? "prose" : size}
      className={className}
      {...props}
    />
  );
}

// ── Section ─────────────────────────────────────────────────────────────────

export type SectionProps = Omit<UiSectionProps, "spacing" | "tone" | "contained"> & {
  space?: "sm" | "md" | "lg";
  /** `raised` is the real `muted` tone; kept for readability at call sites. */
  tone?: UiSectionProps["tone"] | "raised";
};

/**
 * `contained` is forced to `false` because every call site on these pages nests
 * its own `<Container>` — most of them a two-column grid the real `Container`
 * could not wrap. The real `Section` still owns the `<section>` landmark, the
 * `aria-labelledby` and the tone/spacing scale.
 */
export function Section({
  space = "md",
  tone = "default",
  className,
  ...props
}: SectionProps): React.ReactElement {
  return (
    <UiSection
      spacing={space}
      tone={tone === "raised" ? "muted" : tone}
      contained={false}
      className={className}
      {...props}
    />
  );
}

// ── Eyebrow ─────────────────────────────────────────────────────────────────

export interface EyebrowProps extends React.ComponentPropsWithoutRef<"p"> {
  as?: "p" | "span" | "div";
}

/**
 * The small uppercase kicker. Uses the `.eyg-eyebrow` brand utility from
 * `globals.css`. There is no standalone `ui/Eyebrow` yet — it is the `eyebrow`
 * slot on `@/components/ui/SectionHeading`, or a new primitive.
 */
export function Eyebrow({
  as: As = "p",
  className,
  children,
  ...props
}: EyebrowProps): React.ReactElement {
  return (
    <As className={cn("eyg-eyebrow text-brand-500", className)} {...props}>
      {children}
    </As>
  );
}

// ── PriceTag ────────────────────────────────────────────────────────────────

export interface PriceTagProps {
  priceMin: number | null;
  priceMax: number | null;
  note?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Ignored — the real component owns the accessible label. */
  label?: string | null;
  className?: string;
}

/**
 * The only way a peso figure reaches the DOM. Unknowable prices render as
 * "Ask us" — never a dash, never a zero, never a made-up number. A range is
 * flagged `approximate` so the figure is never presented as a final price.
 */
export function PriceTag({
  priceMin,
  priceMax,
  note,
  size = "md",
  className,
}: PriceTagProps): React.ReactElement {
  const isRange = priceMin !== null && priceMax !== null && priceMax !== priceMin;
  const props: UiPriceTagProps = {
    priceMin,
    priceMax,
    size,
    tone: priceMin === null ? "muted" : "accent",
    approximate: isRange,
  };
  if (note) props.note = note;
  return <UiPriceTag {...props} className={className} />;
}

// ── Form controls ───────────────────────────────────────────────────────────

export interface FieldProps
  extends Omit<UiFieldProps, "id" | "helper" | "error" | "children"> {
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | undefined;
  children: React.ReactNode;
}

/**
 * Thin rename of the real `Field`, plus the "(optional)" affordance the real
 * component does not render. The real component injects `id`,
 * `aria-describedby`, `aria-invalid` and `aria-required` into its single child,
 * so call sites no longer need the `describedBy()` helper.
 */
export function Field({
  htmlFor,
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps): React.ReactElement {
  return (
    <UiField
      id={htmlFor}
      label={
        required ? (
          label
        ) : (
          <>
            {label}
            <span className="ml-1.5 text-xs font-normal normal-case tracking-normal text-muted-foreground">
              (optional)
            </span>
          </>
        )
      }
      {...(hint !== undefined ? { helper: hint } : {})}
      {...(error !== undefined ? { error } : {})}
      required={required}
      className={className}
    >
      {children}
    </UiField>
  );
}

export interface InputProps extends Omit<UiInputProps, "size"> {
  invalid?: boolean;
}

export function Input({ invalid, ...props }: InputProps): React.ReactElement {
  return <UiInput {...(invalid ? { "aria-invalid": true } : {})} {...props} />;
}

export interface TextareaProps extends Omit<UiTextareaProps, "size"> {
  invalid?: boolean;
}

export function Textarea({ invalid, ...props }: TextareaProps): React.ReactElement {
  return <UiTextarea {...(invalid ? { "aria-invalid": true } : {})} {...props} />;
}

export interface CheckboxProps extends Omit<UiCheckboxProps, "id"> {
  /** The real `Checkbox` is a bare control; this adapter owns the label shell. */
  label: React.ReactNode;
  description?: React.ReactNode;
  invalid?: boolean;
  id?: string;
}

/**
 * A real `<input type="checkbox">` with a 44px hit area and a visible label.
 * The consent copy on `/book` is written out in full inside `label` /
 * `description` — never truncated to "I agree".
 */
export function Checkbox({
  className,
  label,
  description,
  invalid,
  id,
  name,
  ...props
}: CheckboxProps): React.ReactElement {
  const controlId = id ?? (typeof name === "string" ? `chk-${name}` : "chk");
  return (
    <div className={cn("flex gap-3", className)}>
      <UiCheckbox
        id={controlId}
        name={name}
        className="mt-0.5 size-6"
        {...(invalid ? { "aria-invalid": true } : {})}
        {...(description ? { "aria-describedby": `${controlId}-description` } : {})}
        {...props}
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={controlId} className="block cursor-pointer text-sm font-bold text-foreground">
          {label}
        </label>
        {description ? (
          <p id={`${controlId}-description`} className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Kept for call sites that still compute it; the real `Field` injects it now. */
export function describedBy(
  id: string,
  opts: { hint?: boolean; error?: boolean } = {},
): string | undefined {
  const parts: string[] = [];
  if (opts.hint) parts.push(`${id}-helper`);
  if (opts.error) parts.push(`${id}-error`);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

// ── EmptyState ──────────────────────────────────────────────────────────────

export interface EmptyStateProps
  extends Omit<UiEmptyStateProps, "description"> {
  /** Renamed to `description` on the real component. Must be INLINE text — the
   *  real component renders it inside a `<p>`, so block children are invalid. */
  body?: React.ReactNode;
  className?: string;
}

/** Never ship whitespace. Every empty region gets one of these. */
export function EmptyState({ body, className, ...props }: EmptyStateProps): React.ReactElement {
  return (
    <UiEmptyState
      className={cn("items-start text-left", className)}
      {...(body !== undefined ? { description: body } : {})}
      {...props}
    />
  );
}

// ── Exported for call sites that need the cva helpers ──────────────────────

export { cardVariants } from "@/components/ui/Card";
export { alertVariants } from "@/components/ui/Alert";
export { sectionVariants } from "@/components/ui/Section";
export { containerVariants } from "@/components/ui/Container";
export { cva };
export type { VariantProps };
