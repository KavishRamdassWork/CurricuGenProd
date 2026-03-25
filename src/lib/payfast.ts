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

/**
 * Generates the MD5 signature required by PayFast.
 * PayFast requires the items to be alphabetically sorted or in the exact order they are appended.
 * Standard implementation sorts them or appends them in order.
 */
export function generatePayFastSignature(data: Record<string, string>, passPhrase?: string): string {
  let pfOutput = '';
  for (const key in data) {
    if (data.hasOwnProperty(key) && data[key] !== '') {
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
  const dataWithoutSignature = { ...data };
  delete dataWithoutSignature.signature;

  const generatedSignature = generatePayFastSignature(dataWithoutSignature, passPhrase);
  return generatedSignature === providedSignature;
}
