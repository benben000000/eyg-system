"use client";

/**
 * ONLINE / OFFLINE STATUS
 * ============================================================================
 * SSR-safe: starts as `true` so the server and the first client render agree,
 * then corrects itself after mount from `navigator.onLine`.
 *
 * Used by the booking form to degrade to a *designed* offline state with the
 * phone number, instead of letting a submit fail silently.
 * ============================================================================
 */
import { useEffect, useState } from "react";

export interface OnlineStatus {
  /** `false` only once we know for sure we are offline. */
  isOnline: boolean;
  /** `false` until after mount — during SSR this is "unknown". */
  isReady: boolean;
  /** Milliseconds since the connection dropped. 0 while online. */
  offlineForMs: number;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      const online = navigator.onLine !== false;
      setIsOnline(online);
      setOfflineSince(online ? null : Date.now());
      setNow(Date.now());
    };
    read();
    setIsReady(true);

    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  // A 10s heartbeat so "offline for 4 minutes" stays true without re-rendering
  // on every frame. Cleared on unmount.
  useEffect(() => {
    if (isOnline || !isReady) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [isOnline, isReady]);

  const offlineForMs = !isOnline && offlineSince !== null && now !== null ? now - offlineSince : 0;

  return { isOnline, isReady, offlineForMs };
}