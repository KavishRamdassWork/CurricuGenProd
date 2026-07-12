import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/health',    // health check — intentionally public, no auth required
]);

const isApiRoute = createRouteMatcher(['/api(.*)', '/trpc(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  const { userId } = await auth();
  if (!userId) {
    // API/JSON clients should get a proper 401, not an HTML redirect to
    // /sign-in — a redirect silently breaks fetch()-based error handling
    // (fetch follows redirects by default, so callers would receive the
    // sign-in page's 200 HTML instead of a clean 401 they can check for).
    if (isApiRoute(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await auth.protect();
    return;
  }
}, { clockSkewInMs: 300000 });

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
