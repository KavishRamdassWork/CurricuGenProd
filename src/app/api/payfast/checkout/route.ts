import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generatePayFastSignature } from "@/lib/payfast";

// Use sandbox credentials if in development, otherwise env vars
const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || '10000100';
const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a';
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
const PAYFAST_URI = process.env.NODE_ENV === 'production' && process.env.PAYFAST_MERCHANT_ID
  ? 'https://www.payfast.co.za/eng/process'
  : 'https://sandbox.payfast.co.za/eng/process';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return new NextResponse("User not found", { status: 404 });
    }

    if (dbUser.plan === "PRO") {
      // User is already pro.
      return NextResponse.json({ url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?message=already_pro` });
    }

    // Build PayFast Data Mapping
    const paymentData: any = {
      merchant_id: MERCHANT_ID,
      merchant_key: MERCHANT_KEY,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payfast`,
      name_first: dbUser.name?.split(' ')[0] || 'Teacher',
      email_address: dbUser.email,
      m_payment_id: `EDU_${Date.now()}`,
      amount: '180.00', // R180.00 ZAR (~$10 USD)
      item_name: 'EduMaster Pro Subscription (1 Month)',
      custom_str1: userId, // Pass clerk ID to webhook
      subscription_type: '1', // 1 = Subscription
      billing_date: new Date().toISOString().split('T')[0],
      recurring_amount: '180.00',
      frequency: '3', // 3 = Monthly
      cycles: '0', // 0 = indefinite
    };

    // Generate Signature
    paymentData.signature = generatePayFastSignature(paymentData, PASSPHRASE);

    // Instead of doing a server-to-server call, PayFast requires the user's browser to submit a POST form.
    // We will return the data and URL so the frontend can auto-submit the form.
    return NextResponse.json({ 
      payfastUrl: PAYFAST_URI,
      paymentData 
    });

  } catch (error) {
    console.error("[PAYFAST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
