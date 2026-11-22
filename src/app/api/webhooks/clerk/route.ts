import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { placeholderEmail } from '@/lib/ensureUser';
import { clerkWebhookProfile } from '@/lib/clerkEmail';

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const svix_id = req.headers.get('svix-id');
  const svix_timestamp = req.headers.get('svix-timestamp');
  const svix_signature = req.headers.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // The signature covers the exact bytes Clerk sent. Verify the raw text - re-serialising a parsed
  // body (key order, whitespace, unicode escapes) can change the bytes and fail valid deliveries.
  const body = await req.text();

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (evt.type === 'user.created') {
      const { id } = evt.data;
      // Only a verified primary address is stored: beta access is keyed on it (see clerkEmail.ts).
      const profile = clerkWebhookProfile(evt.data);
      const email = profile.email;
      const name = profile.name || email;
      const image_url = profile.imageUrl;

      // Upsert: the user may already exist (created on first request before this webhook arrived),
      // and Clerk redelivers events, so this handler must be idempotent.
      await prisma.user.upsert({
        where: { clerkId: id },
        update: {
          email: email || undefined,
          name: name || undefined,
          imageUrl: image_url || undefined,
        },
        create: {
          clerkId: id,
          email: email || placeholderEmail(id),
          name: name || null,
          imageUrl: image_url || null,
          // Beta access is resolved per request from BETA_TESTER_EMAILS, never stored.
          plan: 'FREE',
          generationsLeft: 10,
          lastGenerationDate: new Date(),
        },
      });
    }

    if (evt.type === 'user.updated') {
      const { id } = evt.data;
      // No verified primary address (null) leaves the stored email unchanged rather than replacing it
      // with an unverified one.
      const { email, name, imageUrl: image_url } = clerkWebhookProfile(evt.data);

      // updateMany: an update for a user we never stored is a no-op rather than a 500 + retry storm.
      await prisma.user.updateMany({
        where: { clerkId: id },
        data: {
          email: email || undefined,
          name: name || undefined,
          imageUrl: image_url || undefined,
        },
      });
    }

    if (evt.type === 'user.deleted') {
      const { id } = evt.data;
      if (id) {
        // deleteMany: already-deleted is fine. Cascades to classrooms via the schema.
        await prisma.user.deleteMany({ where: { clerkId: id } });
      }
    }
  } catch (error) {
    // Non-2xx makes Clerk retry with backoff, which is what we want for transient DB failures.
    console.error('[CLERK_WEBHOOK_ERROR]', evt.type, error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
