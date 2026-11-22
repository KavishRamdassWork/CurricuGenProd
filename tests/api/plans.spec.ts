import { test, expect } from '@playwright/test';
import {
  DAILY_GENERATION_LIMITS,
  betaEmails,
  effectivePlan,
  generationsRemaining,
  startOfDay,
} from '../../src/lib/plans';

test.describe('effectivePlan', () => {
  test('a listed email is BETA, matched case-insensitively with whitespace trimmed', () => {
    expect(effectivePlan('FREE', 'Kavish@Example.com', ' kavish@example.com , other@x.com')).toBe('BETA');
    expect(effectivePlan('FREE', '  kavish@example.com ', 'KAVISH@EXAMPLE.COM')).toBe('BETA');
  });

  test('an empty or unset list means nobody is beta', () => {
    expect(effectivePlan('FREE', 'a@b.c', '')).toBe('FREE');
    expect(effectivePlan('FREE', 'a@b.c', undefined)).toBe('FREE');
    expect(effectivePlan('FREE', 'a@b.c', ' , ,')).toBe('FREE');
  });

  test('a missing email is never beta', () => {
    expect(effectivePlan('FREE', null, 'a@b.c')).toBe('FREE');
    expect(effectivePlan('FREE', undefined, 'a@b.c')).toBe('FREE');
    expect(effectivePlan('FREE', '', 'a@b.c')).toBe('FREE');
  });

  test('placeholder emails never match, even if listed', () => {
    expect(effectivePlan('FREE', 'user_1@pending.invalid', 'user_1@pending.invalid')).toBe('FREE');
  });

  test('PRO always stays PRO', () => {
    expect(effectivePlan('PRO', 'a@b.c', 'a@b.c')).toBe('PRO');
    expect(effectivePlan('PRO', 'a@b.c', '')).toBe('PRO');
  });

  test('a stored BETA plan is only honoured while the email is on the list', () => {
    expect(effectivePlan('BETA', 'a@b.c', 'other@x.com')).toBe('FREE');
    expect(effectivePlan('BETA', 'a@b.c', 'a@b.c')).toBe('BETA');
  });

  test('betaEmails normalises the list', () => {
    expect(betaEmails(' A@b.c, ,D@E.f ')).toEqual(['a@b.c', 'd@e.f']);
    expect(betaEmails(undefined)).toEqual(betaEmails(process.env.BETA_TESTER_EMAILS));
  });
});

test.describe('generationsRemaining', () => {
  const now = new Date();
  const yesterday = new Date(startOfDay(now).getTime() - 60 * 60 * 1000);

  test('counts down from the daily limit when last used today', () => {
    expect(generationsRemaining('FREE', 4, now, now)).toBe(6);
    expect(generationsRemaining('FREE', 99, now, now)).toBe(0);
  });

  test('a new day restores the whole limit', () => {
    expect(generationsRemaining('FREE', 4, yesterday, now)).toBe(10);
  });

  test('never having generated leaves the whole limit', () => {
    expect(generationsRemaining('BETA', 0, null, now)).toBe(200);
    expect(generationsRemaining('PRO', 5, null, now)).toBe(300);
  });

  test('defaults now to the current time', () => {
    expect(generationsRemaining('FREE', 4, new Date())).toBe(6);
  });
});

test('daily limits', () => {
  expect(DAILY_GENERATION_LIMITS).toEqual({ FREE: 10, BETA: 200, PRO: 300 });
});

test('startOfDay returns local midnight without mutating its input', () => {
  const input = new Date(2026, 5, 15, 13, 45, 12, 300);
  const copy = input.getTime();
  const d = startOfDay(input);
  expect(d.getHours()).toBe(0);
  expect(d.getMinutes()).toBe(0);
  expect(d.getMilliseconds()).toBe(0);
  expect(d.getDate()).toBe(15);
  expect(input.getTime()).toBe(copy);
});
