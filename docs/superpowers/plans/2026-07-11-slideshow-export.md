# Slideshow Export (.pptx) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher download the AI-generated slide outline (with any generated slide images) as a real `.pptx` file that opens in PowerPoint or imports into Google Slides.

**Architecture:** A shared `parseSlideMarkdown()` helper turns the existing `## Slide N: Title` markdown into structured slides. A new `/api/export/pptx` route (mirroring the existing `/api/export/docx` route's auth/validation/buffer-response shape) uses `pptxgenjs` to build a title slide plus one content slide per parsed slide — image layout when a matching `slideImages` entry exists, text-only layout otherwise. The client adds a "Download as PowerPoint" item to the existing Download dropdown, visible only on the Slides tab.

**Tech Stack:** Next.js 16.2 App Router, TypeScript, `pptxgenjs` (new dependency), Clerk auth.

**Spec:** `docs/superpowers/specs/2026-07-11-slideshow-export-design.md`

---

### Task 1: Add `pptxgenjs` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

Run:
```bash
npm install pptxgenjs@^4.0.1
```

- [ ] **Step 2: Verify**

Run: `grep pptxgenjs package.json`
Expected: a line like `"pptxgenjs": "^4.0.1"` under `dependencies`.

Run: `npx tsc --noEmit`
Expected: no errors (package installed but not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pptxgenjs dependency for slideshow export"
```

---

### Task 2: `parseSlideMarkdown` helper

**Files:**
- Create: `src/lib/slideParser.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/lib/slideParser.ts
export interface ParsedSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
}

/** Splits a slide markdown outline ("## Slide N: Title" headings) into
 *  structured slides. Non-list body lines under a heading become single
 *  bullets (flattened prose), matching how teachers actually write content. */
export function parseSlideMarkdown(markdown: string): ParsedSlide[] {
  const slideBlocks = markdown.split(/(?=^## Slide \d+:)/m).filter(b => b.trim());

  return slideBlocks.map(block => {
    const headingMatch = block.match(/^## Slide (\d+):\s*(.+)$/m);
    const slideNumber = headingMatch ? parseInt(headingMatch[1], 10) : 0;
    const title = headingMatch ? headingMatch[2].trim() : 'Untitled Slide';

    const body = block.replace(/^## Slide \d+:.+$/m, '').trim();
    const bullets = body
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);

    return { slideNumber, title, bullets };
  });
}
```

- [ ] **Step 2: Verify manually**

No test runner is configured in this repo (`package.json` scripts only has dev/build/start/lint/postinstall) — verify with a throwaway check instead of an automated test:

```bash
node -e "
const ts = require('fs').readFileSync('src/lib/slideParser.ts', 'utf8');
console.log(ts.includes('export function parseSlideMarkdown') ? 'OK: exported' : 'FAIL');
"
npx tsc --noEmit
```
Expected: `OK: exported`, and no TypeScript errors.

Also do a quick logical trace by hand against this input to confirm correctness before moving on:
```
## Slide 1: Introduction
- Point one
- Point two

## Slide 2: Deep Dive
Some prose sentence.
- A bullet
```
Expected result: `[{slideNumber:1, title:'Introduction', bullets:['Point one','Point two']}, {slideNumber:2, title:'Deep Dive', bullets:['Some prose sentence.','A bullet']}]`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/slideParser.ts
git commit -m "feat(slide-parser): add parseSlideMarkdown for structured slide extraction"
```

---

### Task 3: `/api/export/pptx` route

**Files:**
- Create: `src/app/api/export/pptx/route.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/app/api/export/pptx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import PptxGenJS from 'pptxgenjs';
import { parseSlideMarkdown } from '@/lib/slideParser';

interface ExportPptxBody {
  slidesMarkdown: string;
  slideImages: { slideNumber: number; imageUrl: string }[];
  title: string;
  metadata: {
    subject?: string;
    grade?: string;
    schoolName?: string;
    logo?: string | null; // base64 data URI
  };
}

const COLORS = {
  title: '0F172A',
  bullet: '334155',
  accent: '2563EB',
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ExportPptxBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { slidesMarkdown, slideImages, title, metadata } = body;

  if (!slidesMarkdown || typeof slidesMarkdown !== 'string' || slidesMarkdown.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or empty slide content' }, { status: 400 });
  }

  try {
    const pres = new PptxGenJS();
    pres.defineLayout({ name: 'WIDESCREEN', width: 10, height: 5.63 });
    pres.layout = 'WIDESCREEN';

    // ── Title slide ──────────────────────────────────────────────
    const titleSlide = pres.addSlide();
    if (metadata.logo) {
      titleSlide.addImage({ data: metadata.logo, x: 0.4, y: 0.4, w: 0.9, h: 0.9 });
    }
    if (metadata.schoolName) {
      titleSlide.addText(metadata.schoolName, {
        x: 0.4, y: 1.5, w: 9.2, h: 0.4,
        fontSize: 14, color: COLORS.accent, bold: true, align: 'center',
      });
    }
    titleSlide.addText(title, {
      x: 0.4, y: 2.0, w: 9.2, h: 1.0,
      fontSize: 32, color: COLORS.title, bold: true, align: 'center',
    });
    const subtitleParts = [metadata.subject, metadata.grade].filter(Boolean);
    if (subtitleParts.length > 0) {
      titleSlide.addText(subtitleParts.join(' • '), {
        x: 0.4, y: 3.0, w: 9.2, h: 0.5,
        fontSize: 16, color: COLORS.bullet, align: 'center',
      });
    }

    // ── Content slides ───────────────────────────────────────────
    const parsedSlides = parseSlideMarkdown(slidesMarkdown);
    const imageBySlideNumber = new Map(slideImages.map(img => [img.slideNumber, img.imageUrl]));

    for (const slide of parsedSlides) {
      const s = pres.addSlide();
      const image = imageBySlideNumber.get(slide.slideNumber);

      if (image) {
        // Layout A: text left (~55%), image right (~45%)
        s.addText(slide.title, {
          x: 0.4, y: 0.4, w: 5.2, h: 0.8,
          fontSize: 24, color: COLORS.title, bold: true,
        });
        s.addText(slide.bullets.map(b => ({ text: b, options: { bullet: true, breakLine: true } })), {
          x: 0.4, y: 1.3, w: 5.2, h: 3.8,
          fontSize: 14, color: COLORS.bullet, valign: 'top',
        });
        s.addImage({ data: image, x: 5.9, y: 0.4, w: 3.7, h: 4.7, sizing: { type: 'contain', w: 3.7, h: 4.7 } });
      } else {
        // Text-only: centered title + bullets
        s.addText(slide.title, {
          x: 0.6, y: 0.5, w: 8.8, h: 0.8,
          fontSize: 26, color: COLORS.title, bold: true, align: 'center',
        });
        s.addText(slide.bullets.map(b => ({ text: b, options: { bullet: true, breakLine: true } })), {
          x: 1.2, y: 1.5, w: 7.6, h: 3.5,
          fontSize: 16, color: COLORS.bullet, valign: 'top',
        });
      }
    }

    const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;

    const safeTitle = title
      .replace(/[\r\n]/g, '')
      .replace(/[^\w \-–—]/g, '')
      .trim() || 'slides';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeTitle)}.pptx"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('PPTX generation error:', error);
    return NextResponse.json({ error: 'PowerPoint generation failed. Try downloading as PDF instead.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `pptxgenjs`'s TypeScript types don't match the exact option shapes used above (library type surface can shift between minor versions), fix the specific type mismatches reported — do not cast to `any` to silence them; use the actual types `pptxgenjs` exports (e.g. `TextPropsOptions`, `ImageProps`) or narrow the object literal to satisfy them.

- [ ] **Step 3: Manual verification — generate a real file**

Since there's no test runner, verify by actually calling the route. Start the dev server and hit it directly with a signed-in browser session (DevTools console on `/dashboard` carries the session cookie automatically):

```bash
npm run dev
```

In the browser DevTools console on `/dashboard`:
```js
fetch('/api/export/pptx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    slidesMarkdown: '## Slide 1: Introduction\n- Point one\n- Point two\n\n## Slide 2: Deep Dive\n- Another point',
    slideImages: [],
    title: 'Test Deck',
    metadata: { subject: 'Mathematics', grade: 'Grade 5', schoolName: 'Test School', logo: null },
  }),
}).then(r => r.blob()).then(b => {
  const url = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = url; a.download = 'test.pptx'; a.click();
});
```
Expected: a `test.pptx` file downloads. Open it in PowerPoint (or import into Google Slides) and confirm: title slide shows "Test Deck" / "Mathematics • Grade 5" / "Test School"; two content slides show the correct titles and bullets, text-only layout (no image was supplied).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/export/pptx/route.ts
git commit -m "feat(export): add /api/export/pptx route for slideshow generation"
```

---

### Task 4: Client wiring — `handlePptxDownload` + Download dropdown item

**Files:**
- Modify: `src/components/LessonWorkspace.tsx`

- [ ] **Step 1: Add `handlePptxDownload`**

Current (`src/components/LessonWorkspace.tsx:255-291`, the existing `handleDocxDownload` — new function goes immediately after it, before whatever function currently follows):

```tsx
  const handleDocxDownload = async () => {
    setIsDownloadOpen(false);
    const { content, docType, title } = getCurrentExport();
    if (!content) return;
    setIsDownloadLoading(true);
    try {
      const res = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          title,
          docType,
          metadata: {
            subject: activeClass.subject,
            grade: activeClass.grade,
            className: activeClass.name,
            schoolName: templateConfig.schoolName || undefined,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'DOCX generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate Word document.';
      alert(msg + ' Try downloading as PDF instead.');
```

Read the actual current file at and after line 291 to find the exact closing of `handleDocxDownload` (the `finally` block and closing brace) before inserting — do not guess the exact brace placement, confirm it from the live file.

Add this new function directly after `handleDocxDownload`'s closing brace:

```tsx
  const handlePptxDownload = async () => {
    setIsDownloadOpen(false);
    if (activeSection !== 'slides' || !slides) return;
    setIsDownloadLoading(true);
    try {
      const res = await fetch('/api/export/pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slidesMarkdown: slides,
          slideImages,
          title: `Slide Outline — ${units[0].topicTitle}`,
          metadata: {
            subject: activeClass.subject,
            grade: activeClass.grade,
            schoolName: templateConfig.schoolName || undefined,
            logo: templateConfig.logo,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'PPTX generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${units[0].topicTitle} - Slides.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = asGenerationError(e);
      alert(err.message || 'Could not generate PowerPoint file.');
    } finally {
      setIsDownloadLoading(false);
    }
  };
```

Note: `asGenerationError` is the shared error-narrowing helper already defined near the top of this file (`type GenerationError = { code?: string; message?: string }; const asGenerationError = (e: unknown): GenerationError => e as GenerationError;`) — reuse it rather than redefining error handling inline, for consistency with every other catch block in this file.

- [ ] **Step 2: Add the Download dropdown item**

Current (`src/components/LessonWorkspace.tsx:493-506`):
```tsx
                      <div className="border-t border-slate-100" />
                      <button
                        onClick={handleDocxDownload}
                        disabled={!hasContent}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!hasContent ? 'Generate content first' : undefined}
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <div className="text-left">
                          <div className="font-bold">Download as Word</div>
                          <div className="text-xs text-slate-400">Editable .docx file</div>
                        </div>
                      </button>
                      <div className="border-t border-slate-100" />
```

New — insert the pptx item between "Download as Word" and the following divider:
```tsx
                      <div className="border-t border-slate-100" />
                      <button
                        onClick={handleDocxDownload}
                        disabled={!hasContent}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!hasContent ? 'Generate content first' : undefined}
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <div className="text-left">
                          <div className="font-bold">Download as Word</div>
                          <div className="text-xs text-slate-400">Editable .docx file</div>
                        </div>
                      </button>
                      {activeSection === 'slides' && (
                        <>
                          <div className="border-t border-slate-100" />
                          <button
                            onClick={handlePptxDownload}
                            disabled={!hasContent}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={!hasContent ? 'Generate content first' : undefined}
                          >
                            <MonitorPlay className="w-4 h-4 text-orange-500" />
                            <div className="text-left">
                              <div className="font-bold">Download as PowerPoint</div>
                              <div className="text-xs text-slate-400">.pptx — opens in PowerPoint or Google Slides</div>
                            </div>
                          </button>
                        </>
                      )}
                      <div className="border-t border-slate-100" />
```

`MonitorPlay` is already imported in this file (used by the "Slides" `NavButton` at line ~407) — no new icon import needed. `hasContent` and `activeSection` are both already in scope inside this closure (`const exportData = getCurrentExport(); const hasContent = !!exportData.content;` at line 475, and `activeSection` is component state).

- [ ] **Step 3: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open a class with generated slide content on `/dashboard`, navigate to the Slides tab, open the Download dropdown.
Expected: "Download as PowerPoint" appears only when the Slides tab is active (switch to Lesson Plan tab and reopen the dropdown — it should be gone). Click it on the Slides tab — a `.pptx` file downloads. Open it and confirm it matches the content shown in the app, including any generated slide image on the correct slide.

- [ ] **Step 5: Commit**

```bash
git add src/components/LessonWorkspace.tsx
git commit -m "feat(lesson-workspace): add PowerPoint download for slide outlines"
```

---

### Task 5: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, all routes listed including `/api/export/pptx`, no type errors.

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: 0 errors (warnings pre-existing and acceptable, per the just-completed lint cleanup — do not introduce new errors).

No commit for this task — it's verification only. If either check fails, return to the relevant task and fix before proceeding to code review.
