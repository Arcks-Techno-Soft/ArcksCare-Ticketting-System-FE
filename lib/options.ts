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
  "Other",
] as const;

export const ISSUE_CATEGORIES = [
  "Not Powering On",
  "Display Issue",
  "Printing Issue",
  "Connectivity",
  "Software Crash",
  "Physical Damage",
  "Other",
] as const;

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
