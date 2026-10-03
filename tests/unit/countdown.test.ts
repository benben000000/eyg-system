/**
 * QA & SECURITY AGENT — countdown timer.
 * ============================================================================
 * Contract under test: `useCountdown`, `formatCountdown`, `speakCountdown` in
 * `src/hooks/useCountdown.ts`.
 *
 * `/deals` renders promotion expiry countdowns. The marketing playbook is
 * explicit — "No countdown timers that reset. No invented scarcity." A countdown
 * that renders negative (`"-1d 4h"`) is embarrassing; one that resets on every
 * re-render manufactures fake urgency, which is a trust failure *and* a
 * consumer-protection problem (PH DTI fair-advertising guidance on false
 * scarcity).
 *
 * The hook is tamper-resistant by design: it anchors to `serverNowMs` and then
 * advances on `performance.now()`, so a customer cannot move the target by
 * changing the device clock. Both timers are faked here, so every case is
 * deterministic — no wall-clock polling anywhere in this file.
 * ============================================================================
 */

import * as React from "react";
import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatCountdown,
  speakCountdown,
  useCountdown,
  type CountdownResult,
} from "@/hooks/useCountdown";

// ── Harness ─────────────────────────────────────────────────────────────────

let container: HTMLDivElement | null = null;
let root: Root | null = null;

interface Probe {
  latest: CountdownResult | null;
  renders: number;
  /** Re-render the host component without touching the hook's props. */
  bump: () => void;
}

/** Mounts a component that calls `useCountdown` and records every render. */
function mount(
  target: string | number | Date | null | undefined,
  options: Parameters<typeof useCountdown>[1] = {},
): Probe {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  const probe: Probe = {
    latest: null,
    renders: 0,
    bump: () => {
      if (container) {
        act(() => {
          root!.render(React.createElement(Host, { probe }));
        });
      }
    },
  };

  function Host(): React.ReactElement {
    const [, force] = useState(0);
    probe.bump = () => {
      act(() => {
        force((n) => n + 1);
      });
    };
    const value = useCountdown(target, options);
    probe.latest = value;
    probe.renders += 1;
    return React.createElement("output", null, String(value.remainingMs));
  }

  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    root!.render(React.createElement(Host));
  });
  return probe;
}

