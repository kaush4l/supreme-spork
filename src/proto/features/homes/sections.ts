import type { Scenario, SectionResult } from "../../types";

/** After the user presses "Finish loading" the 'loading' scenario renders as 'default'. */
export function effectiveScenario(
  scenario: Scenario,
  loadingReleased: boolean,
): Scenario {
  return scenario === "loading" && loadingReleased ? "default" : scenario;
}

/**
 * Picks what one section shows. While the scenario is still delaying every section is loading. A retried section
 * that failed is replaced by its default-scenario result (the simulated retry succeeded); other sections keep
 * whatever they had, so one failure never blanks its siblings.
 */
export function pickSection<T>(
  ready: boolean,
  base: SectionResult<T>,
  fallback: SectionResult<T>,
  retried: boolean,
): SectionResult<T> {
  if (!ready) return { status: "loading" };
  if (retried && base.status === "error") return fallback;
  return base;
}

/** Same scenario semantics as the home fixtures, for lists owned by this package. */
export function sectionFor<T>(
  scenario: Scenario,
  build: () => T,
): SectionResult<T> {
  if (scenario === "loading") return { status: "loading" };
  if (scenario === "denied")
    return {
      status: "denied",
      message: "You do not have access to this section (simulated).",
    };
  if (scenario === "error")
    return {
      status: "error",
      message:
        "This section could not be loaded (simulated). Other sections are unaffected.",
    };
  return { status: "ok", data: build() };
}
