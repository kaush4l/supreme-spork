"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useCallback, useEffect, useRef, useState } from "react";
import { removePushSubscription, savePushSubscription } from "./actions";
import {
  canToggle,
  isIos,
  type PushFacts,
  type PushView,
  pushView,
  storageKey,
  urlBase64ToUint8Array,
  VIEW_WORDS,
} from "./push-state";

const WORKER = "/sw.js";

function readId(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeId(key: string, id: string) {
  try {
    window.localStorage.setItem(key, id);
  } catch {
    // Private window or blocked storage: the switch still works until the page is closed.
  }
}
function clearId(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

function isSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isStandalone(): boolean {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch {
    // Old browser without matchMedia.
  }
  return (navigator as { standalone?: boolean }).standalone === true;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.getRegistration(WORKER);
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/**
 * "Alerts on this phone". The browser parts (permission, service worker, push subscription) live here; the server
 * decides who is notified and what the alert says. We only sign this phone up or off.
 */
export function AlertsCard({
  userId,
  publicKey,
}: {
  userId: string;
  publicKey: string | null;
}) {
  const key = storageKey(userId);
  const [view, setView] = useState<PushView | "checking">("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  const refresh = useCallback(async () => {
    const supported = isSupported();
    const facts: PushFacts = {
      supported,
      permission: supported ? Notification.permission : "default",
      standalone: isStandalone(),
      ios: isIos(navigator.userAgent, navigator.maxTouchPoints),
      serverReady: publicKey !== null,
      subscribed: false,
    };
    // On means we hold the id the server gave AND the browser still has the subscription.
    if (supported && readId(key) && (await currentSubscription()))
      facts.subscribed = true;
    setView(pushView(facts));
  }, [key, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const turnOn = async () => {
    if (!publicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      await refresh();
      return;
    }
    await navigator.serviceWorker.register(WORKER);
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    const json = subscription.toJSON();
    const result = await savePushSubscription({
      endpoint: json.endpoint ?? subscription.endpoint,
      keys: {
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      },
    });
    if (!result.ok) {
      // Do not leave the browser signed up when the server did not accept it.
      if (!existing) await subscription.unsubscribe().catch(() => false);
      setMessage(result.error.message);
      await refresh();
      return;
    }
    writeId(key, result.data.id);
    await refresh();
  };

  const turnOff = async () => {
    const id = readId(key);
    const subscription = await currentSubscription();
    if (subscription) await subscription.unsubscribe().catch(() => false);
    clearId(key);
    if (id) {
      const result = await removePushSubscription({ id });
      if (!result.ok) {
        setMessage(
          `Turned off on this phone, but we could not tell the server: ${result.error.message}`,
        );
      }
    }
    await refresh();
  };

  const change = async (on: boolean) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await (on ? turnOn() : turnOff());
    } catch {
      setMessage("Something went wrong on this phone. Please try again.");
      await refresh();
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const toggle = view !== "checking" && canToggle(view);
  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Alerts on this phone</Heading>
          {toggle ? (
            <Switch
              label="Alerts on this phone"
              description={VIEW_WORDS[view]}
              value={view === "on"}
              isDisabled={busy}
              onChange={(checked: boolean) => void change(checked)}
            />
          ) : (
            <Text type="body">
              {view === "checking" ? "Checking…" : VIEW_WORDS[view]}
            </Text>
          )}
          <Text type="supporting" color="secondary">
            This only turns alerts on or off for this phone. Your other devices
            are separate.
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}
