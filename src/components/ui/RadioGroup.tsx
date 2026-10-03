"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "./Checkbox";

export interface RadioOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Secondary line under the label. */
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string = string>
  extends Omit<React.ComponentPropsWithoutRef<"fieldset">, "onChange"> {
  name: string;
  /** Accessible name for the group. */
  legend: string;
  /** Visually hidden by default; pass `false` to show it. */
  hideLegend?: boolean;
  value?: T;
  defaultValue?: T;
  options: ReadonlyArray<RadioOption<T>>;
  onValueChange?: (value: T) => void;
  /** Horizontal layout instead of a stack. */
  orientation?: "vertical" | "horizontal";
  error?: string;
}

/**
 * A real `<fieldset>` of native radios. Native radios give arrow-key roving
 * focus, `name` grouping and form submission without any extra dependency.
 * The group is invalid as a whole when `error` is set, which is why the
 * error text is wired to the fieldset via `aria-describedby`.
 */
export function RadioGroup<T extends string = string>({
  name,
  legend,
  hideLegend = true,
  value,
  defaultValue,
  options,
  onValueChange,
  orientation = "vertical",
  error,
  className,
  ...props
}: RadioGroupProps<T>): React.ReactElement {
  const generated = React.useId();
  const groupId = `${name}-${generated}`;
  const errorId = `${groupId}-error`;

  return (
    <fieldset
      className={cn("min-w-0 border-0 p-0", className)}
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
      {...props}
    >
      <legend className={cn("eyg-eyebrow mb-2 text-foreground", hideLegend && "sr-only")}>
        {legend}
      </legend>
      <div
        className={cn(
          "flex gap-3",
          orientation === "vertical" ? "flex-col" : "flex-wrap items-center",
        )}
      >
        {options.map((option) => {
          const id = `${groupId}-${option.value}`;
          return (
            <div key={option.value} className="flex items-start gap-2.5">
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                disabled={option.disabled}
                checked={value === option.value}
                defaultChecked={value === undefined ? defaultValue === option.value : undefined}
                onChange={() => onValueChange?.(option.value)}
                className={cn(
                  "mt-0.5 size-5 shrink-0 appearance-none rounded-pill border border-ink-400 bg-surface",
                  "transition-colors duration-150 ease-rapid hover:border-foreground focus-visible:border-brand-500",
                  "checked:border-[6px] checked:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60",
                )}
              />
              <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
                <span className="font-semibold text-foreground">{option.label}</span>
                {option.description ? (
                  <span className="block text-muted-foreground">{option.description}</span>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Checkbox with a wrapped label — the common "consent" pattern. */
export interface CheckboxFieldProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Checkbox>, "id"> {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}

export function CheckboxField({
  id,
  label,
  description,
  className,
  ...props
}: CheckboxFieldProps): React.ReactElement {
  const describedBy = description ? `${id}-description` : undefined;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Checkbox id={id} aria-describedby={describedBy} className="mt-0.5" {...props} />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
        <span className="font-semibold text-foreground">{label}</span>
        {description ? (
          <span id={describedBy} className="block text-muted-foreground">
            {description}
          </span>
        ) : null}
      </label>
    </div>
  );
}
