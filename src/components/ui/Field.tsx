"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Textarea, type InputProps, type TextareaProps } from "./Input";

export interface FieldRenderProps {
  /** Wire this to the control's `id`. */
  id: string;
  /** Wire this to the control's `aria-describedby`. */
  describedBy: string | undefined;
  /** Wire this to the control's `aria-invalid`. */
  invalid: boolean | undefined;
  /** Wire this to the control's `aria-required`. */
  required: boolean | undefined;
}

export interface FieldProps {
  /** Explicit id. One is generated when omitted. */
  id?: string;
  label: React.ReactNode;
  /** Helper text under the control. Hidden from AT when an error replaces it. */
  helper?: React.ReactNode;
  /** Validation message. Presence switches the control to `aria-invalid`. */
  error?: string;
  required?: boolean;
  /** Hides the visible label but keeps it for screen readers. */
  hideLabel?: boolean;
  className?: string;
  labelClassName?: string;
  /**
   * The control. Either a single element (its `id` / `aria-*` are injected
   * automatically) or a render function receiving the wiring props.
   */
  children: React.ReactNode | ((props: FieldRenderProps) => React.ReactNode);
}

type ControlProps = React.ReactElement<Record<string, unknown>>;

function injectControl(node: React.ReactNode, props: Record<string, unknown>): React.ReactNode {
  if (React.isValidElement(node)) {
    return React.cloneElement(node as unknown as ControlProps, props);
  }
  return node;
}

/**
 * Label + helper + error with the accessibility wiring done once.
 *
 * Because it injects `id` / `aria-describedby` / `aria-invalid` into its single
 * element child, a form can never ship a label that points at nothing.
 */
export function Field({
  id,
  label,
  helper,
  error,
  required,
  hideLabel,
  className,
  labelClassName,
  children,
}: FieldProps): React.ReactElement {
  const generated = React.useId();
  const controlId = id ?? `field-${generated}`;
  const helperId = `${controlId}-helper`;
  const errorId = `${controlId}-error`;

  const hasError = Boolean(error);
  const describedBy = hasError ? errorId : helper ? helperId : undefined;

  const wiring: FieldRenderProps = {
    id: controlId,
    describedBy,
    invalid: hasError ? true : undefined,
    required: required || undefined,
  };

  const injectProps: Record<string, unknown> = {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": hasError ? true : undefined,
    "aria-required": required || undefined,
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={controlId}
        className={cn(
          "eyg-eyebrow text-foreground",
          hideLabel && "sr-only",
          labelClassName,
        )}
      >
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-1 text-destructive">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </label>

      {typeof children === "function" ? children(wiring) : injectControl(children, injectProps)}

      {hasError ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-semibold text-destructive"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : helper ? (
        <p id={helperId} className="text-sm text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

/** Alias kept for readability at call sites: `<FormField>` reads better. */
export const FormField = Field;

export interface TextFieldProps
  extends Omit<FieldProps, "children">,
    Omit<InputProps, "id" | "size" | "required"> {
  name: string;
  /** REQUIRED when there is no visible label. */
  "aria-label"?: string;
  required?: boolean;
  size?: InputProps["size"];
}

/** `<Field>` + `<Input>` pre-wired. The most common shape on this site. */
export function TextField({
  label,
  helper,
  error,
  required,
  ...input
}: TextFieldProps): React.ReactElement {
  const { id: inputId, name, size, ...rest } = input;
  return (
    <Field
      id={inputId}
      label={label}
      helper={helper}
      error={error}
      required={required}
      hideLabel={input["aria-label"] !== undefined}
    >
      {(wiring) => <Input name={name} size={size} {...wiring} {...rest} />}
    </Field>
  );
}

export interface TextAreaFieldProps
  extends Omit<FieldProps, "children">,
    Omit<TextareaProps, "id" | "size" | "required"> {
  name: string;
  "aria-label"?: string;
  required?: boolean;
  size?: TextareaProps["size"];
}

/** `<Field>` + `<Textarea>` pre-wired. */
export function TextAreaField({
  label,
  helper,
  error,
  required,
  ...textarea
}: TextAreaFieldProps): React.ReactElement {
  const { id: textareaId, name, size, ...rest } = textarea;
  return (
    <Field
      id={textareaId}
      label={label}
      helper={helper}
      error={error}
      required={required}
      hideLabel={textarea["aria-label"] !== undefined}
    >
      {(wiring) => <Textarea name={name} size={size} {...wiring} {...rest} />}
    </Field>
  );
}