function unmount(): void {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
  delete (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT;
}

/** Advance the faked clock AND `performance.now()` together. */
function tick(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const PINNED = Date.parse("2026-10-02T09:00:00Z");

/** Fake `Date`, `performance` and timers so the countdown is fully deterministic. */
function usePinnedClock(): void {
  vi.useFakeTimers({
    toFake: ["Date", "performance", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
  vi.setSystemTime(PINNED);
}

afterEach(() => {
  unmount();
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("countdown — never goes negative", () => {
  it("remainingMs is >= 0 at every tick, including well past expiry", () => {
    usePinnedClock();
    const probe = mount(PINNED + 180_000, { serverNowMs: PINNED });
    const observed: number[] = [];
    for (let i = 0; i < 400; i += 1) {
      tick(1000);
      if (probe.latest) observed.push(probe.latest.remainingMs);
    }
    expect(observed.length).toBeGreaterThan(100);
    expect(Math.min(...observed)).toBe(0);
    expect(probe.latest!.remainingMs).toBe(0);
  });

  it("decomposed parts are never negative", () => {
    usePinnedClock();
    const probe = mount(PINNED - 500_000, { serverNowMs: PINNED });
    for (let i = 0; i < 5; i += 1) {
      tick(1000);
      const value = probe.latest!;
      for (const part of [value.days, value.hours, value.minutes, value.seconds]) {
        expect(part).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(part)).toBe(true);
      }
      expect(value.isExpired).toBe(true);
    }
  });

  it("formatCountdown never renders a negative component", () => {
    usePinnedClock();
    const probe = mount(PINNED - 86_400_000, { serverNowMs: PINNED });
    tick(1000);
    const label = formatCountdown(probe.latest!);
    expect(label).toBe("Ended");
    expect(label).not.toMatch(/-\d/);
    expect(speakCountdown(probe.latest!)).toBe("Offer ended");
  });
});

describe("countdown — a past endsAt", () => {
  it("is expired on the FIRST tick, not after a full day", () => {
    usePinnedClock();
    const probe = mount("2020-01-01T00:00:00+08:00", { serverNowMs: PINNED });
    expect(probe.latest!.isExpired, "a past target must be expired on mount").toBe(true);
    expect(probe.latest!.remainingMs).toBe(0);
    expect(probe.latest!.days).toBe(0);
  });

  it("treats null and undefined as expired rather than crashing", () => {
    usePinnedClock();
    for (const target of [null, undefined, "", Number.NaN]) {
      const probe = mount(target, { serverNowMs: PINNED });
      expect(probe.latest!.isExpired, String(target)).toBe(true);
      expect(probe.latest!.remainingMs).toBe(0);
      unmount();
    }
  });

  it("treats an unparseable string as expired rather than NaN", () => {
    usePinnedClock();
    const probe = mount("not-a-date", { serverNowMs: PINNED });
    expect(probe.latest!.isExpired).toBe(true);
    expect(probe.latest!.remainingMs).toBe(0);
    expect(formatCountdown(probe.latest!)).toBe("Ended");
  });
});

describe("countdown — onExpire fires exactly once", () => {
  it("fires once and not again on later ticks", () => {
    usePinnedClock();
    let fired = 0;
    const probe = mount(PINNED + 10_000, {
      serverNowMs: PINNED,
      onExpire: () => {
        fired += 1;
      },
    });
    for (let i = 0; i < 30; i += 1) tick(1000);
    expect(fired).toBe(1);
    expect(probe.latest!.isExpired).toBe(true);
  });

  it("fires once even when the parent re-renders every second", () => {
    usePinnedClock();
    let fired = 0;
    const probe = mount(PINNED + 20_000, {
      serverNowMs: PINNED,
      onExpire: () => {
        fired += 1;
      },
    });
    // The classic double-fire bug: the effect re-arms on every render.
    for (let i = 0; i < 30; i += 1) {
      tick(1000);
      probe.bump();
    }
    expect(fired).toBe(1);
  });

  it("fires immediately for a target already in the past", () => {
    usePinnedClock();
    let fired = 0;
    mount(PINNED - 1000, {
      serverNowMs: PINNED,
      onExpire: () => {
        fired += 1;
      },
    });
    tick(1000);
    expect(fired).toBe(1);
  });

  it("does NOT fire for a target that is still in the future", () => {
    usePinnedClock();
    let fired = 0;
    mount(PINNED + 600_000, {
      serverNowMs: PINNED,
      onExpire: () => {
        fired += 1;
      },
    });
    for (let i = 0; i < 60; i += 1) tick(1000);
    expect(fired).toBe(0);
  });

  it("unmounting before expiry clears the interval and never fires", () => {
    usePinnedClock();
    let fired = 0;
    mount(PINNED + 600_000, {
      serverNowMs: PINNED,
      onExpire: () => {
        fired += 1;
      },
    });
    for (let i = 0; i < 120; i += 1) tick(1000);
    expect(fired).toBe(0);
  });

  it("re-arms when the target changes, and fires once for the NEW target", () => {
    usePinnedClock();
    const seen: string[] = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

    function Host(): React.ReactElement {
      const [target, setTarget] = useState(PINNED + 10_000);
      useEffect(() => {
        const id = setTimeout(() => setTarget(PINNED + 40_000), 15_000);
        return () => clearTimeout(id);
      }, []);
      const value = useCountdown(target, {
        serverNowMs: PINNED,
        onExpire: () => seen.push(`expired@${Math.round(value.remainingMs)}`),
      });
      return React.createElement("output", null, String(value.remainingMs));
    }
    act(() => {
      root!.render(React.createElement(Host));
    });
    for (let i = 0; i < 60; i += 1) tick(1000);
    // The first target expires once, the second target is re-armed exactly once.
    expect(seen.length).toBe(2);
  });
});

describe("countdown — never resets", () => {
  it("remainingMs is monotonically non-increasing across five minutes", () => {
    usePinnedClock();
    const probe = mount(PINNED + 300_000, { serverNowMs: PINNED });
    let previous = probe.latest?.remainingMs ?? Number.POSITIVE_INFINITY;
    for (let i = 0; i < 320; i += 1) {
      tick(1000);
      const current = probe.latest?.remainingMs ?? -1;
      expect(current, `remainingMs increased at tick ${i}`).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });

  it("a parent re-render with the same target does not jump the value", () => {
    usePinnedClock();
    const probe = mount(PINNED + 300_000, { serverNowMs: PINNED });
    for (let i = 0; i < 10; i += 1) {
      const before = probe.latest!.remainingMs;
      probe.bump();
      expect(probe.latest!.remainingMs, `re-render ${i} reset the countdown`).toBeLessThanOrEqual(before);
      tick(1000);
    }
  });

  it("the value tracks real elapsed time, not tick count", () => {
    usePinnedClock();
    const probe = mount(PINNED + 300_000, { serverNowMs: PINNED });
    tick(1000);
    const afterOne = probe.latest!.remainingMs;
    expect(afterOne).toBeLessThanOrEqual(300_000);
    expect(afterOne).toBeGreaterThan(295_000);
    for (let i = 0; i < 60; i += 1) tick(1000);
    expect(probe.latest!.remainingMs).toBeLessThanOrEqual(240_000);
  });
});

describe("countdown — tamper resistance", () => {
  it("the target is pinned to serverNowMs, not to the device clock", () => {
    usePinnedClock();
    // The browser clock is 5 hours behind the server's.
    vi.setSystemTime(PINNED - 18_000_000);
    const probe = mount(PINNED + 300_000, { serverNowMs: PINNED });
    expect(probe.latest!.remainingMs).toBeGreaterThan(290_000);
    tick(1000);
    expect(probe.latest!.remainingMs).toBeLessThanOrEqual(300_000);
  });

  it("moving the device clock forward cannot expire the offer early", () => {
    usePinnedClock();
    const probe = mount(PINNED + 300_000, { serverNowMs: PINNED });
    tick(1000);
    const before = probe.latest!.remainingMs;
    vi.setSystemTime(PINNED + 86_400_000); // device clock jumps a day forward
    tick(1000);
    expect(probe.latest!.remainingMs, "a device-clock change must not expire the timer").toBeGreaterThan(
      before - 5_000,
    );
    expect(probe.latest!.isExpired).toBe(false);
  });
});

describe("countdown — formatting", () => {
  it("formats days, hours, minutes and seconds without a negative sign", () => {
    expect(formatCountdown({ days: 2, hours: 4, minutes: 11, seconds: 5, isExpired: false })).toBe("2d 04h 11m");
    expect(formatCountdown({ days: 0, hours: 4, minutes: 11, seconds: 7, isExpired: false })).toBe("04h 11m 07s");
    expect(formatCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true })).toBe("Ended");
  });

  it("formatCountdown output never contains a minus sign", () => {
    const cases: Array<Pick<CountdownResult, "days" | "hours" | "minutes" | "seconds" | "isExpired">> = [
      { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true },
      { days: 0, hours: 1, minutes: 2, seconds: 3, isExpired: false },
      { days: 365, hours: 23, minutes: 59, seconds: 59, isExpired: false },
    ];
    for (const value of cases) {
      expect(formatCountdown(value)).not.toMatch(/-\d/);
    }
  });

  it("speakCountdown produces a screen-reader sentence, never a bare number", () => {
    const base: Omit<CountdownResult, "days" | "hours" | "minutes" | "seconds" | "isExpired"> = {
      remainingMs: 1_000,
      secondsLeft: 0,
      label: "live",
      isRunning: true,
      refresh: () => {},
    };
    expect(
      speakCountdown({ ...base, days: 1, hours: 2, minutes: 3, seconds: 4, isExpired: false }),
    ).toBe("1 day, 2 hours remaining");
    expect(
      speakCountdown({ ...base, days: 0, hours: 2, minutes: 1, seconds: 4, isExpired: false }),
    ).toBe("2 hours, 1 minute remaining");
    expect(
      speakCountdown({ ...base, remainingMs: 0, isRunning: false, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true }),
    ).toBe("Offer ended");
  });

  it("formatCountdown and speakCountdown never leak undefined/NaN", () => {
    usePinnedClock();
    const probe = mount(PINNED + 61_000, { serverNowMs: PINNED });
    for (let i = 0; i < 3; i += 1) {
      tick(1000);
      for (const label of [formatCountdown(probe.latest!), speakCountdown(probe.latest!)]) {
        expect(label).toBeTruthy();
        expect(label).not.toMatch(/undefined|NaN/);
      }
    }
  });
});

describe("countdown — visibility", () => {
  it("never shows stale time when a backgrounded tab returns", () => {
    usePinnedClock();
    const probe = mount(PINNED + 300_000, { serverNowMs: PINNED });
    tick(1000);
    const before = probe.latest!.remainingMs;
    expect(before).toBeGreaterThan(290_000);

    // A suspended tab: the interval is throttled away for the whole offer.
    act(() => {
      vi.advanceTimersByTime(300_000);
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(probe.latest!.isExpired, "returning to the tab must show 'Ended', not a stale count").toBe(true);
    expect(probe.latest!.remainingMs).toBe(0);
  });

  it("refresh() recomputes from the monotonic clock", () => {
    usePinnedClock();
    const probe = mount(PINNED + 300_000, { serverNowMs: PINNED });
    tick(1000);
    const before = probe.latest!.remainingMs;
    act(() => {
      probe.latest!.refresh();
    });
    expect(probe.latest!.remainingMs).toBeLessThanOrEqual(before);
    expect(probe.latest!.remainingMs).toBeGreaterThan(0);
  });
});

describe("countdown — result shape", () => {
  it("returns exactly the documented CountdownResult fields, and nothing that could leak internals", () => {
    usePinnedClock();
    const probe = mount(PINNED + 300_000, { serverNowMs: PINNED });
    tick(1000);
    expect(Object.keys(probe.latest!).sort()).toEqual([
      "days",
      "hours",
      "isExpired",
      "isRunning",
      "label",
      "minutes",
      "refresh",
      "remainingMs",
      "seconds",
      "secondsLeft",
    ]);
    expect(typeof probe.latest!.refresh).toBe("function");
    expect(typeof probe.latest!.label).toBe("string");
  });

  it("label agrees with formatCountdown and never goes negative", () => {
    usePinnedClock();
    const probe = mount(PINNED + 3_600_000, { serverNowMs: PINNED });
    for (let i = 0; i < 3; i += 1) {
      tick(1000);
      expect(probe.latest!.label).toBe(
        formatCountdown({
          days: probe.latest!.days,
          hours: probe.latest!.hours,
          minutes: probe.latest!.minutes,
          seconds: probe.latest!.seconds,
          isExpired: probe.latest!.isExpired,
        }),
      );
      expect(probe.latest!.label).not.toMatch(/-\d/);
    }
  });
});