# UX & AI Enhancements — Design Spec
**Date:** 2026-06-04
**Project:** CurricuGen Pro
**Sub-project:** 1 of 3 (UX polish + Visual Aids)
**Status:** Approved

---

## 1. Problem Statement

Two gaps exist in the current Lesson Workspace experience:

1. **Chatbot refinement is silent** — when a teacher asks the AI to edit content, there is no visual feedback in the document area. The content just suddenly changes. Teachers don't know if the AI is working or if the click registered.

2. **Visual aids are locked behind a "Coming Soon" placeholder** — the server-side image generation code using Imagen is fully implemented but the UI suppresses it. With a paid API key now active, this feature should be enabled with appropriate usage limits to protect margins.

---

## 2. Scope

**In scope:**
- Shimmer loading animation on document area during chatbot refinement
- Visual Aids tab: freeform image generation with description prompt
- Visual Aids tab: batch slide image generation
- Image download (client-side, no server round-trip)
- Image quota system (separate from text generation credits)
- Model upgrade: `imagen-3.0-generate-001` → `imagen-4-fast-generate-001`
- `imagesLeft` and `lastImageDate` fields on User model

**Out of scope:**
- Inline image embedding inside lesson plan sections
- Image editing or cropping
- Sharing images externally
- Class management (Sub-project 2)
- Slideshow presentation mode (Sub-project 3)

---

## 3. Architecture Overview

```
globals.css              ← shimmer keyframe + .is-refining overlay class
prisma/schema.prisma     ← imagesLeft (Int), lastImageDate (DateTime?) on User
src/lib/authGuard.ts     ← requireImageAccess(), consumeImageGeneration()
src/lib/aiService.ts     ← IMAGE_MODEL updated; generateEducationalImageServer
                            accepts freeform description param
src/app/api/generate/image/route.ts  ← uses requireImageAccess
src/app/api/user/me/route.ts         ← includes imagesLeft in response
src/components/Dashboard.tsx         ← DbUser adds imagesLeft
src/components/LessonWorkspace.tsx   ← shimmer overlay; Visual Aids tab
                                        fully implemented; download button
```

**Single source of truth:** The image quota lives in the DB (`User.imagesLeft`), resets daily server-side, and is surfaced to the client via `GET /api/user/me` — the same endpoint already polled after every text generation. No new API endpoint needed.

---

## 4. Feature A — Chatbot Thinking Shimmer

### 4.1 CSS (`globals.css`)

A shimmer keyframe added after the existing print styles:

```css
/* ─── Refining Shimmer ──────────────────────────────── */
@keyframes shimmer-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.is-refining {
  position: relative;
  pointer-events: none;
}

.is-refining::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(59, 130, 246, 0.08) 40%,
    rgba(59, 130, 246, 0.14) 50%,
    rgba(59, 130, 246, 0.08) 60%,
    transparent 100%
  );
  animation: shimmer-sweep 1.6s ease-in-out infinite;
  border-radius: inherit;
  z-index: 10;
}
```

The overlay is translucent — teacher can still read the content being edited. `pointer-events: none` prevents accidental clicks during refinement.

### 4.2 Component change (`LessonWorkspace.tsx`)

The document content area (the `<div className="p-12 lg:p-16 ...">` wrapper) receives the `is-refining` class conditionally:

```tsx
<div className={`p-12 lg:p-16 print:p-0 ${isRefining ? 'is-refining' : ''}`}>
```

No new state. `isRefining` already exists and has the correct lifecycle (set to `true` in `handleRefine` before the API call, reset to `false` in the `finally` block).

---

## 5. Feature B — Visual Aids

### 5.1 Image Model Upgrade

In `src/lib/aiService.ts`, update the `IMAGE_MODEL` constant:

```typescript
const IMAGE_MODEL = 'imagen-4-fast-generate-001';
```

Imagen 4 Fast: $0.02/image (vs $0.03 for Imagen 3), better quality for educational illustrations.

### 5.2 `generateEducationalImageServer` — accept freeform description

Update the function signature to accept an optional `description` string. When provided, it takes priority over the unit topic. When absent, falls back to existing behaviour:

