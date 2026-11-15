"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (target: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * The Cloudflare Turnstile widget. The script is added with this request's nonce, so the page's policy allows it and
 * nothing else; the answer goes in a hidden field named `captchaToken` and is checked by the login service, never here.
 * The widget needs a plain element to draw into, which is why this one component uses a raw element.
 */
export function Turnstile({
  siteKey,
  nonce,
  onToken,
}: {
  siteKey: string;
  nonce?: string;
  onToken: (token: string) => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    let widget: string | undefined;
    let cancelled = false;
    const draw = () => {
      if (cancelled || !target.current || !window.turnstile) return;
      widget = window.turnstile.render(target.current, {
        sitekey: siteKey,
        callback: (value: string) => {
          setToken(value);
          onToken(value);
        },
        "expired-callback": () => {
          setToken("");
          onToken("");
        },
        "error-callback": () => {
          setToken("");
          onToken("");
        },
      });
    };
    if (window.turnstile) {
      draw();
    } else {
      let script = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT}"]`,
      );
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT;
        script.async = true;
        if (nonce) script.nonce = nonce;
        document.head.appendChild(script);
      }
      script.addEventListener("load", draw);
    }
    return () => {
      cancelled = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [siteKey, nonce, onToken]);

  return (
    <>
      <div ref={target} />
      <input type="hidden" name="captchaToken" value={token} readOnly />
    </>
  );
}
