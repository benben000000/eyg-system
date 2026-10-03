"use client";

/**
 * COUNTDOWN TO A FIXED INSTANT — server-time-offset aware.
 * ============================================================================
 * The hard requirement: a countdown must not be gameable by changing the device
 * clock, and it must not jump between the server's UTC clock and the browser's
 * local clock.
 *
 * HOW THE OFFSET WORKS
 *  The caller (a Server Component) passes `serverNowMs`, captured at the moment
 *  the HTML was produced. We compute `offset = serverNowMs - Date.now()` once
 *  per mount and then advance with `performance.now()`, which is monotonic.
 *  From then on the countdown is driven by elapsed monotonic time, so changing
 *  the device clock mid-countdown cannot move the target. If no server time is
 *  supplied the browser clock is used, which is still correct — just less
 *  tamper-resistant.
 *
 * OTHER INVARIANTS
 *  - Never resets on reload: the target is an absolute instant.
 *  - Never shows a negative number: `remainingMs` is clamped at 0.
 *  - `onExpire` fires exactly once per target.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface CountdownOptions {
  /** Called once when the target is reached. */
  onExpire?: () => void;
  /** `Date.now()` from the server render, for a tamper-resistant offset. */
  serverNowMs?: number | undefined;
  /** Tick period in ms. Default 1000. */
  intervalMs?: number;
  /**
   * Injectable clock. Supplying this makes the whole hook deterministic, which
   * is what the test suite needs — without it the timer has to be polled against
   * the wall clock and the assertions become flaky by construction.
   */
  now?: (() => number) | undefined;
}

export interface CountdownResult {
  /** Always ≥ 0. */
  remainingMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Alias of `seconds`, for callers that read better with the longer name. */
  secondsLeft: number;
  /** Pre-formatted, never negative: "2d 04h 11m" / "04h 11m 07s" / "Ended". */
  label: string;
  isExpired: boolean;
  /** `true` once the interval is running — lets callers reserve width. */
  isRunning: boolean;
  /** Recompute immediately (used when a backgrounded tab becomes visible). */
  refresh: () => void;
}

/** Ticks once per second; a timer that drifts is a timer that lies. */
const DEFAULT_TICK_MS = 1000;

function normaliseTarget(target: string | number | Date | null | undefined): number | null {
  if (target === null || target === undefined || target === "") return null;
  const ms =
    target instanceof Date
      ? target.getTime()
      : typeof target === "number"
        ? target
        : Date.parse(target);
  return Number.isFinite(ms) ? ms : null;
}

function decompose(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function useCountdown(
  target: string | number | Date | null | undefined,
  options: CountdownOptions = {},
): CountdownResult {
  const targetMs = useMemo(() => normaliseTarget(target), [target]);
  const { onExpire, serverNowMs, intervalMs = DEFAULT_TICK_MS, now } = options;

  // Anchor captured once per mount. `performance.now()` is monotonic, so the
  // countdown cannot be stretched by moving the device clock.
  const anchorRef = useRef<{ perf: number; wallClock: number } | null>(null);

  const monotonicNow = useCallback((): number => {
    // An injected clock wins outright: the caller has asked for determinism.
    if (now) return now();
    const anchor = anchorRef.current;
    if (anchor && typeof performance !== "undefined") {
      return anchor.wallClock + (performance.now() - anchor.perf);
    }
    return Date.now();
  }, [now]);

  const initial = useMemo(
    () => (targetMs === null ? 0 : Math.max(0, targetMs - (now ? now() : Date.now()))),
    [targetMs, now],
  );
  const [remainingMs, setRemainingMs] = useState(initial);
  const [isRunning, setIsRunning] = useState(false);

  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const lastTargetRef = useRef(targetMs);

  useEffect(() => {
    // New target → arm the expiry edge again.
    if (lastTargetRef.current !== targetMs) {
      lastTargetRef.current = targetMs;
      expiredRef.current = false;
      setRemainingMs(targetMs === null ? 0 : Math.max(0, targetMs - (now ? now() : Date.now())));
    }
  }, [targetMs, now]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const wallClock = now
      ? now()
      : serverNowMs !== undefined && Number.isFinite(serverNowMs)
        ? Date.now() + (serverNowMs - Date.now())
        : Date.now();
    anchorRef.current = {
      perf: typeof performance !== "undefined" ? performance.now() : 0,
      wallClock,
    };

    if (targetMs === null) {
      setIsRunning(false);
      return;
    }

    const tick = () => {
      const left = Math.max(0, targetMs - monotonicNow());
      setRemainingMs(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
    };

    tick();
    setIsRunning(true);
    const id = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      anchorRef.current = null;
      setIsRunning(false);
    };
  }, [targetMs, monotonicNow, serverNowMs, intervalMs, now]);

  const refresh = useCallback(() => {
    if (targetMs === null) {
      setRemainingMs(0);
      return;
    }
    setRemainingMs(Math.max(0, targetMs - monotonicNow()));
  }, [targetMs, monotonicNow]);

  const parts = decompose(remainingMs);

  return {
    remainingMs,
    days: parts.days,
    hours: parts.hours,
    minutes: parts.minutes,
    seconds: parts.seconds,
    secondsLeft: parts.seconds,
    label: formatCountdown({
      days: parts.days,
      hours: parts.hours,
      minutes: parts.minutes,
      seconds: parts.seconds,
      isExpired: targetMs === null ? true : remainingMs <= 0,
    }),
    isExpired: targetMs === null ? true : remainingMs <= 0,
    isRunning,
    refresh,
  };
}

/** "2d 04h 11m" / "04h 11m 07s". Never negative. */
export function formatCountdown(d: Pick<CountdownResult, "days" | "hours" | "minutes" | "seconds" | "isExpired">): string {
  if (d.isExpired) return "Ended";
  if (d.days > 0) return `${d.days}d ${pad(d.hours)}h ${pad(d.minutes)}m`;
  return `${pad(d.hours)}h ${pad(d.minutes)}m ${pad(d.seconds)}s`;
}

/** Spoken form for assistive tech and `title` attributes. */
export function speakCountdown(d: CountdownResult): string {
  if (d.isExpired) return "Offer ended";
  const parts: string[] = [];
  if (d.days > 0) parts.push(`${d.days} ${d.days === 1 ? "day" : "days"}`);
  if (d.hours > 0) parts.push(`${d.hours} ${d.hours === 1 ? "hour" : "hours"}`);
  if (d.days === 0) parts.push(`${d.minutes} ${d.minutes === 1 ? "minute" : "minutes"}`);
  return `${parts.join(", ")} remaining`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}