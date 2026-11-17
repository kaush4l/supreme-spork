import type { Capability, Persona, PersonaId } from "../types";

const managerCore: Capability[] = [
  "ops.manage",
  "roster.edit",
  "docket.upload",
];

export const personas: Record<PersonaId, Persona> = {
  owner: {
    id: "owner",
    label: "Olivia Owner",
    roleLabel: "Owner",
    capabilities: [
      "venue.home.owner",
      "ops.manage",
      "roster.edit",
      "money.overview",
      "money.dockets.review",
      "money.dockets.read",
      "money.labour.aggregate",
      "cash.record",
      "docket.upload",
      "announcements.compose",
    ],
    venueIds: ["v-harbour", "v-perth", "v-empty"],
    modes: ["management"],
    recipientId: "u-owner",
  },
  partner: {
    id: "partner",
    label: "Pat Partner",
    roleLabel: "Partner",
    capabilities: [
      "venue.home.owner",
      "ops.manage",
      "money.overview",
      "money.dockets.review",
      "money.dockets.read",
      "money.labour.aggregate",
      "announcements.compose",
    ],
    venueIds: ["v-harbour", "v-perth"],
    modes: ["management"],
    recipientId: "u-partner",
  },
  "manager-money": {
    id: "manager-money",
    label: "Mia Manager (money)",
    roleLabel: "Manager with money rights",
    capabilities: [
      ...managerCore,
      "money.overview",
      "money.dockets.review",
      "money.dockets.read",
      "cash.record",
      "announcements.compose",
    ],
    venueIds: ["v-harbour"],
    modes: ["management"],
    recipientId: "u-manager-money",
  },
  manager: {
    id: "manager",
    label: "Max Manager",
    roleLabel: "Manager (no money rights)",
    // cash.record alone does NOT expose money.overview.
    capabilities: [...managerCore, "cash.record", "announcements.compose"],
    venueIds: ["v-harbour"],
    modes: ["management"],
    recipientId: "u-manager",
  },
  staff: {
    id: "staff",
    label: "Sam Staff",
    roleLabel: "Staff",
    capabilities: ["docket.upload", "staff.today"],
    venueIds: ["v-harbour"],
    modes: ["staff"],
    recipientId: "u-staff",
  },
  bookkeeper: {
    id: "bookkeeper",
    label: "Bea Bookkeeper",
    roleLabel: "Bookkeeper",
    // Aggregate labour only: no named pay, no money.overview, no ops.
    capabilities: ["money.dockets.read", "money.labour.aggregate"],
    venueIds: ["v-harbour", "v-perth"],
    modes: ["management"],
    recipientId: "u-bookkeeper",
  },
  multi: {
    id: "multi",
    label: "Morgan Multi",
    roleLabel: "Worker and manager",
    capabilities: [...managerCore, "staff.today", "cash.record"],
    venueIds: ["v-harbour", "v-perth"],
    modes: ["staff", "management"],
    recipientId: "u-multi",
  },
};

export function getPersona(id: PersonaId): Persona {
  return personas[id];
}

export function can(p: Persona, cap: Capability): boolean {
  return p.capabilities.includes(cap);
}
