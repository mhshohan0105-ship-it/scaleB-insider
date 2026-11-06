// Change between two periods for the dashboard cards (pure, unit tested).
import { d, type DecimalInput } from "./money";

export interface Trend {
  direction: "up" | "down" | "flat";
  /** Whole percent, or null when there is nothing to compare with. */
  percent: string | null;
}

export function trend(current: DecimalInput, previous: DecimalInput): Trend {
  const now = d(current);
  const before = d(previous);
  const direction = now.greaterThan(before) ? "up" : now.lessThan(before) ? "down" : "flat";
  if (before.lessThanOrEqualTo(0)) return { direction, percent: null };
  return {
    direction,
    percent: now.minus(before).abs().div(before).times(100).toDecimalPlaces(0).toString(),
  };
}
