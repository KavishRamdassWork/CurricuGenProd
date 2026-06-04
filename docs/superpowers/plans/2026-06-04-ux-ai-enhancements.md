# UX & AI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shimmer loading animation during chatbot refinement, enable the Visual Aids tab with Imagen 4 Fast image generation (freeform description + slide batch), image download, and a separate image quota system (FREE: 1/day, PRO/BETA: 10/day).

**Architecture:** The image quota mirrors the existing generation credit system — new `imagesLeft` and `lastImageDate` fields on the User model, a new `requireImageAccess()` guard in `authGuard.ts`, and the existing `/api/user/me` endpoint extended to return `imagesLeft`. The shimmer is pure CSS applied conditionally via the existing `isRefining` boolean. Images are stored as base64 in `savedLessons` JSON — no new storage infrastructure.

**Tech Stack:** Prisma (schema migration), Imagen 4 Fast via `@google/genai`, existing Next.js API route pattern, Tailwind CSS, React state.

---

## Task 1: Update Prisma schema and run migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add image quota fields to User model**

In `prisma/schema.prisma`, find the `model User` block. Add two fields directly after `lastGenerationDate`:

```prisma
model User {
  id               String      @id @default(cuid())
  clerkId          String      @unique
  email            String      @unique
  name             String?
  imageUrl         String?
  plan             Plan        @default(FREE)
  generationsLeft  Int         @default(10)
  lastGenerationDate DateTime?
  imagesLeft       Int         @default(1)
  lastImageDate    DateTime?
  stripeCustomerId String?     @unique
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt
  classrooms       Classroom[]
}
```

- [ ] **Step 2: Run the migration locally**

```bash
cd "B:/Antigravity/Projects/Curricugen"
npx prisma migrate dev --name add_image_quota
```

Expected output:
```
Applying migration `YYYYMMDDHHMMSS_add_image_quota`
Your database is now in sync with your schema.
Generated Prisma Client
```

If the command hangs waiting for DB, ensure your `.env.local` has a valid `DATABASE_URL`.

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add imagesLeft and lastImageDate to User model"
```

---

## Task 2: Update LessonContent type

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add imageUrl and slideImages to LessonContent**

In `src/lib/types.ts`, find the `LessonContent` interface and replace it with:

```typescript
export interface LessonContent {
  plan: string;
  slides: string;
  worksheets: EducationalResource[];
  assignments: EducationalResource[];
  tests: EducationalResource[];
  imageUrl?: string;
  slideImages?: { slideNumber: number; imageUrl: string }[];
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "B:/Antigravity/Projects/Curricugen"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add imageUrl and slideImages to LessonContent"
```

---

## Task 3: Add image auth guard functions

**Files:**
- Modify: `src/lib/authGuard.ts`

- [ ] **Step 1: Add IMAGE_LIMITS constant and requireImageAccess function**

Open `src/lib/authGuard.ts`. After the existing `consumeGeneration` function, append:

```typescript
const IMAGE_LIMITS: Record<string, number> = { FREE: 1, PRO: 10, BETA: 10 };

export async function requireImageAccess(): Promise<GuardResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized — please sign in.' }, { status: 401 }),
    };
  }

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, plan: true, imagesLeft: true, lastImageDate: true },
  });

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        clerkId: userId,
        email: '',
        plan: 'FREE',
        generationsLeft: 10,
        imagesLeft: 1,
        lastGenerationDate: new Date(),
        lastImageDate: new Date(),
      },
      select: { id: true, plan: true, imagesLeft: true, lastImageDate: true },
    });
  }

  const dailyLimit = IMAGE_LIMITS[dbUser.plan] ?? 1;
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
        {
          error: 'Daily image limit reached. Come back tomorrow or upgrade to Pro.',
          code: 'IMAGE_LIMIT_REACHED',
        },
        { status: 402 }
      ),
    };
  }

  // Note: generationsLeft field reused for API compatibility with GuardResult type.
  // Its value here represents imagesLeft.
  return { ok: true, dbUser: { id: dbUser.id, plan: dbUser.plan, generationsLeft: dbUser.imagesLeft } };
}

