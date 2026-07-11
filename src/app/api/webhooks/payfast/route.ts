import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayFastSignature } from "@/lib/payfast";

const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';

export async function POST(req: NextRequest) {
  try {
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

    const { payment_status, custom_str1, token } = data;
    const clerkId = custom_str1;

    if (!clerkId) {
       console.error("No clerkId (custom_str1) provided by PayFast");
       return new NextResponse("Missing Custom String 1", { status: 400 });
    }

    // 2. Handle Subscription and Payment Success
    if (payment_status === "COMPLETE") {
      await prisma.user.update({
        where: { clerkId: clerkId },
        data: { 
          plan: "PRO",
          stripeCustomerId: token // Store the PayFast token here instead of Stripe id
        },
      });
    } else if (payment_status === "CANCELLED" || payment_status === "FAILED") {
       await prisma.user.update({
        where: { clerkId: clerkId },
        data: { plan: "FREE" },
      });
    }

    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    console.error("[PAYFAST_WEBHOOK_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
