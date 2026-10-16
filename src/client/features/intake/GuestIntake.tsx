import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Controller, type FieldErrors, useFieldArray, useForm } from "react-hook-form";
import { useLocation } from "wouter";
import {
  CRITERION_LABELS,
  FORMATS,
  FORMAT_LABELS,
  GUEST_CRITERIA,
  GUEST_DEALBREAKERS,
  GUEST_DEALBREAKER_LABELS,
  OBJECTIVES,
  OBJECTIVE_LABELS,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  SECTORS,
  SECTOR_LABELS,
  SEED_KINDS,
  SEED_KIND_LABELS,
} from "@shared/constants/vocabulary";
import { GUEST_NEGOTIABLE_FIELDS, GuestProfile, type GuestField } from "@shared/schemas/profiles";
import { AvailabilityEditor, FormSection, NumberField, PriorityPicker } from "../../components/FormControls";
import { Button, Callout, Field, Switch, ToggleChips } from "../../components/ui/primitives";
import { StepHeader, stepHref } from "../../app/Workspace";
import { useWorkspace } from "../../app/store";

export const GUEST_FIELD_LABELS: Record<GuestField, string> = {
  maxOutlayUsd: "Total budget",
  ownCostPerActivationUsd: "Own costs",
  availability: "Availability",
  popupFootprintSqFt: "Pop-up footprint",
  shelfLinearFt: "Shelf space needed",
  minEventAudience: "Minimum audience",
  staffCount: "Team size",
  acceptableFormats: "Acceptable formats",
  wantsSampling: "Sampling",
  dealbreakers: "Conditions",
};

const BLANK: GuestProfile = {
  origin: "party_supplied",
  businessName: "",
  sector: "other",
  productCategories: [],
  culturalSeeds: [],
  market: { city: "" },
  objectives: [],
  maxOutlayUsd: null,
  ownCostPerActivationUsd: null,
  availability: null,
  popupFootprintSqFt: null,
  shelfLinearFt: null,
  minEventAudience: null,
  staffCount: null,
  wantsSampling: false,
  acceptableFormats: ["popup", "shelf", "cohosted_event"],
  dealbreakers: [],
  priorities: [],
  fixedFields: [],
  notes: "",
};

function errorText(errors: FieldErrors<GuestProfile>, path: string): string | undefined {
  const parts = path.split(".");
  let node: unknown = errors;
  for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
  const message = (node as { message?: string } | undefined)?.message;
  return message ? friendly(message) : undefined;
}

function friendly(message: string): string {
  if (/too_small|at least|>=1|expected array to have >=1/i.test(message)) return "Choose at least one.";
  if (/>=\s?1 characters|too small: expected string/i.test(message)) return "Required.";
  return message;
}

