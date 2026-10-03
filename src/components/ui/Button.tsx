import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

/**
 * Button.
 *
 * `primary` uses the semantic `primary` / `primary-foreground` token pair, which
 * globals.css inverts per theme (ink in light, brand yellow in dark) so the
 * control always has AA contrast. `accent` is the brand-yellow action button
 * with the 3D press shadow.
 */
export const buttonVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-eyebrow",
    "font-sans font-bold transition-[background-color,color,border-color,box-shadow,transform]",
    "duration-150 ease-rapid",
    "disabled:pointer-events-none disabled:opacity-55",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-plate hover:bg-primary/90 active:translate-y-px",
        accent:
          "eyg-eyebrow bg-accent text-accent-foreground shadow-cta hover:bg-brand-400 hover:shadow-cta-hover active:translate-y-1",
        outline:
          "eyg-eyebrow border border-ink-400 text-foreground hover:border-foreground hover:bg-surface-muted active:translate-y-px",
        ghost:
          "eyg-eyebrow text-foreground hover:bg-surface-muted active:translate-y-px",
        danger:
          "eyg-eyebrow bg-destructive text-destructive-foreground shadow-plate hover:bg-destructive/90 active:translate-y-px",
        link: "h-auto rounded-eyebrow p-0 font-semibold text-foreground underline decoration-2 underline-offset-4 hover:decoration-brand-500 hover:decoration-4",
      },
      size: {
        sm: "h-10 px-3.5",
        md: "h-11 px-4",
        lg: "h-12 px-6 text-sm",
        xl: "h-14 px-8 text-base",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "link", size: "sm", class: "h-auto text-sm" },
      { variant: "link", size: "md", class: "h-auto text-base" },
      { variant: "link", size: "lg", class: "h-auto text-lg" },
      { variant: "link", size: "xl", class: "h-auto text-xl" },
    ],
    defaultVariants: { variant: "primary", size: "md", fullWidth: false },
  },
);

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof buttonVariants> {
  /** Render the styles onto the single child element (Radix `Slot`). */
  asChild?: boolean;
  /** Shows a spinner, sets `aria-busy` and blocks interaction. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, asChild = false, loading = false, disabled, children, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...(asChild ? {} : { disabled: disabled || loading, "aria-busy": loading || undefined })}
      {...props}
    >
      {/*
        Radix `Slot` requires EXACTLY ONE child. Rendering `{null}{children}`
        would make `React.Children.count` see two and throw
        "Slot failed to slot onto its children", so the spinner is
        button-mode only. An `asChild` caller that wants a busy state should put
        it on the child element it is slotting onto.
      */}
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner size="sm" /> : null}
          {children}
        </>
      )}
    </Comp>
  );
});

export interface LinkButtonProps
  extends React.ComponentPropsWithoutRef<typeof Link>,
    VariantProps<typeof buttonVariants> {
  /** Internal (`/book`) or external (`https://…`) href. */
  href: string;
  /** Marks `target="_blank"` links and adds the screen-reader hint. */
  external?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

/** Same variants as <Button>, rendered as a real `<a>`. Never a dead `#`. */
export const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
  { className, variant, size, fullWidth, href, external, leadingIcon, trailingIcon, children, ...props },
  ref,
) {
  // `tel:` / `mailto:` are external destinations but must NOT open a new tab —
  // a phone app cannot. Only real web URLs get `target="_blank"`.
  const isWebUrl = /^(https?:)?\/\//i.test(href);
  const openInNewTab = external ?? isWebUrl;
  return (
    <Link
      ref={ref}
      href={href}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...(openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
      {openInNewTab ? <span className="sr-only">(opens in a new tab)</span> : null}
    </Link>
  );
});
