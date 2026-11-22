/**
 * Choose the email address to store for a Clerk user.
 *
 * Beta access is keyed on the stored email (see plans.ts), so the stored address must be one Clerk
 * has verified and that the user has chosen as primary. `email_addresses[0]` is neither: the list
 * order is not the primary order, and an address is listed before it is verified, so anyone could
 * add an unverified address on the beta list to their account and be granted beta.
 *
 * Pure (no Clerk imports) so it can be tested directly. Accepts both the webhook payload shape
 * (`email_address`) and the Backend SDK shape (`emailAddress`).
 */

export type ClerkEmailLike = {
  id?: string | null;
  email_address?: string | null;
  emailAddress?: string | null;
  verification?: { status?: string | null } | null;
};

const addressOf = (e: ClerkEmailLike): string | null => {
  const value = e.email_address ?? e.emailAddress;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

const isVerified = (e: ClerkEmailLike): boolean => e.verification?.status === 'verified';

/**
 * The primary address if it is verified. With no primary id, the first verified address. Otherwise
 * null (the caller keeps the stored email, or uses the placeholder for a new row). The address is
 * returned exactly as given; plans.ts compares case-insensitively.
 */
export function pickPrimaryVerifiedEmail(
  addresses: ReadonlyArray<ClerkEmailLike> | null | undefined,
  primaryEmailAddressId: string | null | undefined,
): string | null {
  const list = Array.isArray(addresses) ? addresses : [];
  if (primaryEmailAddressId) {
    const primary = list.find((e) => e.id === primaryEmailAddressId);
    return primary && isVerified(primary) ? addressOf(primary) : null;
  }
  for (const e of list) {
    const address = addressOf(e);
    if (address && isVerified(e)) return address;
  }
  return null;
}

/** The parts of a Clerk `user.created` / `user.updated` webhook payload this app stores. */
export type ClerkWebhookUser = {
  email_addresses?: ReadonlyArray<ClerkEmailLike> | null;
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

/**
 * Pure: profile fields from a Clerk webhook user payload. `email` is null unless the primary address
 * is verified (see pickPrimaryVerifiedEmail); callers then keep the stored email (update) or use the
 * placeholder (create). `name` is the joined first/last name, or '' when neither is set.
 */
export function clerkWebhookProfile(data: ClerkWebhookUser): {
  email: string | null;
  name: string;
  imageUrl: string | null;
} {
  return {
    email: pickPrimaryVerifiedEmail(data.email_addresses, data.primary_email_address_id),
    name: [data.first_name, data.last_name].filter(Boolean).join(' '),
    imageUrl: data.image_url || null,
  };
}