```typescript
export async function generateEducationalImageServer(
  unit: WeekUnit,
  description?: string
): Promise<string> {
  const prompt = description
    ? `Create a clear, educational illustration for a K-12 classroom. Subject: ${sanitizeInput(description, 500)}. Style: textbook-quality, high contrast, clean lines, suitable for printing.`
    : `Create an educational illustration suitable for a slide or worksheet. Topic: ${sanitizeInput(unit.topicTitle)}. Concept: ${sanitizeInput(unit.summary, 300)}. Style: Clear, textbook-style illustration, suitable for K-12 education. High contrast, clean lines.`;
  // ... rest of function unchanged
}
```

### 5.3 Image Quota System

#### `prisma/schema.prisma` — new User fields

```prisma
model User {
  // ... existing fields ...
  imagesLeft        Int       @default(1)
  lastImageDate     DateTime?
}
```

`@default(1)` covers new signups automatically. Existing users are handled by the lazy-reset pattern in `requireImageAccess`.

#### `src/lib/authGuard.ts` — new guards

```typescript
const IMAGE_LIMITS = { FREE: 1, PRO: 10, BETA: 10 } as const;

export async function requireImageAccess(): Promise<GuardResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, plan: true, imagesLeft: true, lastImageDate: true },
  });

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: { clerkId: userId, email: '', plan: 'FREE', generationsLeft: 10, imagesLeft: 1 },
      select: { id: true, plan: true, imagesLeft: true, lastImageDate: true },
    });
  }

  const dailyLimit = IMAGE_LIMITS[dbUser.plan as keyof typeof IMAGE_LIMITS] ?? 1;
  const today = new Date().toDateString();
  const lastImage = dbUser.lastImageDate?.toDateString();

  if (lastImage !== today) {
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { imagesLeft: dailyLimit, lastImageDate: new Date() },
      select: { id: true, plan: true, imagesLeft: true, lastImageDate: true },
    });
  }

  if (dbUser.imagesLeft <= 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Daily image limit reached. Come back tomorrow or upgrade to Pro.', code: 'IMAGE_LIMIT_REACHED' },
        { status: 402 }
      ),
    };
  }

  return { ok: true, dbUser: { id: dbUser.id, plan: dbUser.plan, generationsLeft: dbUser.imagesLeft } };
  // Note: generationsLeft field is reused for API compatibility with GuardResult type.
  // Its value represents imagesLeft when returned from requireImageAccess.
}

export async function consumeImageGeneration(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { imagesLeft: { decrement: 1 }, lastImageDate: new Date() },
  });
}
```

#### `src/app/api/generate/image/route.ts` — updated

```typescript
import { requireImageAccess, consumeImageGeneration } from '@/lib/authGuard';
import { generateEducationalImageServer } from '@/lib/aiService';

export async function POST(req: NextRequest) {
  const guard = await requireImageAccess();
  if (!guard.ok) return guard.response;

  try {
    const { unit, description } = await req.json();
    const imageUrl = await generateEducationalImageServer(unit, description);
    await consumeImageGeneration(guard.dbUser.id);
    return NextResponse.json({ imageUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Image generation failed';
    if (msg.includes('safety') || msg.includes('block')) {
      return NextResponse.json({ error: 'Image could not be generated — try rephrasing your description.', code: 'SAFETY_BLOCK' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Image generation is temporarily unavailable. Try again shortly.' }, { status: 500 });
  }
}
```

### 5.4 `GET /api/user/me` — include `imagesLeft`

The existing `/api/user/me` route selects user fields and returns them. Add `imagesLeft` to the select and response:

```typescript
const user = await prisma.user.findUnique({
  where: { clerkId: userId },
  select: { plan: true, generationsLeft: true, imagesLeft: true, name: true },
});
return NextResponse.json({ user });
```

### 5.5 `Dashboard.tsx` — DbUser interface

```typescript
interface DbUser {
  plan: string;
  generationsLeft: number;
  imagesLeft: number;   // new
  name: string | null;
}
```

`imagesLeft` flows from `dbUser` state down to `LessonWorkspace` as a prop alongside `activeClass`.

### 5.6 Visual Aids Tab — LessonWorkspace UI

The existing "Coming Soon" block is replaced with a fully functional tab. Layout:

```
┌─────────────────────────────────────────────────────┐
│  Visual Aids                                        │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Describe what this image should show...     │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Generate Image]     2 of 10 remaining today      │
│                                                     │
│  ─────────────────────────────────────────────     │
│  [Generated image displayed full-width here]        │
│  [⬇ Download Image]  [↺ Regenerate]                │
│                                                     │
│  ─────────────────────────────────────────────     │
│  SLIDE IMAGES                                       │
│  Generate one illustration per slide.               │
│  [Generate Slide Images (10 slides = 10 credits)]   │
└─────────────────────────────────────────────────────┘
```

