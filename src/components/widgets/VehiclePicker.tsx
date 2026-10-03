"use client";

/**
 * VEHICLE PICKER — step 1 of the booking flow.
 * ============================================================================
 * THE HARD RULE: never block the customer.
 *  - Year runs from 1950 to next year. Anything older is a classic, still fine.
 *  - Make and model are `Datalist`-backed, so a visitor can pick from the list
 *    OR simply type what they have. Typing is never rejected.
 *  - "Not listed / I'll describe it" reveals a free-text field and clears the
 *    make/model requirement entirely. A vehicle we do not have in a dropdown is
 *    not a reason to lose the booking.
 *  - If the customer has already typed a make/model that is not in the list, the
 *    "not listed" path is suggested automatically.
 *
 * Datalist values come from the caller (`makes` / `models`), so the catalogue
 * owner controls them. Nothing here is fetched.
 * ============================================================================
 */
import { useEffect, useId, useMemo, useRef } from "react";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SelectField,
  TextField,
  WidgetCard,
  controlClass,
  controlInvalidClass,
} from "@/components/widgets/internal/ui";
import { VEHICLE_YEAR_MAX, VEHICLE_YEAR_MIN, vehicleYears } from "@/hooks/useBooking";
import type { VehicleDraft } from "@/hooks/useBooking";

/**
 * Common makes in the Philippine market. NOT exhaustive and NOT enforced — the
 * input is `Datalist`-backed, so the customer can always type something else,
 * and the "Not listed" escape hatch covers everything this list misses.
 */
export const DEFAULT_MAKES: readonly string[] = Object.freeze([
  "Toyota",
  "Honda",
  "Nissan",
  "Mitsubishi",
  "Ford",
  "Suzuki",
  "Hyundai",
  "Kia",
  "Mazda",
  "Subaru",
  "Isuzu",
  "Chevrolet",
  "Great Wall",
  "Geely",
  "Changan",
  "Foton",
  "McArthur",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Land Rover",
  "Lexus",
]);

/** Models per make, best-effort. The customer can always type their own. */
export const DEFAULT_MODELS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  Toyota: [
    "Avanza",
    "Innova",
    "Hilux",
    "Fortuner",
    "Corolla",
    "Camry",
    "Vios",
    "Rush",
    "Prado",
    "Land Cruiser",
    "Etios",
    "Yaris",
  ],
  Honda: ["City", "Civic", "CR-V", "HR-V", "Fit", "Jazz", "Accord", "Pilot", "Ridgeline", "Beat"],
  Nissan: ["Urvan", "NV350", "Almera", "Sentra", "X-Trail", "Navara", "Patrol", "Leaf", "Kicks"],
  Mitsubishi: ["Advance", "Xpander", "Montero", "L300", "Mirage", "Outlander", "Pajero", "Lancer"],
  Ford: ["Ranger", "Everest", "Focus", "EcoSport", "Escape", "F-150"],
  Suzuki: ["Ertiga", "Crossover", "Swift", "Dzire", "Jimny", "Vitara"],
  Hyundai: ["Accent", "H100", "Kona", "Tucson", "Santa Fe", "i10"],
  Kia: ["Sorbento", "Sportage", "K2200", "Morning", "Picanto"],
  Mazda: ["3", "6", "CX-3", "CX-5", "BT-50"],
  Subaru: ["Forester", "Impreza", "XV"],
  Isuzu: ["Crosswind", "D-MAX", "Mux", "Traveller", "F-series"],
});

export interface VehiclePickerProps {
  value: VehicleDraft;
  onChange: (patch: Partial<VehicleDraft>) => void;
  /** Field-level error messages from the server or client validation. */
  errors?: Record<string, string | undefined>;
  makes?: readonly string[];
  models?: Readonly<Record<string, readonly string[]>>;
  /** Heading id so the wizard can move focus here. */
  headingId?: string;
  className?: string;
  /** Hide the card chrome (used inside the wizard step). */
  bare?: boolean;
}

