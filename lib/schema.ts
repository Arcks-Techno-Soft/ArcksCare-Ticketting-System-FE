import { z } from "zod";
import {
  BUSINESS_TYPES,
  ISSUE_CATEGORIES,
  PRODUCT_CATEGORIES,
} from "./options";

// Mirrors backend/app/schemas/ticket.py:TicketCreate
export const ticketSchema = z.object({
  business_name: z.string().trim().min(2, "Business name is required"),
  contact_name: z.string().trim().min(2, "Contact name is required"),
  phone: z
    .string()
    .trim()
    .transform((v) => {
      // Indian mobile: keep digits, strip a leading +91 / 91 / 0 trunk prefix.
      let d = v.replace(/\D/g, "");
      if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
      else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
      return d;
    })
    .refine(
      (d) => /^[6-9]\d{9}$/.test(d),
      "Enter a valid 10-digit mobile number",
    ),
  // Optional — customer may not have an email address.
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  business_type: z.enum(BUSINESS_TYPES, {
    errorMap: () => ({ message: "Select your business type" }),
  }),
  // Free-text category, required only when business_type === "Other". The
  // submit layer sends this value as the business_type when "Other" is picked.
  business_type_other: z.string().trim().max(60).optional().or(z.literal("")),

  // Address
  address_line1: z.string().trim().min(3, "Address line 1 is required"),
  address_line2: z.string().trim().max(200).optional().or(z.literal("")),
  address_line3: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required"),
  state: z.string().trim().min(2, "State is required"),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/, "Enter a valid pincode (digits only)"),

  // Optional geo (set if customer drops a pin on the map)
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),

  product_category: z.enum(PRODUCT_CATEGORIES, {
    errorMap: () => ({ message: "Select a product category" }),
  }),
  serial_number: z
    .string()
    .trim()
    .min(3, "Enter the product serial number"),

  issue_category: z.enum(ISSUE_CATEGORIES, {
    errorMap: () => ({ message: "Select an issue category" }),
  }),
  // NOTE: severity is intentionally not collected from the customer. The
  // backend defaults it to MEDIUM; Admin/Manager triage and adjust later.
  description: z
    .string()
    .trim()
    .min(20, "Please describe the issue in at least 20 characters")
    .max(4000, "Description is too long"),
  preferred_contact_time: z.string().optional().or(z.literal("")),
}).superRefine((val, ctx) => {
  // When the customer chooses "Other", they must type their business category.
  if (val.business_type === "Other" && !val.business_type_other?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["business_type_other"],
      message: "Please specify your business type",
    });
  }
});

export type TicketFormValues = z.infer<typeof ticketSchema>;
