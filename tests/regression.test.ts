/**
 * Regression tests for the bugs fixed by the Cache Components migration.
 *
 * 1. NEW badge — exact 7-day rule (was 60 days before the migration).
 * 2. Navigation progress store — reference-counted model (was a racy global
 *    boolean before the migration).
 *
 * Run: bun test tests/regression.test.ts
 */
import { describe, expect, test } from "bun:test";
import {
  NEW_BADGE_WINDOW_MS,
  isNewProduct,
} from "@/components/shared/ProductCard";
import { useNavProgress } from "@/hooks/use-nav-progress";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("NEW badge — exact 7-day rule", () => {
  test("window is exactly 7 × 24 hours", () => {
    expect(NEW_BADGE_WINDOW_MS).toBe(7 * DAY);
    expect(NEW_BADGE_WINDOW_MS).toBe(604800000);
  });

  test("added 1 hour ago → NEW", () => {
    expect(isNewProduct(new Date(Date.now() - 1 * HOUR).toISOString())).toBe(true);
  });

  test("added 6 days ago → NEW", () => {
    expect(isNewProduct(new Date(Date.now() - 6 * DAY).toISOString())).toBe(true);
  });

  test("added 6 days 23 hours 59 minutes ago → NEW", () => {
    expect(
      isNewProduct(new Date(Date.now() - (6 * DAY + 23 * HOUR + 59 * MIN)).toISOString())
    ).toBe(true);
  });

  test("added exactly 7 days ago → NOT NEW (strict <)", () => {
    const now = Date.now();
    expect(isNewProduct(new Date(now - 7 * DAY).toISOString(), now)).toBe(false);
  });

  test("added 8 days ago → NOT NEW", () => {
    expect(isNewProduct(new Date(Date.now() - 8 * DAY).toISOString())).toBe(false);
  });
});

describe("nav progress store — reference-counted lifecycle", () => {
  test("pending is count > 0, not a boolean", () => {
    const s = useNavProgress.getState();
    s.reset();
    s.start();
    expect(useNavProgress.getState().pendingCount).toBe(1);
    s.start(); // second concurrent reporter
    expect(useNavProgress.getState().pendingCount).toBe(2);
    s.complete(); // one completes — the other's navigation is still in flight
    expect(useNavProgress.getState().pendingCount).toBe(1);
    s.complete();
    expect(useNavProgress.getState().pendingCount).toBe(0);
  });

  test("complete clamps at zero (stale reporters can't go negative)", () => {
    const s = useNavProgress.getState();
    s.reset();
    s.complete(); // unguarded completion with nothing in flight
    expect(useNavProgress.getState().pendingCount).toBe(0);
  });

  test("reset clears any leaked count (pathname-change safety net)", () => {
    const s = useNavProgress.getState();
    s.start();
    s.start();
    s.start();
    s.reset();
    expect(useNavProgress.getState().pendingCount).toBe(0);
  });
});
