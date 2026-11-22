import { test, expect } from '@playwright/test';
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, idleState, secondsUntilSignOut } from '../src/lib/idleTimeout';

const MIN = 60 * 1000;
const T0 = 1_700_000_000_000;

test.describe('idle sign-out timing', () => {
  test('is 60 minutes with a 2 minute warning', () => {
    expect(IDLE_TIMEOUT_MS).toBe(60 * MIN);
    expect(IDLE_WARNING_MS).toBe(2 * MIN);
  });

  test('active until 58 minutes idle', () => {
    expect(idleState(T0, T0)).toBe('active');
    expect(idleState(T0, T0 + 30 * MIN)).toBe('active');
    expect(idleState(T0, T0 + 58 * MIN - 1)).toBe('active');
  });

  test('warns from 58 minutes until 60 minutes', () => {
    expect(idleState(T0, T0 + 58 * MIN)).toBe('warning');
    expect(idleState(T0, T0 + 59 * MIN)).toBe('warning');
    expect(idleState(T0, T0 + 60 * MIN - 1)).toBe('warning');
  });

  test('expires at 60 minutes, including after the machine slept for hours', () => {
    expect(idleState(T0, T0 + 60 * MIN)).toBe('expired');
    expect(idleState(T0, T0 + 8 * 60 * MIN)).toBe('expired');
  });

  test('counts down the seconds left and never goes negative', () => {
    expect(secondsUntilSignOut(T0, T0 + 58 * MIN)).toBe(120);
    expect(secondsUntilSignOut(T0, T0 + 59 * MIN + 30_000)).toBe(30);
    expect(secondsUntilSignOut(T0, T0 + 61 * MIN)).toBe(0);
  });
});
