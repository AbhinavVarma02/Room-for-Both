import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { Controller, type FieldErrors, useForm } from "react-hook-form";
import {
  CRITERION_LABELS,
  FORMATS,
  FORMAT_LABELS,
  HOST_CRITERIA,
  HOST_GOALS,
  HOST_GOAL_LABELS,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  VENUE_CATEGORIES,
  VENUE_CATEGORY_LABELS,
} from "@shared/constants/vocabulary";
import { HOST_NEGOTIABLE_FIELDS, HostProfile, type HostField } from "@shared/schemas/profiles";
import { AvailabilityEditor, FormSection, NumberField, PriorityPicker } from "../../components/FormControls";
import { Button, Callout, Field, ToggleChips, cn } from "../../components/ui/primitives";

export const HOST_FIELD_LABELS: Record<HostField, string> = {
  allowedFormats: "Formats",
  availability: "Availability",
  popupFeePerDayUsd: "Pop-up day rate",
  shelfFeePerWeekUsd: "Shelf fee",
  shelfMinWeeks: "Shelf minimum",
  eventFeePerHourUsd: "Event fee",
  eventMinHours: "Event minimum",
  guestFloorSqFt: "Floor space",
  shelfLinearFt: "Shelf space",
  eventCapacity: "Event capacity",
  staffHoursPerActivation: "Staff time",
  excludedCategories: "Category exclusions",
  samplingAllowed: "Sampling",
  alcoholOnPremises: "Alcohol",
  requiresExclusivity: "Exclusivity",
};

