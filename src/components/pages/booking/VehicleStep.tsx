/**
 * EYG — BOOKING STEP 1: VEHICLE
 * ============================================================================
 * The first question, and the one most likely to strand somebody: a customer who
 * does not know what car they own, or cannot read the model badge.
 *
 * THE ESCAPE HATCH IS MANDATORY. "I am not sure about my vehicle" switches the
 * step to a free-text description and carries that description all the way into
 * the booking `notes`. It is a first-class path, styled exactly like the known
 * vehicle path, and it can be undone. There is no state in this wizard where the
 * Next button is permanently disabled because the vehicle is unknown.
 * ============================================================================
 */

import { cn } from "@/lib/utils";
import { Field, Input, describedBy } from "@/components/pages/_shims";
import { HelpCircle, Info } from "@/components/pages/_icons";
import type { VehicleDraft } from "@/components/pages/booking/types";

export interface VehicleStepProps {
  value: VehicleDraft;
  onChange: (next: VehicleDraft) => void;
  /** Field-level messages from the API, keyed by field name. */
  fieldErrors: Record<string, string[]>;
  disabled: boolean;
}

/** Popular makes in the PH market, offered as a datalist — never a hard limit. */
const MAKE_SUGGESTIONS = [
  "Toyota", "Honda", "Mitsubishi", "Nissan", "Suzuki", "Hyundai",
  "Kia", "Mazda", "Ford", "Chevrolet", "Isuzu", "Geely", "Chery", "Changan",
];

