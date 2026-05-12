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
  email: string;
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

export async function submitTicket(values: TicketFormValues): Promise<SubmitResult> {
  try {
    const res = await fetch(`${BASE}/api/v1/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (res.status === 201) {
      const ticket = (await res.json()) as TicketCreated;
      return { kind: "created", ticket };
    }
    if (res.status === 409) {
      const body = await res.json();
      // FastAPI HTTPException wraps detail under `detail`
      const info = (body.detail ?? body) as DuplicateError;
      return { kind: "duplicate", info };
    }

    const txt = await res.text();
    return { kind: "error", message: `Server error (${res.status}): ${txt.slice(0, 200)}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { kind: "error", message: msg };
  }
}