**State additions to `LessonWorkspace`:**
```typescript
const [imageDescription, setImageDescription] = useState('');
const [slideImages, setSlideImages] = useState<{ slideNumber: number; imageUrl: string }[]>([]);
```

`generatedImageUrl` already exists. `slideImages` is new.

**Quota display logic:**
- Shows `imagesLeft` prop received from Dashboard
- Disables Generate button when `imagesLeft <= 0`
- Quota label: FREE → "X of 1 image remaining today", PRO/BETA → "X of 10 images remaining today"
- When 0 remaining: "0 remaining · Resets tomorrow" (no alert, UI state is self-explanatory)

**Image download:**
```typescript
const handleImageDownload = (imageUrl: string, filename: string) => {
  const a = document.createElement('a');
  a.href = imageUrl;  // base64 data URI
  a.download = filename;
  a.click();
};
```
Filename format: `visual-aid-{topicTitle}.jpg` (for single image), `slide-{N}-{topicTitle}.jpg` (for slide images).

**Slide batch generation:**
- Parses the existing `slides` markdown string using a regex to extract `## Slide N: Title` headings
- Generates images sequentially (not parallel — avoids rate limit spikes)
- Stops when `imagesLeft` quota is exhausted
- Shows progress: "Generating slide images... (3/8 complete)"
- On partial completion: "Generated 7 of 10 slides — daily image limit reached"

**Saving images:** Both `generatedImageUrl` and `slideImages` are included in the `onSaveClassContent` call (already fires on every state change via `useEffect`) so they persist to `savedLessons` in the DB.

---

## 6. Error Handling Summary

| Scenario | Behaviour |
|---|---|
| `IMAGE_LIMIT_REACHED` | Quota indicator shows "0 remaining · Resets tomorrow". Button disabled. No alert. |
| Safety block from Imagen | Alert: "Image could not be generated — try rephrasing your description." |
| Imagen API error | Alert: "Image generation is temporarily unavailable. Try again shortly." |
| Slide batch hits quota mid-way | Shows "Generated N of M slides — daily image limit reached." Keeps completed images. |
| Download fails (bad base64) | Download button shows brief error state: "Failed — try again." |
| `isRefining` shimmer while no content | Shimmer still animates (harmless — empty page just shimmers) |

---

## 7. Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `imagesLeft Int @default(1)` and `lastImageDate DateTime?` to User |
| `src/lib/authGuard.ts` | Add `requireImageAccess()`, `consumeImageGeneration()`, `IMAGE_LIMITS` constant |
| `src/lib/aiService.ts` | Update `IMAGE_MODEL` to `imagen-4-fast-generate-001`; update `generateEducationalImageServer` signature |
| `src/app/api/generate/image/route.ts` | Use `requireImageAccess` and `consumeImageGeneration`; accept `description` param |
| `src/app/api/user/me/route.ts` | Include `imagesLeft` in select and response |
| `src/components/Dashboard.tsx` | Add `imagesLeft` to `DbUser` interface; pass to `LessonWorkspace` |
| `src/components/LessonWorkspace.tsx` | Shimmer overlay on `isRefining`; full Visual Aids tab; download handler; slide batch generator |
| `src/app/globals.css` | Add shimmer keyframe and `.is-refining` class |

---

## 8. Constraints & Decisions

- **Imagen 4 Fast chosen over Imagen 4 Standard** — $0.02 vs $0.04, quality difference negligible for K-12 educational illustrations
- **Sequential slide image generation** — prevents rate limit spikes; progress indicator keeps teacher informed
- **Image quota separate from text quota** — images cost 2× more than text generations; shared pool would allow PRO users to burn >$9.99/month in images alone
- **FREE = 1 image/day** — enough to demonstrate value and drive upgrades; not enough to generate meaningful educational material without upgrading
- **PRO = 10 images/day** — covers a full 10-slide deck in one session; max cost $0.20/day = $6/month, comfortably within $9.99 revenue
- **No new DB migration file needed** — Prisma handles schema diff automatically on `prisma db push` or `prisma migrate dev`
- **Images stored as base64 in `savedLessons` JSON blob** — no separate storage infrastructure; base64 JPEG at 16:9 is ~100–200KB, well within Postgres JSON field limits
