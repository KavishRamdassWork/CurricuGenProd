import crypto from 'crypto';

export interface PayFastData {
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first: string;
  name_last?: string;
  email_address: string;
  m_payment_id: string;
  amount: string;
  item_name: string;
  custom_str1?: string; // We use this for clerk userId
}

/** Price of the Pro plan in ZAR. Single source of truth for checkout and the ITN amount check. */
export const PRO_PRICE_ZAR = '180.00';

/**
 * Generates the MD5 signature required by PayFast.
 * PayFast requires the items to be alphabetically sorted or in the exact order they are appended.
 * Standard implementation sorts them or appends them in order.
 */
export function generatePayFastSignature(data: Record<string, string>, passPhrase?: string): string {
  let pfOutput = '';
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== '') {
      pfOutput += `${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, '+')}&`;
    }
  }

  // Remove last ampersand
  let getString = pfOutput.slice(0, -1);

  if (passPhrase) {
    getString += `&passphrase=${encodeURIComponent(passPhrase.trim()).replace(/%20/g, '+')}`;
  }

  return crypto.createHash('md5').update(getString).digest('hex');
}

export function verifyPayFastSignature(data: Record<string, string>, passPhrase?: string): boolean {
  const providedSignature = data.signature;
  if (typeof providedSignature !== 'string' || providedSignature.length === 0) return false;

  const dataWithoutSignature = { ...data };
  delete dataWithoutSignature.signature;

  const generated = Buffer.from(generatePayFastSignature(dataWithoutSignature, passPhrase));
  const provided = Buffer.from(providedSignature);

  // Constant-time compare; lengths must match first or timingSafeEqual throws.
  return generated.length === provided.length && crypto.timingSafeEqual(generated, provided);
}

/** PayFast host for this deployment: live only in production with a real merchant id configured. */
export function payfastHost(): string {
  return process.env.NODE_ENV === 'production' && process.env.PAYFAST_MERCHANT_ID
    ? 'www.payfast.co.za'
    : 'sandbox.payfast.co.za';
}

export type ServerValidation = 'valid' | 'invalid' | 'unreachable';

/**
 * PayFast's "server confirmation": post the notification back to PayFast and ask whether it really
 * sent it. This is what stops a forged notification even if the signature scheme is somehow bypassed.
 *
 * The body is the notification exactly as received, minus `signature` (PayFast's documented format).
 * 'unreachable' (network error / timeout / non-200) is distinct from 'invalid' so the caller can ask
 * PayFast to retry instead of rejecting a genuine payment.
 */
export async function validateWithPayFast(rawBody: string): Promise<ServerValidation> {
  const body = rawBody
    .split('&')
    .filter((pair) => pair !== '' && !pair.startsWith('signature='))
    .join('&');

  try {
    const res = await fetch(`https://${payfastHost()}/eng/query/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 'unreachable';
    return (await res.text()).trim() === 'VALID' ? 'valid' : 'invalid';
  } catch (error) {
    console.error('[PAYFAST] server validation request failed:', error);
    return 'unreachable';
  }
}
