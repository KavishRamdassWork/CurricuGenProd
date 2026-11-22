import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayFastSignature, validateWithPayFast, PRO_PRICE_ZAR } from "@/lib/payfast";

const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || '10000100';

export async function POST(req: NextRequest) {
  try {
    // Without a passphrase the signature is an MD5 of fields an attacker already knows, so anyone
    // could forge a "COMPLETE" notification and grant themselves Pro. Fail closed in production.
    if (process.env.NODE_ENV === 'production' && !PASSPHRASE) {
      console.error('[PAYFAST_WEBHOOK] PAYFAST_PASSPHRASE is not set - refusing to process notifications');
      return new NextResponse("Server configuration error", { status: 500 });
    }

    const rawBody = await req.text();
    const urlParams = new URLSearchParams(rawBody);
    const data: Record<string, string> = {};
    for (const [key, value] of urlParams.entries()) {
      data[key] = value;
    }

    // 1. Verify Signature
    if (!verifyPayFastSignature(data, PASSPHRASE)) {
      console.error("Invalid PayFast signature");
      return new NextResponse("Invalid Signature", { status: 400 });
    }

    // 2. Sanity-check the fields PayFast echoes back, when present.
    if (data.merchant_id && data.merchant_id !== MERCHANT_ID) {
      console.error("PayFast notification for a different merchant:", data.merchant_id);
      return new NextResponse("Invalid Merchant", { status: 400 });
    }
    if (data.payment_status === "COMPLETE" && data.amount_gross && data.amount_gross !== PRO_PRICE_ZAR) {
      console.error("PayFast amount mismatch:", data.amount_gross);
      return new NextResponse("Invalid Amount", { status: 400 });
    }

    const { payment_status, custom_str1, token } = data;
    const clerkId = custom_str1;

    if (!clerkId) {
       console.error("No clerkId (custom_str1) provided by PayFast");
       return new NextResponse("Missing Custom String 1", { status: 400 });
    }

    // 3. Ask PayFast to confirm it really sent this notification. Enforced in production only: in
    //    development/tests the payloads are synthetic and PayFast would (correctly) call them invalid.
    if (process.env.NODE_ENV === 'production') {
      const verdict = await validateWithPayFast(rawBody);
      if (verdict === 'invalid') {
        console.error("[PAYFAST_WEBHOOK] PayFast did not confirm this notification", { pf_payment_id: data.pf_payment_id });
        return new NextResponse("Not confirmed by PayFast", { status: 400 });
      }
      if (verdict === 'unreachable') {
        // 5xx makes PayFast redeliver later, so a genuine payment is not lost to a transient outage.
        return new NextResponse("Validation unavailable", { status: 503 });
      }
    }

    // 4. Record the notification (audit trail; redeliveries of the same pf_payment_id update one row).
    if (data.pf_payment_id) {
      await prisma.payment.upsert({
        where: { pfPaymentId: data.pf_payment_id },
        update: { status: payment_status },
        create: {
          pfPaymentId: data.pf_payment_id,
          mPaymentId: data.m_payment_id || null,
          clerkId,
          status: payment_status,
          amountGross: data.amount_gross || null,
        },
      });
    }

    // 5. Handle Subscription and Payment Success. Both branches are idempotent (PayFast retries
    //    notifications), and use updateMany so an unknown user is a counted miss, not a thrown error.
    if (payment_status === "COMPLETE") {
      const result = await prisma.user.updateMany({
        where: { clerkId },
        data: {
          plan: "PRO",
          stripeCustomerId: token || undefined // Store the PayFast token here instead of Stripe id
        },
      });
      if (result.count === 0) {
        // Money was taken but no matching user: surface it loudly and let PayFast retry.
        console.error("[PAYFAST_WEBHOOK] COMPLETE payment for unknown user", { clerkId, pf_payment_id: data.pf_payment_id });
        return new NextResponse("User not found", { status: 500 });
      }
    } else if (payment_status === "CANCELLED" || payment_status === "FAILED") {
      // Only downgrade paying users - never touch BETA testers or users already on FREE.
      await prisma.user.updateMany({
        where: { clerkId, plan: "PRO" },
        data: { plan: "FREE" },
      });
    }

    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    console.error("[PAYFAST_WEBHOOK_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