export function VehicleStep({
  value,
  onChange,
  fieldErrors,
  disabled,
}: VehicleStepProps): React.ReactElement {
  const unknown = value.mode === "unknown";
  const set = <K extends keyof VehicleDraft>(key: K, v: VehicleDraft[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <fieldset disabled={disabled} className="space-y-6">
      <legend className="sr-only">Your vehicle</legend>

      {/* ── The fork ─────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          selected={!unknown}
          onSelect={() => set("mode", "known")}
          title="I know my vehicle"
          body="Year, make and model. That is all we need to start."
        />
        <ModeCard
          selected={unknown}
          onSelect={() => set("mode", "unknown")}
          title="I am not sure about my vehicle"
          body="Describe it in your own words — or leave this blank and we will identify it from the plate when you arrive."
        />
      </div>

      {unknown ? (
        <div className="space-y-4 rounded-panel border-2 border-brand-500 bg-brand-50 p-5 dark:bg-brand-900/25">
          <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
            <HelpCircle aria-hidden="true" className="size-4 text-brand-500" />
            That is completely fine — carry on and pick your slot
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A lot of customers are buying a used car, or driving a work vehicle they
            did not choose. Tell us anything you know and we will work it out:
          </p>
          <Field
            htmlFor="vehicle-free-text"
            label="Describe the vehicle however you can"
            hint="For example: &ldquo;Black Innova, 2019, bought second hand. Plate starts ABC&rdquo; — or just &ldquo;the white Fortuner my husband drives&rdquo;."
            error={fieldErrors["vehicle"]?.[0]}
          >
            <textarea
              id="vehicle-free-text"
              name="vehicleDescription"
              rows={4}
              value={value.freeText}
              onChange={(e) => set("freeText", e.target.value)}
              aria-describedby={describedBy("vehicle-free-text", { hint: true, error: Boolean(fieldErrors["vehicle"]) })}
              aria-invalid={fieldErrors["vehicle"] ? true : undefined}
              className="w-full min-h-28 rounded-card border-2 border-border-strong bg-surface px-3.5 py-2.5 text-base placeholder:text-muted-foreground focus-visible:border-brand-500 focus-visible:outline-none"
              placeholder="Black Innova, 2019, bought second hand"
            />
          </Field>
          <p className="flex gap-2 text-sm text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              A plate number is enough. If you can send a photo of the registration
              or the side of the car on WhatsApp when you confirm, we can have the
              right parts out before you arrive.
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[6rem_1fr_1fr]">
            <Field
              htmlFor="vehicle-year"
              label="Year"
              required
              error={fieldErrors["vehicle.year"]?.[0]}
            >
              <Input
                id="vehicle-year"
                name="year"
                type="text"
                inputMode="numeric"
                autoComplete="bday-year"
                placeholder="2019"
                value={value.year}
                onChange={(e) => set("year", e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                invalid={Boolean(fieldErrors["vehicle.year"])}
                aria-describedby={describedBy("vehicle-year", { error: Boolean(fieldErrors["vehicle.year"]) })}
                className="tabular"
              />
            </Field>

            <Field
              htmlFor="vehicle-make"
              label="Make"
              required
              hint="Toyota, Honda, Mitsubishi…"
              error={fieldErrors["vehicle.make"]?.[0]}
            >
              <Input
                id="vehicle-make"
                name="make"
                list="eyg-vehicle-makes"
                autoComplete="organization"
                value={value.make}
                onChange={(e) => set("make", e.target.value)}
                invalid={Boolean(fieldErrors["vehicle.make"])}
                aria-describedby={describedBy("vehicle-make", { hint: true, error: Boolean(fieldErrors["vehicle.make"]) })}
              />
              <datalist id="eyg-vehicle-makes">
                {MAKE_SUGGESTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>

            <Field
              htmlFor="vehicle-model"
              label="Model"
              required
              hint="Innova, Civic, Rush…"
              error={fieldErrors["vehicle.model"]?.[0]}
            >
              <Input
                id="vehicle-model"
                name="model"
                value={value.model}
                onChange={(e) => set("model", e.target.value)}
                invalid={Boolean(fieldErrors["vehicle.model"])}
                aria-describedby={describedBy("vehicle-model", { hint: true, error: Boolean(fieldErrors["vehicle.model"]) })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              htmlFor="vehicle-variant"
              label="Variant or engine"
              hint="Helps us get the right oil and filter. Leave it blank if you are not sure."
            >
              <Input
                id="vehicle-variant"
                name="variant"
                placeholder="1.5 G, or 2.0 diesel"
                value={value.variant}
                onChange={(e) => set("variant", e.target.value)}
                aria-describedby={describedBy("vehicle-variant", { hint: true })}
              />
            </Field>

            <Field
              htmlFor="vehicle-plate"
              label="Plate number"
              hint="If you know it. We use it to look up your service history when you arrive."
              error={fieldErrors["vehicle.plate"]?.[0]}
            >
              <Input
                id="vehicle-plate"
                name="plate"
                autoCapitalize="characters"
                placeholder="ABC 1234"
                value={value.plate}
                onChange={(e) => set("plate", e.target.value.toUpperCase())}
                invalid={Boolean(fieldErrors["vehicle.plate"])}
                aria-describedby={describedBy("vehicle-plate", { hint: true, error: Boolean(fieldErrors["vehicle.plate"]) })}
                className="tabular uppercase"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={() => set("mode", "unknown")}
            className="min-h-11 rounded-eyebrow text-sm font-bold text-brand-500 underline decoration-2 underline-offset-4"
          >
            I do not actually know the year or model
          </button>
        </div>
      )}
    </fieldset>
  );
}

function ModeCard({
  selected,
  onSelect,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-24 flex-col items-start gap-1.5 rounded-card border-2 p-4 text-left transition-colors",
        selected
          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/25"
          : "border-border-strong bg-surface hover:border-brand-500",
      )}
    >
      <span className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 items-center justify-center rounded-pill border-2",
            selected ? "border-brand-500 bg-brand-500" : "border-border-strong",
          )}
        >
          {selected ? <span className="size-1.5 rounded-pill bg-ink-950" /> : null}
        </span>
        {title}
      </span>
      <span className="text-sm leading-relaxed text-muted-foreground">{body}</span>
    </button>
  );
}

/** One-line summary for the order sidebar. */
export function vehicleSummaryOf(v: VehicleDraft): string {
  if (v.mode === "unknown") {
    return v.freeText.trim() || "Vehicle not identified yet — we will work it out on arrival";
  }
  const bits = [v.year, v.make, v.model, v.variant].map((p) => p.trim()).filter(Boolean);
  const head = bits.length > 0 ? bits.join(" ") : "No vehicle added yet";
  return v.plate.trim() ? `${head} · ${v.plate.trim().toUpperCase()}` : head;
}

/** Step-1 validation. Returns a message, or `null` when the step can advance. */
export function validateVehicleStep(v: VehicleDraft): string | null {
  if (v.mode === "unknown") {
    // Free text is welcome but not required — this path must never dead-end.
    return null;
  }
  if (!v.make.trim() || !v.model.trim()) return "Enter the make and model, or choose &ldquo;not sure&rdquo; above.";
  if (v.year.trim()) {
    const year = Number.parseInt(v.year, 10);
    const min = 1950;
    const max = new Date().getFullYear() + 1;
    if (!Number.isFinite(year) || year < min || year > max) {
      return `Enter a year between ${min} and ${max}, or leave it blank.`;
    }
  }
  return null;
}