export async function consumeImageGeneration(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      imagesLeft: { decrement: 1 },
      lastImageDate: new Date(),
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "B:/Antigravity/Projects/Curricugen"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/authGuard.ts
git commit -m "feat(auth): add requireImageAccess and consumeImageGeneration guards"
```

---

## Task 4: Update aiService.ts — model and image function

**Files:**
- Modify: `src/lib/aiService.ts`

- [ ] **Step 1: Update IMAGE_MODEL constant**

In `src/lib/aiService.ts`, find the `IMAGE_MODEL` constant line and change it to:

```typescript
const IMAGE_MODEL      = 'imagen-4-fast-generate-001'; // upgraded from imagen-3, $0.02/image
```

- [ ] **Step 2: Update generateEducationalImageServer signature**

Find `export async function generateEducationalImageServer(unit: WeekUnit): Promise<string>` and replace the entire function with:

```typescript
export async function generateEducationalImageServer(unit: WeekUnit, description?: string): Promise<string> {
  const ai = getAIClient();
  const prompt = description
    ? `Create a clear, educational illustration for a K-12 classroom.
Subject: ${sanitizeInput(description, 500)}
Style: textbook-quality diagram or illustration, high contrast, clean lines, suitable for printing or projecting in class.`
    : `Create an educational illustration suitable for a slide or worksheet.
Topic: ${sanitizeInput(unit.topicTitle)}
Concept: ${sanitizeInput(unit.summary, 300)}
Style: Clear, textbook-style illustration, suitable for K-12 education. High contrast, clean lines.`;

  try {
    const response = await ai.models.generateImages({
      model: IMAGE_MODEL,
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '16:9',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const img = response.generatedImages[0];
      if (img.image) return `data:${img.image.mimeType};base64,${img.image.imageBytes}`;
    }
    return '';
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Image generation failed', msg);
    throw error;
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/aiService.ts
git commit -m "feat(ai): upgrade to imagen-4-fast, add freeform description to image generation"
```

---

## Task 5: Update client-side gemini.ts

**Files:**
- Modify: `src/lib/gemini.ts`

- [ ] **Step 1: Update generateEducationalImage to accept description**

In `src/lib/gemini.ts`, find the `generateEducationalImage` function (last function in the file) and replace it with:

```typescript
export const generateEducationalImage = async (unit: WeekUnit, description?: string): Promise<string> => {
  const data = await apiPost<{ imageUrl: string }>('image', { unit, description });
  return data.imageUrl;
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat(client): add description param to generateEducationalImage"
```

---

## Task 6: Update image API route

**Files:**
- Modify: `src/app/api/generate/image/route.ts`

- [ ] **Step 1: Replace the entire route file**

Replace the full contents of `src/app/api/generate/image/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateEducationalImageServer } from '@/lib/aiService';
import { requireImageAccess, consumeImageGeneration } from '@/lib/authGuard';
import { z } from 'zod';

const schema = z.object({
  unit: z.object({
    weekNumber: z.number(),
    topicTitle: z.string().max(200),
    summary: z.string().max(500),
    learningOutcome: z.string().max(500),
  }),
  description: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireImageAccess();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const { unit, description } = schema.parse(body);
    const imageUrl = await generateEducationalImageServer(unit, description);
    await consumeImageGeneration(guard.dbUser.id);
    return NextResponse.json({ imageUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Image generation error:', msg);

    if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('block')) {
      return NextResponse.json(
        { error: 'Image could not be generated — try rephrasing your description.', code: 'SAFETY_BLOCK' },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: 'Image generation is temporarily unavailable. Try again shortly.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/image/route.ts
git commit -m "feat(api): use image quota guard and accept freeform description in image route"
```

---

## Task 7: Update /api/user/me to return imagesLeft

**Files:**
- Modify: `src/app/api/user/me/route.ts`

- [ ] **Step 1: Add imagesLeft to both select queries**

In `src/app/api/user/me/route.ts`, find the first `prisma.user.findUnique` call. Change:

```typescript
    select: { id: true, email: true, name: true, plan: true, generationsLeft: true, createdAt: true },
```

to:

```typescript
    select: { id: true, email: true, name: true, plan: true, generationsLeft: true, imagesLeft: true, createdAt: true },
```

Then find the `prisma.user.create` call inside the `if (!dbUser)` block. Change its `select` the same way:

```typescript
        select: { id: true, email: true, name: true, plan: true, generationsLeft: true, imagesLeft: true, createdAt: true },
```

Also update the `data` block of the create call to include `imagesLeft`:

```typescript
      data: {
        clerkId: user.id,
        email,
        name,
        plan,
        generationsLeft: 10,
        imagesLeft: 1,
        lastGenerationDate: new Date(),
      },
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/user/me/route.ts
git commit -m "feat(api): include imagesLeft in /api/user/me response"
```

---

## Task 8: Update Dashboard.tsx — DbUser interface and LessonWorkspace prop

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Add imagesLeft to DbUser interface**

In `src/components/Dashboard.tsx`, find the `DbUser` interface:

```typescript
interface DbUser {
  plan: string;
  generationsLeft: number;
  name: string | null;
}
```

Replace with:

```typescript
interface DbUser {
  plan: string;
  generationsLeft: number;
  imagesLeft: number;
  name: string | null;
}
```

- [ ] **Step 2: Update LessonWorkspace render to pass imagesLeft**

In `Dashboard.tsx`, find the `<LessonWorkspace` JSX block. It currently looks like:

```tsx
<LessonWorkspace
  units={selectedUnits}
  activeClass={activeClass}
  onBack={handleBackToDashboard}
  onSaveClassContent={handleSaveClassLesson}
  onContentGenerated={refreshUser}
/>
```

Add the `imagesLeft` prop:

```tsx
<LessonWorkspace
  units={selectedUnits}
  activeClass={activeClass}
  onBack={handleBackToDashboard}
  onSaveClassContent={handleSaveClassLesson}
  onContentGenerated={refreshUser}
  imagesLeft={dbUser?.imagesLeft ?? 0}
/>
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: error about `imagesLeft` not existing on `LessonWorkspaceProps` — this is expected and will be fixed in Task 9.

- [ ] **Step 4: Commit after Task 9 completes** — hold this change, continue to Task 9.

---

## Task 9: Shimmer CSS + full Visual Aids tab in LessonWorkspace

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/LessonWorkspace.tsx`

### Part A — Shimmer CSS

- [ ] **Step 1: Add shimmer styles to globals.css**

Open `src/app/globals.css`. Append after the `@media print` block:

```css
/* ─── Chatbot Refinement Shimmer ───────────────────── */
@keyframes shimmer-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.is-refining {
  position: relative;
  pointer-events: none;
  user-select: none;
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
  pointer-events: none;
}
```

### Part B — LessonWorkspace changes

- [ ] **Step 2: Add imagesLeft to LessonWorkspaceProps interface**

Find the `interface LessonWorkspaceProps` block. Replace it with:

```typescript
interface LessonWorkspaceProps {
  units: WeekUnit[];
  activeClass: Classroom;
  onBack: () => void;
  onSaveClassContent: (classId: string, unitId: string, content: any) => void;
  onContentGenerated?: () => void;
  imagesLeft: number;
}
```

- [ ] **Step 3: Destructure imagesLeft in the component**

Find the component declaration:

```typescript
const LessonWorkspace: React.FC<LessonWorkspaceProps> = ({ units, activeClass, onBack, onSaveClassContent, onContentGenerated }) => {
```

Replace with:

```typescript
const LessonWorkspace: React.FC<LessonWorkspaceProps> = ({ units, activeClass, onBack, onSaveClassContent, onContentGenerated, imagesLeft }) => {
```

- [ ] **Step 4: Add new state variables**

Find the block of existing `useState` declarations (around the `isDownloadOpen` and `isDownloadLoading` lines added in the previous feature). Add these four new states directly after `isDownloadLoading`:

```typescript
const [imageDescription, setImageDescription] = useState('');
const [slideImages, setSlideImages] = useState<{ slideNumber: number; imageUrl: string }[]>([]);
const [isGeneratingSlideImages, setIsGeneratingSlideImages] = useState(false);
const [slideImageProgress, setSlideImageProgress] = useState({ current: 0, total: 0 });
```

- [ ] **Step 5: Update the load-saved-lessons useEffect**

Find the `useEffect` that loads saved lessons on mount. Currently:

```typescript
  useEffect(() => {
    const saved = activeClass.savedLessons?.[unitKey];
    if (saved) {
      setLessonPlan(saved.plan || null); setSlides(saved.slides || null);
      setWorksheets(saved.worksheets || []); setAssignments(saved.assignments || []); setTests(saved.tests || []);
    } else {
      setLessonPlan(null); setSlides(null); setWorksheets([]); setAssignments([]); setTests([]);
    }
  }, [activeClass.id, unitKey]);
```

Replace with:

```typescript
  useEffect(() => {
    const saved = activeClass.savedLessons?.[unitKey];
    if (saved) {
      setLessonPlan(saved.plan || null);
      setSlides(saved.slides || null);
      setWorksheets(saved.worksheets || []);
      setAssignments(saved.assignments || []);
      setTests(saved.tests || []);
      setGeneratedImageUrl(saved.imageUrl || null);
      setSlideImages(saved.slideImages || []);
    } else {
      setLessonPlan(null);
      setSlides(null);
      setWorksheets([]);
      setAssignments([]);
      setTests([]);
      setGeneratedImageUrl(null);
      setSlideImages([]);
    }
  }, [activeClass.id, unitKey]);
```

- [ ] **Step 6: Update the save-content useEffect**

Find the `useEffect` that calls `onSaveClassContent`. Currently:

```typescript
  useEffect(() => {
    onSaveClassContent(activeClass.id, unitKey, { plan: lessonPlan || '', slides: slides || '', worksheets, assignments, tests });
  }, [lessonPlan, slides, worksheets, assignments, tests]);
```

Replace with:

```typescript
  useEffect(() => {
    onSaveClassContent(activeClass.id, unitKey, {
      plan: lessonPlan || '',
      slides: slides || '',
      worksheets,
      assignments,
      tests,
      imageUrl: generatedImageUrl || '',
      slideImages,
    });
  }, [lessonPlan, slides, worksheets, assignments, tests, generatedImageUrl, slideImages]);
```

- [ ] **Step 7: Add new handler functions**

After the existing `handleDocxDownload` function, add these three new handlers:

```typescript
  const handleGenerateImage = async () => {
    setLoading(true);
    try {
      const url = await generateEducationalImage(units[0], imageDescription.trim() || undefined);
      setGeneratedImageUrl(url);
      onContentGenerated?.();
    } catch (e: any) {
      if (e.code === 'IMAGE_LIMIT_REACHED') {
        alert('Daily image limit reached. Resets tomorrow. Upgrade to Pro for 10 images/day.');
      } else if (e.code === 'SAFETY_BLOCK') {
        alert('Image could not be generated — try rephrasing your description.');
      } else {
        alert(e.message || 'Image generation is temporarily unavailable. Try again shortly.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSlideImages = async () => {
    if (!slides) return;
    const slideMatches = [...slides.matchAll(/^## Slide (\d+):\s*(.+)$/gm)];
    if (slideMatches.length === 0) {
      alert('No slides found. Generate slide content first, then come back to generate images.');
      return;
    }
    setIsGeneratingSlideImages(true);
    setSlideImageProgress({ current: 0, total: slideMatches.length });
    const newImages: { slideNumber: number; imageUrl: string }[] = [];
    let generated = 0;
    for (const match of slideMatches) {
      const slideNumber = parseInt(match[1]);
      const slideTitle = match[2].trim();
      try {
        const url = await generateEducationalImage(
          units[0],
          `Educational illustration for a classroom slide titled: "${slideTitle}"`
        );
        newImages.push({ slideNumber, imageUrl: url });
        generated++;
        setSlideImageProgress(prev => ({ ...prev, current: generated }));
        onContentGenerated?.();
      } catch (e: any) {
        if (e.code === 'IMAGE_LIMIT_REACHED') break;
        console.error(`Failed slide ${slideNumber}:`, e);
      }
    }
    setSlideImages(prev => {
      const merged = [...prev];
      for (const img of newImages) {
        const idx = merged.findIndex(s => s.slideNumber === img.slideNumber);
        if (idx >= 0) merged[idx] = img;
        else merged.push(img);
      }
      return merged.sort((a, b) => a.slideNumber - b.slideNumber);
    });
    if (generated < slideMatches.length) {
      alert(`Generated ${generated} of ${slideMatches.length} slide images — daily limit reached. Resets tomorrow.`);
    }
    setIsGeneratingSlideImages(false);
  };

  const handleImageDownload = (imageUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
```

- [ ] **Step 8: Apply shimmer to document content area**

Find the document content wrapper div that contains the `<DocumentHeader />` and all the section render blocks. It looks like:

```tsx
<div className="p-12 lg:p-16 print:p-0">
```

Replace with:

```tsx
<div className={`p-12 lg:p-16 print:p-0 ${isRefining ? 'is-refining' : ''}`}>
```

- [ ] **Step 9: Replace the "Coming Soon" Visual Aids block**

Find this block in the JSX:

```tsx
              {activeSection === 'visuals' && (
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-80">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Visual Elements</h3>
                  <p className="text-slate-500 max-w-sm mb-6">We are currently upgrading our image generation engine. This feature will be available soon!</p>
                  <div className="px-4 py-1.5 bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider rounded-full">Coming Soon</div>
                </div>
              )}
```

Replace with:

```tsx
              {activeSection === 'visuals' && (
                <div className="space-y-8 py-4">
                  {/* Single image generation */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-1">Generate Visual Aid</h3>
                      <p className="text-sm text-slate-500 mb-4">Describe the educational illustration you need for this topic.</p>
                      <textarea
                        value={imageDescription}
                        onChange={e => setImageDescription(e.target.value)}
                        placeholder={`e.g. "A labelled diagram of the water cycle" or "A timeline showing key events"`}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-28 resize-none focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleGenerateImage}
                        disabled={loading || imagesLeft <= 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
                      >
                        {loading
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <ImageIcon className="w-4 h-4" />
                        }
                        Generate Image
                      </button>
                      <span className={`text-xs font-bold ${imagesLeft <= 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {imagesLeft <= 0
                          ? '0 remaining · Resets tomorrow'
                          : `${imagesLeft} image${imagesLeft === 1 ? '' : 's'} remaining today`
                        }
                      </span>
                    </div>

                    {generatedImageUrl && (
                      <div className="space-y-3">
                        <img
                          src={generatedImageUrl}
                          alt="Generated visual aid"
                          className="w-full rounded-xl border border-slate-200 shadow-sm"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleImageDownload(
                              generatedImageUrl,
                              `visual-aid-${units[0].topicTitle.replace(/\s+/g, '-').toLowerCase()}.jpg`
                            )}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            <Download className="w-4 h-4" /> Download Image
                          </button>
                          <button
                            onClick={handleGenerateImage}
                            disabled={loading || imagesLeft <= 0}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                          >
                            ↺ Regenerate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Slide images section — only shown when slides exist */}
                  {slides && (
                    <div className="border-t border-slate-200 pt-8 space-y-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Slide Images</h3>
                        <p className="text-sm text-slate-500">Generate one illustration per slide. Each image uses 1 daily credit.</p>
                      </div>

                      {isGeneratingSlideImages ? (
                        <div className="flex items-center gap-3 text-sm text-slate-600 py-2">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          Generating slide images… ({slideImageProgress.current}/{slideImageProgress.total} complete)
                        </div>
                      ) : (
                        <button
                          onClick={handleGenerateSlideImages}
                          disabled={imagesLeft <= 0 || isGeneratingSlideImages}
                          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Generate Slide Images
                        </button>
                      )}

                      {slideImages.length > 0 && (
                        <div className="space-y-6">
                          {slideImages.map(({ slideNumber, imageUrl }) => (
                            <div key={slideNumber} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Slide {slideNumber}</span>
                                <button
                                  onClick={() => handleImageDownload(
                                    imageUrl,
                                    `slide-${slideNumber}-${units[0].topicTitle.replace(/\s+/g, '-').toLowerCase()}.jpg`
                                  )}
                                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                  <Download className="w-3 h-3" /> Download
                                </button>
                              </div>
                              <img
                                src={imageUrl}
                                alt={`Slide ${slideNumber} illustration`}
                                className="w-full rounded-lg border border-slate-200 shadow-sm"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd "B:/Antigravity/Projects/Curricugen"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit everything**

```bash
git add src/app/globals.css src/components/LessonWorkspace.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add chatbot shimmer overlay and full Visual Aids tab with image generation"
```

---

## Task 10: End-to-end verification

**Files:** None — verification only.

- [ ] **Step 1: Verify TypeScript and build**

```bash
cd "B:/Antigravity/Projects/Curricugen"
npx tsc --noEmit && npm run build
```

Expected: clean build, `/api/generate/image` route in output.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Open http://localhost:3000.

- [ ] **Step 3: Test shimmer during chatbot refinement**

1. Sign in → open a class → generate a lesson plan
2. Open the AI Assistant chat panel (💬)
3. Type "Make the Lesson Flow section shorter" and send
4. **Verify:** While the AI is processing, the document area shows a slow blue shimmer sweep
5. **Verify:** When the response arrives, the shimmer stops and updated content appears
6. **Verify:** All section heading colours are still correct after refinement

- [ ] **Step 4: Test image quota display**

1. Navigate to the Visual Aids tab in the workspace
2. **Verify:** "1 image remaining today" shown for FREE account (or "10 images remaining today" for BETA/PRO)
3. **Verify:** Text area placeholder is visible with example prompts

- [ ] **Step 5: Test image generation**

1. Type "A labelled diagram showing the parts of a plant cell" in the description box
2. Click **Generate Image**
3. **Verify:** Loading spinner shows on the button during generation
4. **Verify:** Image appears below the textarea after ~5-10 seconds
5. **Verify:** "Download Image" and "↺ Regenerate" buttons appear
6. **Verify:** Quota counter decrements by 1

- [ ] **Step 6: Test image download**

1. Click **Download Image**
2. **Verify:** Browser downloads a `.jpg` file named `visual-aid-{topic}.jpg`
3. Open the file — confirm it's a valid JPEG image

- [ ] **Step 7: Test quota exhaustion for FREE account**

1. If testing on FREE account: generate 1 image (uses the daily quota)
2. **Verify:** "0 remaining · Resets tomorrow" message shown, Generate button disabled

- [ ] **Step 8: Test slide images**

1. First generate slide content (go to Slides tab → Generate Now)
2. Return to Visual Aids tab
3. **Verify:** "Slide Images" section is now visible at the bottom
4. Click **Generate Slide Images**
5. **Verify:** Progress indicator shows "Generating slide images… (1/N complete)"
6. **Verify:** Images appear per slide with Download buttons
7. Click a slide image Download — confirm `.jpg` downloads correctly

- [ ] **Step 9: Verify images persist on page refresh**

1. With images generated, refresh the page
2. Navigate back to the same lesson workspace
3. **Verify:** Both `generatedImageUrl` and `slideImages` are restored from saved state

- [ ] **Step 10: Final commit and build confirmation**

```bash
npm run build
```

Expected: clean build. If any errors, fix before proceeding to merge/PR.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Shimmer keyframe CSS | Task 9 Part A |
| `.is-refining` class on document area | Task 9 Step 8 |
| `imagesLeft` + `lastImageDate` on User | Task 1 |
| `IMAGE_LIMITS` constant (FREE=1, PRO/BETA=10) | Task 3 |
| `requireImageAccess()` | Task 3 |
| `consumeImageGeneration()` | Task 3 |
| Imagen model → `imagen-4-fast-generate-001` | Task 4 |
| `description?` param in `generateEducationalImageServer` | Task 4 |
| `description?` param in client `generateEducationalImage` | Task 5 |
| Image route uses `requireImageAccess` | Task 6 |
| Safety block error code `SAFETY_BLOCK` | Task 6 |
| `/api/user/me` returns `imagesLeft` | Task 7 |
| `DbUser` interface adds `imagesLeft` | Task 8 |
| `imagesLeft` prop passed to LessonWorkspace | Task 8 |
| Freeform description textarea | Task 9 Step 9 |
| Quota display label | Task 9 Step 9 |
| Disabled state when quota = 0 | Task 9 Step 9 |
| Single image download | Task 9 Step 9 |
| Regenerate button | Task 9 Step 9 |
| Slide images section (only when slides exist) | Task 9 Step 9 |
| Sequential slide batch generation | Task 9 Step 7 |
| Progress indicator during batch | Task 9 Step 9 |
| Partial batch message on quota hit | Task 9 Step 7 |
| Slide image download per-slide | Task 9 Step 9 |
| Images saved to savedLessons | Task 9 Steps 5 & 6 |
| Images restored on load | Task 9 Step 5 |
| `LessonContent` type updated | Task 2 |