export default function VehiclePicker({
  value,
  onChange,
  errors = {},
  makes = DEFAULT_MAKES,
  models = DEFAULT_MODELS,
  headingId,
  className,
  bare = false,
}: VehiclePickerProps) {
  const uid = useId();
  const modelInputRef = useRef<HTMLInputElement | null>(null);

  const years = useMemo(() => vehicleYears(), []);
  const uniqueMakes = useMemo(() => Array.from(new Set(makes)).sort(), [makes]);

  const availableModels = useMemo(() => {
    const found = models[value.make];
    return found ? Array.from(new Set(found)) : [];
  }, [models, value.make]);

  // Suggest the escape hatch once the customer has typed something the list does
  // not contain. We never switch it on for them — the choice stays theirs.
  const typedUnknownModel =
    !value.notListed &&
    value.model.trim().length > 0 &&
    availableModels.length > 0 &&
    !availableModels.some((m) => m.toLowerCase() === value.model.trim().toLowerCase());

  // When the escape hatch opens, put the cursor in the free-text box so the
  // customer does not have to hunt for it.
  useEffect(() => {
    if (value.notListed) modelInputRef.current?.focus();
  }, [value.notListed]);

  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="eyg-eyebrow text-muted-foreground">Step 1 of 4</p>
        <h2 id={headingId} tabIndex={-1} className="text-h3 text-foreground outline-none">
          Your vehicle
        </h2>
        <p className="text-sm text-muted-foreground">
          This is so we know which parts and fluids fit. Not sure? Use the escape hatch — we will work
          it out together.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Year"
          name="vehicleYear"
          id={`${uid}-year`}
          required
          value={value.year}
          error={errors.vehicleYear}
          disabled={value.notListed}
          onChange={(e) => onChange({ year: e.target.value })}
          hint={`${VEHICLE_YEAR_MIN} to ${VEHICLE_YEAR_MAX}`}
        >
          <option value="">Choose the year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </SelectField>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-make`} className="text-sm font-bold text-foreground">
            Make
          </label>
          <input
            id={`${uid}-make`}
            name="vehicleMake"
            list={`${uid}-make-list`}
            value={value.make}
            disabled={value.notListed}
            aria-invalid={errors.vehicleMake ? true : undefined}
            aria-describedby={errors.vehicleMake ? `${uid}-make-error` : undefined}
            onChange={(e) => onChange({ make: e.target.value })}
            className={cn(controlClass, errors.vehicleMake && controlInvalidClass)}
            autoComplete="off"
            placeholder="Type it if it is not listed"
          />
          <datalist id={`${uid}-make-list`}>
            {uniqueMakes.map((make) => (
              <option key={make} value={make} />
            ))}
          </datalist>
          {errors.vehicleMake ? (
            <p id={`${uid}-make-error`} className="text-xs font-semibold text-racing-700">
              ⚠ {errors.vehicleMake}
            </p>
          ) : null}
        </div>
      </div>

      {!value.notListed ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-model`} className="text-sm font-bold text-foreground">
            Model
          </label>
          <input
            id={`${uid}-model`}
            name="vehicleModel"
            list={`${uid}-model-list`}
            value={value.model}
            aria-invalid={errors.vehicleModel ? true : undefined}
            aria-describedby={errors.vehicleModel ? `${uid}-model-error` : undefined}
            onChange={(e) => onChange({ model: e.target.value })}
            className={cn(controlClass, errors.vehicleModel && controlInvalidClass)}
            autoComplete="off"
            placeholder="Type it if it is not listed"
          />
          <datalist id={`${uid}-model-list`}>
            {availableModels.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
          {errors.vehicleModel ? (
            <p id={`${uid}-model-error`} className="text-xs font-semibold text-racing-700">
              ⚠ {errors.vehicleModel}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── The escape hatch. Always available, never a dead end. ─────────── */}
      <div className="rounded-card border border-border bg-surface-muted p-3">
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="vehicleNotListed"
            checked={value.notListed}
            onChange={(e) => onChange({ notListed: e.target.checked })}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand-500)]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Car aria-hidden="true" className="size-4" focusable="false" />
              Not listed — I&apos;ll describe it
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              Import, modified, or just not in our list? Tell us in your own words. We will identify
              it when the car is in front of us.{" "}
              <span className="font-semibold text-foreground">This never blocks your booking.</span>
            </span>
          </span>
        </label>

        {value.notListed ? (
          <div className="mt-3 flex flex-col gap-1.5">
            <label htmlFor={`${uid}-free`} className="text-sm font-bold text-foreground">
              What are you driving?
            </label>
            <input
              id={`${uid}-free`}
              ref={modelInputRef}
              name="vehicleNotListedText"
              value={value.freeText}
              aria-invalid={errors.vehicleNotListed ? true : undefined}
              aria-describedby={
                errors.vehicleNotListed ? `${uid}-free-error` : `${uid}-free-hint`
              }
              onChange={(e) => onChange({ freeText: e.target.value })}
              className={cn(controlClass, errors.vehicleNotListed && controlInvalidClass)}
              placeholder="e.g. 2017 Toyota HiAce, white, 2.4 diesel"
              autoComplete="off"
            />
            <p id={`${uid}-free-hint`} className="text-xs text-muted-foreground">
              Year, make and model is plenty. Anything else helps.
            </p>
            {errors.vehicleNotListed ? (
              <p id={`${uid}-free-error`} className="text-xs font-semibold text-racing-700">
                ⚠ {errors.vehicleNotListed}
              </p>
            ) : null}
          </div>
        ) : null}

        {!value.notListed && typedUnknownModel ? (
          <p className="mt-2 text-xs text-muted-foreground">
            That model is not in our quick list — that is fine, keep it as typed. Or tick the box
            above and describe it instead.
          </p>
        ) : null}
      </div>

      {!value.notListed ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Variant"
            name="vehicleVariant"
            id={`${uid}-variant`}
            value={value.variant}
            error={errors.vehicleVariant}
            onChange={(e) => onChange({ variant: e.target.value })}
            placeholder="e.g. GLE, SR-X, Sport"
            hint="Helps us get the right trim. Skip it if you are not sure."
          />
          <TextField
            label="Plate number"
            name="vehiclePlate"
            id={`${uid}-plate`}
            value={value.plate}
            error={errors.vehiclePlate}
            onChange={(e) => onChange({ plate: e.target.value.toUpperCase() })}
            placeholder="ABC 1234"
            hint="So we can spot your car when you arrive."
          />
          <TextField
            label="Mileage"
            name="vehicleMileageKm"
            id={`${uid}-mileage`}
            value={value.mileageKm}
            error={errors.vehicleMileageKm}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e) => onChange({ mileageKm: e.target.value.replace(/\D/g, "").slice(0, 7) })}
            placeholder="e.g. 85000"
            hint="In kilometres. Helps us spot wear."
          />
        </div>
      ) : null}
    </div>
  );

  if (bare) return <div className={className}>{body}</div>;
  return (
    <WidgetCard className={cn("flex flex-col", className)}>
      {body}
    </WidgetCard>
  );
}

export { VehiclePicker };