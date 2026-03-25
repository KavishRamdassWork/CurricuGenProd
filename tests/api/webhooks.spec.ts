import { test, expect } from '@playwright/test';
import crypto from 'crypto';

test.describe('PayFast Webhooks API', () => {
  const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
  
  function generateSignature(data: Record<string, string>, passPhrase: string): string {
    let pfOutput = '';
    for (const key in data) {
      if (data.hasOwnProperty(key) && data[key] !== '') {
        pfOutput += `${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, '+')}&`;
      }
    }
    let getString = pfOutput.slice(0, -1);
    if (passPhrase) {
      getString += `&passphrase=${encodeURIComponent(passPhrase.trim()).replace(/%20/g, '+')}`;
    }
    return crypto.createHash('md5').update(getString).digest('hex');
  }

  test('should reject requests with invalid MD5 signature', async ({ request }) => {
    const payload = new URLSearchParams();
    payload.append('payment_status', 'COMPLETE');
    payload.append('item_name', 'Test item');
    payload.append('custom_str1', 'clerk_user_123');
    payload.append('signature', 'invalid_signature_hash');

    const response = await request.post('/api/webhooks/payfast', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: payload.toString()
    });

    expect(response.status()).toBe(400);
    const text = await response.text();
    expect(text).toBe('Invalid Signature');
  });

  test('should accept valid signature and process COMPLETE status', async ({ request }) => {
    const payloadData: Record<string, string> = {
      payment_status: 'COMPLETE',
      item_name: 'Test item',
      custom_str1: 'test_clerk_user_default', // Must match the user seeded in global.setup.ts
      token: 'payfast_token_123'
    };

    const signature = generateSignature(payloadData, PASSPHRASE);
    payloadData.signature = signature;

    const payload = new URLSearchParams();
    for (const [key, val] of Object.entries(payloadData)) {
      payload.append(key, val);
    }

    const response = await request.post('/api/webhooks/payfast', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: payload.toString()
    });

    // It should return 200 OK
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toBe('OK');
  });
});