function TriState({ label, value, onChange, yes = "Yes", no = "No" }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void; yes?: string; no?: string }) {
  const name = useId();
  const options: { v: boolean | null; text: string }[] = [
    { v: true, text: yes },
    { v: false, text: no },
    { v: null, text: "Not stated" },
  ];
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="mt-2 inline-flex rounded-lg border border-line-strong bg-surface p-0.5">
        {options.map((o) => (
          <label
            key={String(o.v)}
            className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm", value === o.v ? "bg-host text-white" : "text-ink-soft hover:text-ink")}
          >
            <input type="radio" name={name} className="sr-only" checked={value === o.v} onChange={() => onChange(o.v)} />
            {o.text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function NullableChips<T extends string>({
  options,
  labels,
  value,
  onChange,
  ariaLabel,
  unknownLabel,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T[] | null;
  onChange: (v: T[] | null) => void;
  ariaLabel: string;
  unknownLabel: string;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className={cn(value === null && "opacity-50")}>
        <ToggleChips options={options} labels={labels} value={value ?? []} onChange={(v) => onChange(v)} ariaLabel={ariaLabel} tone="host" />
      </div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-ink-soft">
        <input id={id} type="checkbox" className="size-4 accent-host" checked={value === null} onChange={(e) => onChange(e.target.checked ? null : [])} />
        {unknownLabel}
      </label>
    </div>
  );
}

function err(errors: FieldErrors<HostProfile>, key: keyof HostProfile) {
  const e = errors[key] as { message?: string } | undefined;
  return e?.message;
}

export function HostForm({
  initial,
  onSubmit,
  submitLabel,
  mode,
}: {
  initial: HostProfile;
  onSubmit: (host: HostProfile) => void | Promise<void>;
  submitLabel: string;
  mode: "guest_entry" | "host_entry" | "fictional";
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitted, isSubmitting },
  } = useForm<HostProfile>({ resolver: zodResolver(HostProfile), defaultValues: initial });
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={handleSubmit(async (h) => onSubmit({ ...h, notes: h.notes?.trim() || undefined } as HostProfile))} noValidate className="space-y-6">
      {mode === "guest_entry" && (
        <Callout tone="warn" title="You are entering the host's terms on their behalf">
          These values will be marked as unconfirmed by the host. For a genuinely two-sided result, send the host a private response link instead.
        </Callout>
      )}
      {isSubmitted && hasErrors && (
        <Callout tone="bad" title="Some answers need attention">
          Check the highlighted fields below.
        </Callout>
      )}

      <FormSection title="Venue">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Venue name" htmlFor="venueName" error={err(errors, "venueName")}>
            <input id="venueName" className="input" maxLength={80} {...register("venueName")} />
          </Field>
          <Field label="Kind of venue" htmlFor="venueCategory">
            <select id="venueCategory" className="input" {...register("venueCategory")}>
              {VENUE_CATEGORIES.map((v) => (
                <option key={v} value={v}>
                  {VENUE_CATEGORY_LABELS[v]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="What the venue wants from partnerships" optional>
          <Controller control={control} name="goals" render={({ field }) => <ToggleChips options={HOST_GOALS} labels={HOST_GOAL_LABELS} value={field.value} onChange={field.onChange} ariaLabel="Host goals" tone="host" max={3} />} />
        </Field>
        <Field label="Formats the venue hosts">
          <Controller
            control={control}
            name="allowedFormats"
            render={({ field }) => <NullableChips options={FORMATS} labels={FORMAT_LABELS} value={field.value} onChange={field.onChange} ariaLabel="Allowed formats" unknownLabel="Not stated yet" />}
          />
        </Field>
      </FormSection>

      <FormSection title="When partners can come in" description="Weekly windows when a partner activation could run.">
        <Controller control={control} name="availability" render={({ field }) => <AvailabilityEditor party="host" value={field.value} onChange={field.onChange} />} />
      </FormSection>

      <FormSection title="Fees and minimums" description="The least the venue would accept. Leave blank if not decided.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller control={control} name="popupFeePerDayUsd" render={({ field }) => <NumberField label="Pop-up day rate" prefix="$" value={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="shelfFeePerWeekUsd" render={({ field }) => <NumberField label="Shelf placement fee per week" prefix="$" value={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="shelfMinWeeks" render={({ field }) => <NumberField label="Minimum shelf placement" suffix="weeks" min={1} max={52} value={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="eventFeePerHourUsd" render={({ field }) => <NumberField label="Co-hosted event fee per hour" prefix="$" value={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="eventMinHours" render={({ field }) => <NumberField label="Minimum event length" suffix="hours" min={1} max={12} value={field.value} onChange={field.onChange} />} />
        </div>
      </FormSection>

      <FormSection title="Space and staff">
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller control={control} name="guestFloorSqFt" render={({ field }) => <NumberField label="Floor space for a pop-up" suffix="sq ft" value={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="shelfLinearFt" render={({ field }) => <NumberField label="Shelf space for a partner" suffix="linear ft" value={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="eventCapacity" render={({ field }) => <NumberField label="Event capacity" suffix="people" value={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="staffHoursPerActivation" render={({ field }) => <NumberField label="Staff hours you can give an activation" suffix="hours" max={24} value={field.value} onChange={field.onChange} />} />
        </div>
      </FormSection>

      <FormSection title="House rules">
        <Field label="Product categories the venue will not carry or host">
          <Controller
            control={control}
            name="excludedCategories"
            render={({ field }) => (
              <NullableChips options={PRODUCT_CATEGORIES} labels={PRODUCT_CATEGORY_LABELS} value={field.value} onChange={field.onChange} ariaLabel="Excluded categories" unknownLabel="Not stated yet" />
            )}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller control={control} name="samplingAllowed" render={({ field }) => <TriState label="Partners may hand out samples" value={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="alcoholOnPremises" render={({ field }) => <TriState label="Alcohol served during activations" value={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="requiresExclusivity" render={({ field }) => <TriState label="Partnerships require exclusivity" value={field.value} onChange={field.onChange} />} />
        </div>
      </FormSection>

      <FormSection title="Priorities and fixed terms">
        <Field label="What matters most to the venue" optional>
          <Controller control={control} name="priorities" render={({ field }) => <PriorityPicker options={HOST_CRITERIA} labels={CRITERION_LABELS} value={field.value} onChange={field.onChange} tone="host" />} />
        </Field>
        <Field label="Terms the venue will not negotiate" optional hint="Room for Both will never suggest changing these.">
          <Controller
            control={control}
            name="fixedFields"
            render={({ field }) => <ToggleChips options={HOST_NEGOTIABLE_FIELDS} labels={HOST_FIELD_LABELS} value={field.value} onChange={field.onChange} ariaLabel="Non-negotiable host terms" tone="host" />}
          />
        </Field>
        <Field label="Notes" htmlFor="hostNotes" optional hint="Never used in calculations.">
          <textarea id="hostNotes" className="input min-h-20" maxLength={500} {...register("notes")} />
        </Field>
      </FormSection>

      <div className="flex justify-end">
        <Button type="submit" variant="host" size="lg" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