export function GuestIntake() {
  const { state, dispatch } = useWorkspace();
  const [, navigate] = useLocation();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<GuestProfile>({
    resolver: zodResolver(GuestProfile),
    defaultValues: state.guest ?? BLANK,
    mode: "onSubmit",
  });
  const seeds = useFieldArray({ control, name: "culturalSeeds" });

  const onValid = (guest: GuestProfile) => {
    dispatch({ type: "set_guest", guest: { ...guest, notes: guest.notes?.trim() || undefined } as GuestProfile });
    navigate(stepHref("discovery"));
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate aria-describedby={isSubmitted && errorCount ? "guest-errors" : undefined}>
      <StepHeader step="guest">
        Describe your business and the terms you can offer. Leave anything you do not know blank: it will be shown as unknown, never guessed.
      </StepHeader>

      {isSubmitted && errorCount > 0 && (
        <div id="guest-errors" className="mb-6">
          <Callout tone="bad" title="Some answers need attention">
            Check the highlighted fields below.
          </Callout>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <FormSection title="Your business">
          <Field label="Business name" htmlFor="businessName" error={errorText(errors, "businessName")}>
            <input id="businessName" className="input" maxLength={80} autoComplete="organization" {...register("businessName")} aria-invalid={errors.businessName ? true : undefined} />
          </Field>
          <Field label="Sector" htmlFor="sector">
            <select id="sector" className="input" {...register("sector")}>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {SECTOR_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product categories" hint="Up to five. Hosts' category exclusions are checked against these." error={errorText(errors, "productCategories")}>
            <Controller
              control={control}
              name="productCategories"
              render={({ field }) => (
                <ToggleChips options={PRODUCT_CATEGORIES} labels={PRODUCT_CATEGORY_LABELS} value={field.value} onChange={field.onChange} ariaLabel="Product categories" tone="guest" max={5} />
              )}
            />
          </Field>
          <Field label="Notes" htmlFor="notes" optional hint="For your own reference. Never used in calculations.">
            <textarea id="notes" className="input min-h-20" maxLength={500} {...register("notes")} />
          </Field>
        </FormSection>

        <FormSection title="Cultural references" description="Brands, books, artists, films, or podcasts your customers love. Used to find culturally aligned partners and themes.">
          <ul className="space-y-2">
            {seeds.fields.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor={`seed-${i}`}>
                    Reference {i + 1}
                  </label>
                  <input id={`seed-${i}`} className="input" maxLength={80} placeholder="e.g. a brand or book" {...register(`culturalSeeds.${i}.label`)} />
                </div>
                <label className="sr-only" htmlFor={`seed-kind-${i}`}>
                  Type of reference {i + 1}
                </label>
                <select id={`seed-kind-${i}`} className="input w-auto" {...register(`culturalSeeds.${i}.kind`)}>
                  {SEED_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {SEED_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" className="mt-0.5" aria-label={`Remove reference ${i + 1}`} onClick={() => seeds.remove(i)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          {errorText(errors, "culturalSeeds") && <p className="text-xs font-medium text-bad">{errorText(errors, "culturalSeeds")}</p>}
          <Button variant="secondary" size="sm" disabled={seeds.fields.length >= 5} onClick={() => seeds.append({ label: "", kind: "brand" })}>
            <Plus className="size-4" aria-hidden /> Add a reference
          </Button>
          <p className="text-xs text-ink-faint">The first three are used per research run. Skip this to evaluate a host you already have in mind.</p>
        </FormSection>

        <FormSection title="Market and goals">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City or market" htmlFor="city" error={errorText(errors, "market.city")}>
              <input id="city" className="input" maxLength={80} autoComplete="address-level2" {...register("market.city")} aria-invalid={errors.market?.city ? true : undefined} />
            </Field>
            <Field label="Neighbourhood" htmlFor="neighborhood" optional>
              <input id="neighborhood" className="input" maxLength={60} {...register("market.neighborhood")} />
            </Field>
          </div>
          <Field label="What you want from a partnership" hint="Up to three." error={errorText(errors, "objectives")}>
            <Controller
              control={control}
              name="objectives"
              render={({ field }) => <ToggleChips options={OBJECTIVES} labels={OBJECTIVE_LABELS} value={field.value} onChange={field.onChange} ariaLabel="Objectives" tone="guest" max={3} />}
            />
          </Field>
        </FormSection>

        <FormSection title="Budget">
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="maxOutlayUsd"
              render={({ field }) => (
                <NumberField label="Total budget for one activation" prefix="$" value={field.value} onChange={field.onChange} hint="Partner fee plus your own costs." error={errorText(errors, "maxOutlayUsd")} />
              )}
            />
            <Controller
              control={control}
              name="ownCostPerActivationUsd"
              render={({ field }) => (
                <NumberField label="Your own costs per activation" prefix="$" value={field.value} onChange={field.onChange} hint="Samples, displays, travel." error={errorText(errors, "ownCostPerActivationUsd")} />
              )}
            />
          </div>
        </FormSection>

        <FormSection title="When your team can attend" description="Weekly windows in whole hours. Pop-ups and events need a window both sides share.">
          <Controller
            control={control}
            name="availability"
            render={({ field }) => <AvailabilityEditor party="guest" value={field.value} onChange={field.onChange} error={errorText(errors, "availability")} />}
          />
        </FormSection>

        <FormSection title="Space and team">
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="popupFootprintSqFt"
              render={({ field }) => <NumberField label="Pop-up footprint" suffix="sq ft" value={field.value} onChange={field.onChange} />}
            />
            <Controller
              control={control}
              name="shelfLinearFt"
              render={({ field }) => <NumberField label="Shelf space needed" suffix="linear ft" value={field.value} onChange={field.onChange} />}
            />
            <Controller
              control={control}
              name="minEventAudience"
              render={({ field }) => <NumberField label="Minimum event audience" suffix="people" value={field.value} onChange={field.onChange} optional hint="Leave blank for no minimum." />}
            />
            <Controller
              control={control}
              name="staffCount"
              render={({ field }) => <NumberField label="Team members who can attend" value={field.value} onChange={field.onChange} max={50} />}
            />
          </div>
          <Controller
            control={control}
            name="wantsSampling"
            render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="We want to hand out product samples in person" />}
          />
        </FormSection>

        <FormSection title="Formats and conditions">
          <Field label="Formats you would consider" error={errorText(errors, "acceptableFormats")}>
            <Controller
              control={control}
              name="acceptableFormats"
              render={({ field }) => <ToggleChips options={FORMATS} labels={FORMAT_LABELS} value={field.value} onChange={field.onChange} ariaLabel="Acceptable formats" tone="guest" />}
            />
          </Field>
          <Field label="Conditions you will not compromise on" optional>
            <Controller
              control={control}
              name="dealbreakers"
              render={({ field }) => (
                <ToggleChips options={GUEST_DEALBREAKERS} labels={GUEST_DEALBREAKER_LABELS} value={field.value} onChange={field.onChange} ariaLabel="Conditions" tone="guest" />
              )}
            />
          </Field>
        </FormSection>

        <FormSection title="Priorities and fixed terms">
          <Field label="What matters most to you" optional>
            <Controller
              control={control}
              name="priorities"
              render={({ field }) => <PriorityPicker options={GUEST_CRITERIA} labels={CRITERION_LABELS} value={field.value} onChange={field.onChange} tone="guest" />}
            />
          </Field>
          <Field label="Terms you will not negotiate" optional hint="Room for Both will never suggest changing these.">
            <Controller
              control={control}
              name="fixedFields"
              render={({ field }) => (
                <ToggleChips options={GUEST_NEGOTIABLE_FIELDS} labels={GUEST_FIELD_LABELS} value={field.value} onChange={field.onChange} ariaLabel="Non-negotiable terms" tone="guest" />
              )}
            />
          </Field>
        </FormSection>
      </div>

      <div className="no-print mt-10 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
        <Button type="submit" size="lg" variant="guest">
          Save and continue →
        </Button>
      </div>
    </form>
  );
}
