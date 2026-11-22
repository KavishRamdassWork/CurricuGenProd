import { test, expect } from '@playwright/test';
import { clerkWebhookProfile, pickPrimaryVerifiedEmail, type ClerkEmailLike } from '../../src/lib/clerkEmail';

const verified = (id: string, email_address: string): ClerkEmailLike => ({
  id,
  email_address,
  verification: { status: 'verified' },
});
const unverified = (id: string, email_address: string): ClerkEmailLike => ({
  id,
  email_address,
  verification: { status: 'unverified' },
});

test.describe('pickPrimaryVerifiedEmail', () => {
  test('returns the primary address when it is verified, even when it is not first', () => {
    const list = [verified('idn_a', 'other@example.com'), verified('idn_b', 'primary@example.com')];
    expect(pickPrimaryVerifiedEmail(list, 'idn_b')).toBe('primary@example.com');
  });

  test('an unverified primary gives null, even when another address is verified', () => {
    const list = [verified('idn_a', 'verified@example.com'), unverified('idn_b', 'beta@example.com')];
    expect(pickPrimaryVerifiedEmail(list, 'idn_b')).toBeNull();
  });

  test('a primary id that matches no address gives null', () => {
    expect(pickPrimaryVerifiedEmail([verified('idn_a', 'a@example.com')], 'idn_missing')).toBeNull();
  });

  test('no primary id: the first verified address', () => {
    const list = [
      unverified('idn_a', 'first@example.com'),
      verified('idn_b', 'second@example.com'),
      verified('idn_c', 'third@example.com'),
    ];
    expect(pickPrimaryVerifiedEmail(list, null)).toBe('second@example.com');
    expect(pickPrimaryVerifiedEmail(list, undefined)).toBe('second@example.com');
  });

  test('none verified gives null', () => {
    const list = [
      unverified('idn_a', 'a@example.com'),
      { id: 'idn_b', email_address: 'b@example.com', verification: null },
      { id: 'idn_c', email_address: 'c@example.com' },
      { id: 'idn_d', email_address: 'd@example.com', verification: { status: 'expired' } },
    ];
    expect(pickPrimaryVerifiedEmail(list, null)).toBeNull();
    expect(pickPrimaryVerifiedEmail([], null)).toBeNull();
    expect(pickPrimaryVerifiedEmail(undefined, null)).toBeNull();
  });

  test('mixed case is preserved as given', () => {
    expect(pickPrimaryVerifiedEmail([verified('idn_a', 'Mixed.Case@Example.COM')], 'idn_a')).toBe(
      'Mixed.Case@Example.COM',
    );
  });

  test('accepts the Backend SDK shape (emailAddress)', () => {
    const list = [{ id: 'idn_a', emailAddress: 'sdk@example.com', verification: { status: 'verified' } }];
    expect(pickPrimaryVerifiedEmail(list, 'idn_a')).toBe('sdk@example.com');
  });
});

test.describe('clerkWebhookProfile (realistic Clerk user payloads)', () => {
  /** Shape of `data` in a Clerk user.created / user.updated event (fields this app reads, plus noise). */
  const payload = (overrides: Record<string, unknown> = {}) => ({
    object: 'user',
    id: 'user_2abc',
    first_name: 'Thandi',
    last_name: 'Nkosi',
    image_url: 'https://img.clerk.com/abc',
    primary_email_address_id: 'idn_primary',
    email_addresses: [
      {
        object: 'email_address',
        id: 'idn_secondary',
        email_address: 'secondary@example.com',
        verification: { status: 'verified', strategy: 'email_code' },
        linked_to: [],
      },
      {
        object: 'email_address',
        id: 'idn_primary',
        email_address: 'Teacher@Example.com',
        verification: { status: 'verified', strategy: 'email_code' },
        linked_to: [],
      },
    ],
    ...overrides,
  });

  test('stores the verified primary address, not email_addresses[0]', () => {
    expect(clerkWebhookProfile(payload())).toEqual({
      email: 'Teacher@Example.com',
      name: 'Thandi Nkosi',
      imageUrl: 'https://img.clerk.com/abc',
    });
  });

  test('an unverified primary address is not stored (email null)', () => {
    const data = payload({
      email_addresses: [
        { id: 'idn_primary', email_address: 'beta-list@example.com', verification: { status: 'unverified' } },
      ],
    });
    expect(clerkWebhookProfile(data).email).toBeNull();
  });

  test('missing names and image give empty name and null image', () => {
    const p = clerkWebhookProfile(payload({ first_name: null, last_name: null, image_url: '' }));
    expect(p.name).toBe('');
    expect(p.imageUrl).toBeNull();
  });
});
