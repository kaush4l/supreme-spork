/** Other spellings typed one per line or separated by commas: trimmed, blanks dropped, repeats dropped. */
export function parseAliases(text: string): string[] {
  const parts = text
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  return [...new Set(parts)];
}

export function aliasesText(aliases: string[]): string {
  return aliases.join("\n");
}
