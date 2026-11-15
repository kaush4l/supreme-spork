/**
 * Where sign-out lands for one moment (ASVS 14.3.1): the response tells the browser to drop what it kept for this site
 * (cached pages and stored data), then the page sends the person on to sign in. `cookies` is left out on purpose:
 * the session cookies are already cleared by the sign-out itself, and clearing them here would race with it.
 * A meta refresh is used because a redirect response is not a reliable place for this header and scripts are not allowed.
 */
export function GET() {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta http-equiv="refresh" content="0;url=/sign-in">' +
      "<title>Signed out</title></head><body>" +
      '<p>You are signed out. <a href="/sign-in">Sign in again</a></p></body></html>',
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Clear-Site-Data": '"cache", "storage"',
        "Cache-Control": "no-store",
      },
    },
  );
}
