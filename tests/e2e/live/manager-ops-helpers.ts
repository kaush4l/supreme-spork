/** Helpers for the manager approvals, timesheet and checklist specs. */
import { expect, type Page } from "@playwright/test";

/**
 * Like watchForBrowserErrors, but ignores the Next.js dev overlay and the Astryx Layer (popover) chunk, both known to set inline styles (next-devtools applies inline styles that the strict
 * CSP blocks in `bun run dev` only). Any CSP violation from the app's own code still fails the test.
 */
export function watchCsp(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /Refused to|Content Security/i.test(m.text()) &&
      !/next-devtools|astryxdesign_core_dist_Layer/.test(m.location().url)
    )
      problems.push(
        `${m.text().slice(0, 120)} @ ${JSON.stringify(m.location())}`,
      );
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  return { expectNone: () => expect(problems, "browser errors").toEqual([]) };
}
