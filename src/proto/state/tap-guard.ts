/**
 * Ghost-tap mitigation (phone). A double tap on a dialog's confirm button closes the dialog on the first tap, so the
 * second tap lands on whatever is underneath, which on phone is the bottom navigation (observed: double click on
 * "Publish roster" navigated to Team). Least invasive fix: when a confirming action starts, arm a short-lived
 * document-level capture listener that swallows clicks aimed at the Primary navigation for a few hundred ms.
 * No overlay element, no change to dialog markup; the guard removes itself, so normal navigation is unaffected.
 */
const GUARD_MS = 700;

export function armTapGuard(ms: number = GUARD_MS): void {
  if (typeof document === "undefined") return;
  const swallow = (e: Event) => {
    const t = e.target as Element | null;
    if (t?.closest?.('nav[aria-label="Primary"]')) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const types = ["click", "pointerup", "touchend"];
  for (const k of types) document.addEventListener(k, swallow, true);
  setTimeout(() => {
    for (const k of types) document.removeEventListener(k, swallow, true);
  }, ms);
}
