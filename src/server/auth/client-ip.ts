/**
 * The address a person's request really came from, passed to the login service in `X-Minder-Client-IP` so it can limit
 * sign-in attempts per address (and not per this server, which every person shares). It is read from the header our own
 * proxy sets (`x-real-ip`, else the first `x-forwarded-for` hop). That is only true behind the proxy: the proxy must
 * overwrite both headers, never append to what a client sent (runbooks/deployment.md). A value that is not an IP address
 * is never forwarded.
 */
const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]{2,45}$/;

export function clientAddress(headers: {
  get(name: string): string | null;
}): string | null {
  const real = headers.get("x-real-ip")?.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  for (const candidate of [real, forwarded]) {
    if (
      candidate &&
      (IPV4.test(candidate) ||
        (candidate.includes(":") && IPV6.test(candidate)))
    )
      return candidate;
  }
  return null;
}
