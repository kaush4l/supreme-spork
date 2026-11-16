/**
 * The Content-Security-Policy for one response, built around a per-request nonce (Next.js docs: content-security-policy).
 * Scripts: only this origin and the nonce, with `strict-dynamic` so the framework's own scripts load. Everything
 * else is closed: no plugins, no framing, forms and base only to this origin.
 *
 * Styles: `<style>` elements and stylesheets need the nonce or this origin (Astryx loads its theme as a constructable
 * stylesheet, which this allows); only style *attributes* are open, because Astryx writes component props as inline
 * custom properties. Checked in Chrome on 2026-11-15 (`tests/e2e/csp.spec.ts`).
 */
/**
 * The one `<style>` that Astryx's popover layer (pickers, menus, dialogs) adds at runtime with no nonce, allowed by its
 * hash (as Chrome reports it) so nothing else gets in. If Astryx is upgraded and the content changes, the browser tests
 * (`access.spec.ts`, "no CSP errors") fail with the new hash: update it here.
 */
const ASTRYX_LAYER_STYLE_HASHES = [
  "'sha256-/i2+VVt2qoVh0Ag9OWwyc9593DCZeYGAv6SliqVbheY='",
  // Added when the phone-width layout (bottom sheets, mobile navigation) showed a second fixed style.
  "'sha256-Z5XTK23DFuEMs0PwnyZDO9SWxemQ5HxcpVaBNuUJyWY='",
];

export function buildCsp(
  nonce: string,
  options: { dev: boolean; imgSources?: string[]; frameSources?: string[] },
): string {
  const { dev, imgSources = [], frameSources = [] } = options;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}' ${ASTRYX_LAYER_STYLE_HASHES.join(" ")}${dev ? " 'unsafe-inline'" : ""}`,
    // Astryx sets component props such as maxWidth as inline custom properties (`style="--x-maxWidth:560px"`).
    // Style attributes cannot run script; `<style>` elements stay nonce-only above.
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' blob: data: ${imgSources.join(" ")}`.trim(),
    "font-src 'self'",
    // `strict-dynamic` makes script-src ignore 'self', and a worker falls back to script-src: allow the service worker
    // (/sw.js) and the web app manifest by name.
    "worker-src 'self'",
    "manifest-src 'self'",
    "connect-src 'self'",
    frameSources.length > 0
      ? `frame-src ${frameSources.join(" ")}`
      : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function newNonce(): string {
  return btoa(crypto.randomUUID());
}
