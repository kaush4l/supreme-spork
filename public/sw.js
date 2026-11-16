/* Minder service worker: shows a push and opens the venue page on tap. Nothing else.
 * The push carries {title, body, url} only. This file adds no pay figure or other data of its own. */

const ICON = "/icon-192.png";

/** A same-origin path that starts with /venues/, or "/" for anything else. */
function safeUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048)
    return "/";
  if (value[0] !== "/" || value[1] === "/" || value.includes("\\")) return "/";
  try {
    const parsed = new URL(value, self.location.origin);
    if (parsed.origin !== self.location.origin) return "/";
    if (!parsed.pathname.startsWith("/venues/")) return "/";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/";
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  if (data === null || typeof data !== "object") data = {};
  const title =
    typeof data.title === "string" && data.title ? data.title : "Minder";
  const body = typeof data.body === "string" ? data.body : "";
  const url = safeUrl(data.url);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: ICON,
      // One notification per venue page: a repeat replaces the one on screen.
      tag: url,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data?.url);
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client && "navigate" in client) {
            return client
              .focus()
              .then((focused) => (focused || client).navigate(url));
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
