import type { TicketFormValues } from "./schema";
import {
  BUSINESS_TYPES,
  CONTACT_PERSON_PROFILES,
  issueCategoriesFor,
  PRODUCT_CATEGORIES,
} from "./options";

/** The ticket fields a clone copies (a subset of the admin TicketResponse). */
export type CloneSource = {
  reference: string;
  business_name: string;
  contact_name: string;
  contact_person_profile?: string | null;
  business_type?: string | null;
  email?: string | null;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  address_line3?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  product_category: string;
  issue_category: string;
  description?: string | null;
};

/**
 * Split a stored value back into the form's "preset or Other + typed" pair.
 * The submit layer folds an "Other" pick into the typed text, so a stored
 * value outside the preset list came in that way and must go back the same way.
 */
function presetOrOther<T extends string>(
  value: string | null | undefined,
  presets: readonly T[]
): { pick?: T; other: string } {
  const v = (value ?? "").trim();
  if (!v) return { other: "" };
  if ((presets as readonly string[]).includes(v)) return { pick: v as T, other: "" };
  return { pick: "Other" as T, other: v };
}

/**
 * Form defaults for "Clone ticket": the customer, address, product and issue
 * of an existing ticket. The serial number is deliberately left blank — a
 * clone is for another device at the same customer, so staff must type it.
 * Attachments, status, assignment and everything else start fresh.
 */
export function ticketToCloneDefaults(t: CloneSource): Partial<TicketFormValues> {
  const business = presetOrOther(t.business_type, BUSINESS_TYPES);
  const profile = presetOrOther(t.contact_person_profile, CONTACT_PERSON_PROFILES);
  const product = presetOrOther(t.product_category, PRODUCT_CATEGORIES);
  const productPick = product.pick ?? "Other";
  const issue = presetOrOther(t.issue_category, issueCategoriesFor(productPick));
  return {
    business_name: t.business_name,
    contact_name: t.contact_name,
    contact_person_profile: profile.pick,
    contact_person_profile_other: profile.other,
    phone: t.phone,
    email: t.email ?? "",
    business_type: business.pick,
    business_type_other: business.other,
    address_line1: t.address_line1,
    address_line2: t.address_line2 ?? "",
    address_line3: t.address_line3 ?? "",
    city: t.city,
    state: t.state,
    pincode: t.pincode,
    latitude: t.latitude ?? undefined,
    longitude: t.longitude ?? undefined,
    product_category: product.pick,
    product_category_other: product.other,
    serial_number: "",
    issue_category: issue.pick,
    issue_category_other: issue.other,
    description: t.description ?? "",
  };
}
