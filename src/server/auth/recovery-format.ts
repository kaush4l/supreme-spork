/** Recovery codes are lowercase letters and digits with no separators; people read and type them in groups. */

/** `abcdefghijklmnop` becomes `abcd-efgh-ijkl-mnop` for showing. */
export function showCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? [code]).join("-");
}

/** What a person types, cleaned for the login service: no spaces or dashes, lowercase. */
export function cleanCode(typed: string): string {
  return typed.replace(/[\s-]/g, "").toLowerCase();
}

/** Letters a to z and digits 2 to 7 (base32), 13 to 32 long, once cleaned. */
export function looksLikeCode(typed: string): boolean {
  return /^[a-z2-7]{13,32}$/.test(cleanCode(typed));
}
