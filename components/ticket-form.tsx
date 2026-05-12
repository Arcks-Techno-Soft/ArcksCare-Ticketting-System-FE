"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";

import { ticketSchema, type TicketFormValues } from "@/lib/schema";
import { submitTicket, type DuplicateError } from "@/lib/api";
import {
  BUSINESS_TYPES,
  INDIAN_STATES,
  ISSUE_CATEGORIES,
  PREFERRED_CONTACT_TIMES,
  PRODUCT_CATEGORIES,
  SEVERITIES,
} from "@/lib/options";

import { Button } from "@/components/ui/Button";
import {
  FieldError,
  FieldGroup,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/Field";

// Leaflet touches `window`, so the map must be client-only.
const AddressMap = dynamic(() => import("@/components/address-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] w-full animate-pulse rounded-xl2 border border-line bg-surface-raised" />
  ),
});

type Step = "form" | "submitting";

export function TicketForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [duplicate, setDuplicate] = useState<DuplicateError | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    mode: "onBlur",
    defaultValues: { severity: "MEDIUM" },
  });

  // Watch geo so we can pass it back to the map (and show a subtle indicator).
  const lat = watch("latitude");
  const lng = watch("longitude");

  const onLocationChange = (loc: {
    lat: number;
    lng: number;
    address: {
      line1?: string;
      line2?: string;
      line3?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
  }) => {
    setValue("latitude", loc.lat, { shouldDirty: true });
    setValue("longitude", loc.lng, { shouldDirty: true });
    // Only overwrite fields we successfully parsed - never clobber user input
    // with blanks.
    if (loc.address.line1)
      setValue("address_line1", loc.address.line1, { shouldDirty: true, shouldValidate: true });
    if (loc.address.line2)
      setValue("address_line2", loc.address.line2, { shouldDirty: true });
    if (loc.address.line3)
      setValue("address_line3", loc.address.line3, { shouldDirty: true });
    if (loc.address.city)
      setValue("city", loc.address.city, { shouldDirty: true, shouldValidate: true });
    if (loc.address.state) {
      // Match against our list - Nominatim returns full state names which usually match.
      const match = INDIAN_STATES.find(
        (s) => s.toLowerCase() === loc.address.state!.toLowerCase()
      );
      if (match) setValue("state", match, { shouldDirty: true, shouldValidate: true });
    }
    if (loc.address.pincode)
      setValue("pincode", loc.address.pincode, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (values: TicketFormValues) => {
    setDuplicate(null);
    setServerError(null);
    setStep("submitting");
    const res = await submitTicket(values);
    if (res.kind === "created") {
      const q = new URLSearchParams({
        ref: res.ticket.reference,
        email: res.ticket.email,
      });
      router.push(`/success?${q.toString()}`);
      return;
    }
    if (res.kind === "duplicate") {
      setDuplicate(res.info);
      setStep("form");
      return;
    }
    setServerError(res.message);
    setStep("form");
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-12"
      noValidate
    >
      {/* ------------------------------ Customer ------------------------- */}
      <Section
        index="01"
        title="Tell us about your business"
        caption="So we can pull up the right account and reach the right people."
      >
        <Grid>
          <FieldGroup className="md:col-span-2">
            <Label htmlFor="business_name" required>Business name</Label>
            <Input
              id="business_name"
              placeholder="e.g. The Oberoi Grand"
              {...register("business_name")}
            />
            <FieldError message={errors.business_name?.message} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="contact_name" required>Contact person</Label>
            <Input
              id="contact_name"
              placeholder="Your full name"
              {...register("contact_name")}
            />
            <FieldError message={errors.contact_name?.message} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="business_type" required>Business type</Label>
            <Select
              id="business_type"
              options={BUSINESS_TYPES}
              placeholder="Choose business type"
              {...register("business_type")}
            />
            <FieldError message={errors.business_type?.message} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="phone" required>Phone</Label>
            <Input
              id="phone"
              placeholder="+91 98xxxxxxxx"
              inputMode="tel"
              {...register("phone")}
            />
            <FieldError message={errors.phone?.message} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="email" required>Email</Label>
            <Input
              id="email"
              placeholder="you@business.com"
              type="email"
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </FieldGroup>
        </Grid>
      </Section>

      {/* ------------------------------ Address -------------------------- */}
      <Section
        index="02"
        title="Where are you located?"
        caption="So our technician can reach you. Drop a pin on the map and we'll auto-fill the address."
      >
        <div className="space-y-6">
          <Grid>
            <FieldGroup className="md:col-span-2">
              <Label htmlFor="address_line1" required>Address line 1</Label>
              <Input
                id="address_line1"
                placeholder="Building name, floor, street"
                {...register("address_line1")}
              />
              <FieldError message={errors.address_line1?.message} />
            </FieldGroup>

            <FieldGroup className="md:col-span-2">
              <Label htmlFor="address_line2">Address line 2</Label>
              <Input
                id="address_line2"
                placeholder="Area, locality (optional)"
                {...register("address_line2")}
              />
              <FieldError message={errors.address_line2?.message} />
            </FieldGroup>

            <FieldGroup className="md:col-span-2">
              <Label htmlFor="address_line3">Address line 3</Label>
              <Input
                id="address_line3"
                placeholder="Landmark, additional info (optional)"
                {...register("address_line3")}
              />
              <FieldError message={errors.address_line3?.message} />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="city" required>City</Label>
              <Input
                id="city"
                placeholder="Bengaluru"
                {...register("city")}
              />
              <FieldError message={errors.city?.message} />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="state" required>State</Label>
              <Select
                id="state"
                options={INDIAN_STATES}
                placeholder="Select state"
                {...register("state")}
              />
              <FieldError message={errors.state?.message} />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="pincode" required>Pincode</Label>
              <Input
                id="pincode"
                placeholder="560001"
                inputMode="numeric"
                {...register("pincode")}
              />
              <FieldError message={errors.pincode?.message} />
            </FieldGroup>
          </Grid>

          {/* Map ----------------------------------------------------- */}
          <div>
            <Label hint={lat && lng ? `Pin set: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Optional"}>
              Drop a pin on the map
            </Label>
            <AddressMap onLocationChange={onLocationChange} />
          </div>
        </div>
      </Section>

      {/* ------------------------------ Product -------------------------- */}
      <Section
        index="03"
        title="Which device needs attention?"
        caption="Your product's serial number is on a label on the back or underside."
      >
        <Grid>
          <FieldGroup>
            <Label htmlFor="product_category" required>Product category</Label>
            <Select
              id="product_category"
              options={PRODUCT_CATEGORIES}
              placeholder="Select product"
              {...register("product_category")}
            />
            <FieldError message={errors.product_category?.message} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="serial_number" required hint="Used to track your device">
              Serial number
            </Label>
            <Input
              id="serial_number"
              placeholder="e.g. POSBK-2024-A1023"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              {...register("serial_number")}
            />
            <FieldError message={errors.serial_number?.message} />
          </FieldGroup>
        </Grid>
      </Section>

      {/* ------------------------------ Issue ---------------------------- */}
      <Section
        index="04"
        title="What's going wrong?"
        caption="The more detail, the faster we can help."
      >
        <Grid>
          <FieldGroup>
            <Label htmlFor="issue_category" required>Issue category</Label>
            <Select
              id="issue_category"
              options={ISSUE_CATEGORIES}
              placeholder="Choose issue category"
              {...register("issue_category")}
            />
            <FieldError message={errors.issue_category?.message} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="severity" required>Severity</Label>
            <Select
              id="severity"
              options={SEVERITIES}
              placeholder="Select severity"
              {...register("severity")}
            />
            <FieldError message={errors.severity?.message} />
          </FieldGroup>

          <FieldGroup className="md:col-span-2">
            <Label htmlFor="description" required hint="Min 20 characters">
              Describe the issue
            </Label>
            <Textarea
              id="description"
              placeholder="When did it start? Any error messages? What were you doing when it happened?"
              {...register("description")}
            />
            <FieldError message={errors.description?.message} />
          </FieldGroup>

          <FieldGroup className="md:col-span-2">
            <Label htmlFor="preferred_contact_time">Preferred contact time</Label>
            <Select
              id="preferred_contact_time"
              options={PREFERRED_CONTACT_TIMES}
              placeholder="Anytime"
              {...register("preferred_contact_time")}
            />
          </FieldGroup>
        </Grid>
      </Section>

      {/* ------------------------------ Submit --------------------------- */}
      <AnimatePresence>
        {duplicate && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl2 border border-line bg-surface-raised p-5 shadow-soft"
          >
            <p className="text-[13px] uppercase tracking-[0.16em] text-ink-subtle">
              Already tracked
            </p>
            <h3 className="mt-1.5 font-display text-2xl font-medium tracking-tight text-ink">
              Ticket {duplicate.existing_reference} is already open
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
              {duplicate.message}
            </p>
          </motion.div>
        )}

        {serverError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl2 border border-accent-danger/30 bg-white p-5 text-[14px] text-accent-danger"
          >
            {serverError}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
        <p className="text-[13px] text-ink-subtle">
          By submitting, you agree we may contact you to resolve this issue.
        </p>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting || step === "submitting"}
        >
          {isSubmitting || step === "submitting" ? "Submitting…" : "Submit ticket"}
          {!(isSubmitting || step === "submitting") && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </Button>
      </div>
    </form>
  );
}

/* --------------------------- Layout helpers ------------------------------ */

function Section({
  index,
  title,
  caption,
  children,
}: {
  index: string;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="grid gap-8 border-t border-line pt-10 md:grid-cols-[260px_1fr]"
    >
      <div>
        <div className="text-[12px] tracking-[0.18em] text-ink-subtle">{index}</div>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">
          {title}
        </h2>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-ink-muted">
          {caption}
        </p>
      </div>
      <div>{children}</div>
    </motion.section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>;
}
