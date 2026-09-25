// Keep these arrays in sync with backend/app/schemas/ticket.py enums.

export const BUSINESS_TYPES = [
  "Restaurant",
  "Hotel",
  "Retail Store",
  "Cafe",
  "Cloud Kitchen",
  "Food Court",
  "Ice Cream Parlour",
  "Pub and Bar",
  "Brewery",
  "Partner",
  "Other",
] as const;

// Roles for the contact person. Kept in sync with the backend
// ContactPersonProfile enum. "Other" reveals a free-text field.
export const CONTACT_PERSON_PROFILES = [
  "Owner",
  "Manager",
  "Cashier",
  "Chef",
  "Captain/Waiter",
  "Other",
] as const;

export const PRODUCT_CATEGORIES = [
  "POS Machine",
  "Printer",
  "Kitchen Display Screen",
  "UPS",
  "Kiosk",
  "Tablet",
  "Monitor",
  "CCTV",
  "Cash Drawer",
  "Biometric",
  "Other",
] as const;

// Generic issue list, for products without a list of their own below.
export const ISSUE_CATEGORIES = [
  "Not Powering On",
  "Display Issue",
  "Printing Issue",
  "Connectivity",
  "Software Crash",
  "Physical Damage",
  "Other",
] as const;

// Product-specific issue lists (from the ops team's issue sheet). The ticket
// form shows the list for the chosen product; any product not listed here gets
// the generic ISSUE_CATEGORIES. Every list ends in "Other" (free text). The
// backend stores issue_category as free text, so these need no backend change.
export const ISSUE_CATEGORIES_BY_PRODUCT: Partial<
  Record<(typeof PRODUCT_CATEGORIES)[number], readonly string[]>
> = {
  Printer: [
    "Printer Head Issue",
    "Printer Cutter Issue",
    "Printer Motherboard Issue",
    "Printer Blade Issue",
    "USB Port Not Working",
    "Printer IP Address Not Pinging",
    "Adaptor Not Working",
    "Other",
  ],
  "POS Machine": [
    "Not Powering On",
    "Windows Not Booting",
    "SSD Not Showing",
    "Overheating",
    "Display Issue",
    "Touch Not Working",
    "System On But No Display",
    "Adaptor Not Working",
    "Power Button Issue",
    "Other",
  ],
  "Cash Drawer": [
    "Key Set Issue",
    "Tray Broken",
    "Cable Issue",
    "Cash Drawer Motor Issue",
    "Other",
  ],
  Kiosk: [
    "Display Issue",
    "Touch Issue",
    "HDMI Cable Issue",
    "Touch Cable Issue",
    "Display Adaptor Issue",
    "Extension Box Issue",
    "Other",
  ],
};

/** The issue categories to offer for a product category. */
export function issueCategoriesFor(product?: string | null): readonly string[] {
  return (
    (product && ISSUE_CATEGORIES_BY_PRODUCT[product as (typeof PRODUCT_CATEGORIES)[number]]) ||
    ISSUE_CATEGORIES
  );
}

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const PREFERRED_CONTACT_TIMES = [
  "Morning (9 AM - 12 PM)",
  "Afternoon (12 PM - 4 PM)",
  "Evening (4 PM - 8 PM)",
  "Anytime",
] as const;

// Indian states - feel free to trim if you operate in fewer regions.
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Chandigarh",
  "Puducherry",
  "Andaman and Nicobar Islands",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep",
] as const;
