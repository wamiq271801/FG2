/**
 * Regression tests for the bugs fixed by the Cache Components migration.
 *
 * 1. NEW badge — exact 7-day rule (was 60 days before the migration).
 * 2. Navigation progress store — single-cycle boolean model (was a racy
 *    reference-counted per-link mirroring system before the lifecycle
 *    rewrite).
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

describe("nav progress store — single-cycle boolean lifecycle", () => {
  test("start → active, end → inactive (one navigation, one cycle)", () => {
    const s = useNavProgress.getState();
    s.end(); // clear any leaked state from other tests
    expect(useNavProgress.getState().active).toBe(false);
    s.start();
    expect(useNavProgress.getState().active).toBe(true);
    s.end();
    expect(useNavProgress.getState().active).toBe(false);
  });

  test("overlapping starts collapse into one continuous cycle", () => {
    const s = useNavProgress.getState();
    s.end();
    s.start(); // first click
    s.start(); // second click while first navigation is still in flight
    expect(useNavProgress.getState().active).toBe(true);
    s.end(); // the superseding navigation commits
    expect(useNavProgress.getState().active).toBe(false);
  });

  test("end is a no-op when nothing is in flight", () => {
    const s = useNavProgress.getState();
    s.end();
    s.end();
    expect(useNavProgress.getState().active).toBe(false);
  });
});
