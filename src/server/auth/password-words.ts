/**
 * A password may not be built from the product's own words or the person's own email (ASVS 6.1.2, 6.2.11). The login
 * service checks length and the leaked-password list; it has no list of words about this product, so this is checked
 * here, before the call. The words below are the whole list (also written in `minder-pass-documents/security`).
 * The check ignores case, spaces and punctuation, and reads common digit and symbol swaps (`0` for o, `3` for e...).
 */
export const PRODUCT_WORDS = [
  "minder",
  "minderpass",
  "thepass",
  "restaurant",
  "hospitality",
  "roster",
  "timesheet",
  "checklist",
  "password",
] as const;

const SWAPS: Record<string, string> = {
  "0": "o",
  "1": "i", // `1` stands for i or l; the check reads both (see `variants`)
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

/** Lower case, swaps undone, everything but letters and digits dropped. `one` is what `1` and `!` stand for. */
export function normalise(text: string, one: "i" | "l" = "i"): string {
  let out = "";
  for (const ch of text.toLowerCase())
    out += ch === "1" || ch === "!" ? one : (SWAPS[ch] ?? ch);
  return out.replace(/[^a-z0-9]/g, "");
}

/** The parts of an email worth refusing: the name before the @ and the first part of the domain (4 letters or more). */
function emailWords(email: string | undefined): string[] {
  if (!email) return [];
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  return [local, domain.split(".")[0] ?? ""]
    .map((w) => normalise(w))
    .filter((w) => w.length >= 4);
}

/** A plain-words reason to refuse the password, or null when it is fine. */
export function contextWordProblem(
  password: string,
  email?: string,
): string | null {
  const said = [normalise(password, "i"), normalise(password, "l")];
  const banned = [
    ...PRODUCT_WORDS.map((w) => normalise(w)),
    ...emailWords(email),
  ];
  if (banned.some((word) => said.some((one) => one.includes(word))))
    return "That password uses a word from this app or from your own email. Choose something less guessable.";
  return null;
}

/**
 * The login service hashes only the first 72 bytes of a password and ignores the rest (ASVS 6.2.8): a longer attempt would
 * match a shorter stored one. So a password longer than that is refused when it is set, and a sign-in attempt longer than
 * that is refused without asking the login service.
 */
export const MAX_PASSWORD_BYTES = 72;

export function fitsHashLimit(password: string): boolean {
  return new TextEncoder().encode(password).length <= MAX_PASSWORD_BYTES;
}
