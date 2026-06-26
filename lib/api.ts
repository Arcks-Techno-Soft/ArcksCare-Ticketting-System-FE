import type { TicketFormValues } from "./schema";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type DuplicateError = {
  duplicate: true;
  existing_reference: string;
  existing_status: string;
  created_at: string;
  hours_until_new_allowed: number;
  message: string;
};

export type TicketCreated = {
  id: number;
  reference: string;
  business_name: string;
  contact_name: string;
  email: string | null;
  phone: string;
  product_category: string;
  serial_number: string;
  issue_category: string;
  severity: string;
  status: string;
  created_at: string;
};

export type SubmitResult =
  | { kind: "created"; ticket: TicketCreated }
  | { kind: "duplicate"; info: DuplicateError }
  | { kind: "error"; message: string };

/**
 * Submit a ticket as multipart/form-data so attachments can ride along.
 * - Form field `payload` carries the JSON-encoded ticket data.
 * - Form field `files` (repeated) carries any uploaded files.
 */
export async function submitTicket(
  values: TicketFormValues,
  files: File[] = [],
  // Optional authed fetcher (e.g. authFetch). When supplied, the request
  // carries the staff member's JWT so the backend records them as `raised_by`
  // — this is how a staff-opened ticket gets the "Opened by <name>" tag.
  fetcher: typeof fetch = fetch
): Promise<SubmitResult> {
  try {
    // When the customer chose "Other", the typed category (business_type_other)
    // IS the business type we store. Strip the helper field and fold its value
    // into business_type before sending.
    const {
      email,
      business_type_other,
      business_type,
      contact_person_profile_other,
      contact_person_profile,
      ...rest
    } = values;
    const resolvedType =
      business_type === "Other" && business_type_other?.trim()
        ? business_type_other.trim()
        : business_type;
    // Same fold for the contact role: an "Other" pick sends the typed role.
    const resolvedProfile =
      contact_person_profile === "Other" && contact_person_profile_other?.trim()
        ? contact_person_profile_other.trim()
        : contact_person_profile;
    const base = {
      ...rest,
      business_type: resolvedType,
      contact_person_profile: resolvedProfile,
    };
    // Drop email entirely when blank so the backend stores it as null
    // (an empty string would fail email-format validation).
    const payload = email && email.trim() ? { ...base, email } : base;
    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    for (const f of files) fd.append("files", f, f.name);

    const res = await fetcher(`${BASE}/api/v1/tickets`, {
      method: "POST",
      body: fd,
      // NOTE: do NOT set Content-Type - the browser sets the correct
      // multipart boundary header automatically.
    });

    if (res.status === 201) {
      const ticket = (await res.json()) as TicketCreated;
      return { kind: "created", ticket };
    }
    if (res.status === 409) {
      const body = await res.json();
      const info = (body.detail ?? body) as DuplicateError;
      return { kind: "duplicate", info };
    }

    const txt = await res.text();
    return { kind: "error", message: `Server error (${res.status}): ${txt.slice(0, 300)}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { kind: "error", message: msg };
  }
}
