/** Plain labels for the API's bill kinds and cadences (the API sends the codes; state words come with their own label). */
export const KIND_OPTIONS = [
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Power, water, gas" },
  { value: "insurance", label: "Insurance" },
  { value: "loan", label: "Loan" },
  { value: "super", label: "Super" },
  { value: "ato", label: "Tax (ATO)" },
  { value: "supplier", label: "Supplier" },
  { value: "other", label: "Other" },
];

export const CADENCE_OPTIONS = [
  { value: "weekly", label: "Every week" },
  { value: "fortnightly", label: "Every two weeks" },
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every three months" },
];

export const kindLabel = (kind: string) =>
  KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind;
export const cadenceLabel = (c: string) =>
  CADENCE_OPTIONS.find((k) => k.value === c)?.label ?? c;
