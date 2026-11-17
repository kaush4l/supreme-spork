import type { StaffMember } from "../types";
import { mulberry32, pick } from "./prng";

const first = [
  "Aiko",
  "Bao",
  "Callum",
  "Dimitra",
  "Eleni",
  "Farid",
  "Grace",
  "Hamid",
  "Isla",
  "Jonty",
  "Kavya",
  "Liam",
  "Mei",
  "Nikolai",
  "Odette",
  "Priya",
  "Quinn",
  "Rafael",
  "Saoirse",
  "Tomasz",
  "Uma",
  "Viktor",
  "Wen",
  "Ximena",
  "Yusuf",
  "Zara",
  "Amara",
  "Bruno",
  "Chloe",
  "Dev",
];
const last = [
  "Nguyen",
  "Papadopoulos",
  "O'Sullivan",
  "Fernandez",
  "Kowalczyk",
  "Abdelrahman",
  "Singh",
  "Tanaka",
  "Johnson",
  "McAllister",
  "Rahman",
  "Costa",
  "Lindqvist",
  "Okafor",
  "Petrov",
  "Chen",
  "Williams",
  "Haddad",
];
const roles = [
  "Chef",
  "Cook",
  "Waiter",
  "Bartender",
  "Kitchen hand",
  "Host",
  "Barista",
  "Supervisor",
];

const longNames = [
  "Alexandria Wilhelmina Konstantinopoulos-Featherstonehaugh",
  "Maximilian Bartholomew Rutherford-Calderbank the Third",
  "Seraphina Oluwadamilola Ogunbanjo-Vanderwesthuizen",
  "Christopher Jean-Baptiste Montgomery-Whittingtonshire",
  "Anastasia Guadalupe Hernandez-Villanueva de la Cruz",
];

function build(): StaffMember[] {
  const rng = mulberry32(250);
  const out: StaffMember[] = [];
  for (let i = 1; i <= 250; i++) {
    const long = i % 50 === 7 ? longNames[Math.floor(i / 50)] : undefined;
    const name = long ?? `${pick(rng, first)} ${pick(rng, last)}`;
    out.push({
      id: `s-${String(i).padStart(3, "0")}`,
      // Suffix index keeps names unique and searchable.
      name: long ?? `${name} ${i}`,
      role: pick(rng, roles),
    });
  }
  return out;
}

/** Exactly 250 deterministic synthetic staff, incl. five very long names. */
export const staff: StaffMember[] = build();
