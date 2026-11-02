import { describe, it, expect } from 'vitest';
import { isTriggerHit } from '@/lib/trigger-monitor';

// Entry Trigger Alerts: an alert fires only when live price crosses the user's
// level in the chosen direction.
describe('isTriggerHit', () => {
  it('fires above-alert when price reaches or passes the level', () => {
    expect(isTriggerHit(0.0001251, 'above', 0.000125)).toBe(true);
    expect(isTriggerHit(85000, 'above', 84500)).toBe(true);
  });

  it('does not fire above-alert while price is below the level', () => {
    expect(isTriggerHit(84499.99, 'above', 84500)).toBe(false);
    expect(isTriggerHit(0.000124, 'above', 0.000125)).toBe(false);
  });

  it('fires below-alert when price falls to or past the level', () => {
    expect(isTriggerHit(0.0001199, 'below', 0.00012)).toBe(true);
    expect(isTriggerHit(79800, 'below', 80000)).toBe(true);
  });

  it('does not fire below-alert while price is above the level', () => {
    expect(isTriggerHit(80000.01, 'below', 80000)).toBe(false);
  });

  it('treats an exact touch of the level as a hit', () => {
    expect(isTriggerHit(84500, 'above', 84500)).toBe(true);
    expect(isTriggerHit(80000, 'below', 80000)).toBe(true);
  });

  it('ignores missing or invalid price data', () => {
    expect(isTriggerHit(NaN, 'above', 100)).toBe(false);
    expect(isTriggerHit(Infinity, 'above', 100)).toBe(false);
  });
});
