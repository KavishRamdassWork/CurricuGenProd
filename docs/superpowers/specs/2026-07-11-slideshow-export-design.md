# Slideshow Export (.pptx) — Design Spec
**Date:** 2026-07-11
**Project:** CurricuGen Pro
**Sub-project:** 3 of 3 (PowerPoint export)
**Status:** Approved

---

## 1. Problem Statement

The "Slides" tab in the Lesson Workspace generates a markdown outline (`## Slide N: Title` headings with bullet content) and, optionally, one AI-illustrated image per slide. Today a teacher can only read this as a document (rendered markdown, or exported to PDF/DOCX like any other tab) — there is no way to get an actual slide deck they can project or hand off to PowerPoint/Google Slides.

## 2. Scope

**In scope:**
- A "Download as PowerPoint" option in the existing Download dropdown, shown only on the Slides tab
- Server-side `.pptx` generation from the existing slide markdown + existing generated slide images
- An auto-generated title slide using the same branding data (school name/logo) already configurable via Template settings
- Two content-slide layouts: text-only (centered title + bullets) and image slide (title + bullets left, image right)

**Out of scope:**
- Live Google Slides API integration (OAuth, Drive write access) — a `.pptx` download is compatible with Google Slides via File > Import, which covers the stated need without that infrastructure
- An in-app full-screen presenter/"present mode" view
- Editing slide content from within the exported deck (teachers edit in PowerPoint/Slides after download, same as the existing DOCX export model)
- Custom per-slide layout choice by the teacher — layout is chosen automatically based on whether the slide has a generated image

---

## 3. Architecture Overview

```
package.json                          ← add pptxgenjs dependency
src/app/api/export/pptx/route.ts      ← NEW: POST endpoint, builds .pptx, returns buffer
src/lib/slideParser.ts                ← NEW: parses "## Slide N: Title" markdown into structured slides
src/components/LessonWorkspace.tsx    ← handlePptxDownload(); new Download dropdown item (Slides tab only)
```

**Single source of truth for slide content:** the same `slides` markdown string and `slideImages` array already held in `LessonWorkspace.tsx` state and persisted in `savedLessons[unitKey]`. No new state, no new AI calls — this is a pure reformatting/export feature.

---

## 4. Slide Parsing

### 4.1 `src/lib/slideParser.ts` (new file)

Extracted into its own module because both the existing slide-image generator (`LessonWorkspace.tsx:317`, inline regex today) and the new pptx exporter need the same parsing logic — consolidating avoids the two drifting out of sync.

```typescript
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

### 4.2 Update the existing inline regex to use the shared parser

`LessonWorkspace.tsx:317` currently does:
```typescript
const slideMatches = [...slides.matchAll(/^## Slide (\d+):\s*(.+)$/gm)];
```
This stays as-is for `handleGenerateSlideImages` (it only needs slide numbers + titles, not bullets) — no behavior change required there. The new pptx path uses `parseSlideMarkdown` instead of a second inline regex, so there's exactly one parser for "slide number + title" matching, and the new code doesn't duplicate it.

---

## 5. PPTX Generation

### 5.1 `src/app/api/export/pptx/route.ts` (new file)

Mirrors the shape of `src/app/api/export/docx/route.ts`: auth check, body validation, buffer response.

```typescript
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

`slideImages[].imageUrl` is already stored as a base64 data URI (same format used elsewhere in the app for `generatedImageUrl`/`slideImages` — see `LessonContent.imageUrl`), which `pptxgenjs`'s `addImage({ data })` accepts directly — no extra encoding step needed.

### 5.2 Dependency

Add to `package.json`:
```
"pptxgenjs": "^4.0.1"
```

No new environment variables, no new external service — generation is fully local/offline like the DOCX export.

---

## 6. Client Wiring

### 6.1 `handlePptxDownload` in `LessonWorkspace.tsx`

Sibling to the existing `handleDocxDownload` (same file, same error-handling shape):

```typescript
const handlePptxDownload = async () => {
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
    alert(asGenerationError(e).message || 'Could not generate PowerPoint file.');
  } finally {
    setIsDownloadLoading(false);
    setIsDownloadOpen(false);
  }
};
```

### 6.2 Download dropdown — new item, Slides tab only

In the Download dropdown block (`LessonWorkspace.tsx:474` onward), add a fourth item between "Download as Word" and "Print", rendered conditionally:

```tsx
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
```

`hasContent` and `exportData` are already computed in this block's closure (`const exportData = getCurrentExport(); const hasContent = !!exportData.content;`) — no new derived state needed.

---

## 7. Error Handling Summary

| Scenario | Behaviour |
|---|---|
| No slide content generated yet | Download button disabled (`!hasContent`), same as existing PDF/Word buttons |
| Empty `slidesMarkdown` reaches the API somehow | 400 `{ error: 'Missing or empty slide content' }` |
| `pptxgenjs` throws during generation | 500 `{ error: 'PowerPoint generation failed. Try downloading as PDF instead.' }` — mirrors the DOCX route's fallback message |
| A slide has no matching entry in `slideImages` | Falls through to the text-only layout automatically — not an error |
| Unauthenticated request | 401, same guard pattern as every other route in the app |

No AI generation call is involved, so there is no `LIMIT_REACHED` path and no generation-credit consumption — this is purely reformatting data the teacher already generated and paid credits for once.

---

## 8. Files Changed

| File | Change |
|---|---|
| `package.json` | Add `pptxgenjs` dependency |
| `src/lib/slideParser.ts` | New file — `parseSlideMarkdown()`, shared by pptx export (image generation's inline regex is untouched, out of scope) |
| `src/app/api/export/pptx/route.ts` | New file — POST endpoint generating and returning a `.pptx` buffer |
| `src/components/LessonWorkspace.tsx` | `handlePptxDownload()`; new conditional Download-dropdown item (Slides tab only) |

---

## 9. Constraints & Decisions

- **`.pptx` download, not a live Google Slides API integration** — a standard OOXML file opens natively in PowerPoint and imports cleanly into Google Slides (File > Import), covering the stated need without OAuth/Drive-scope infrastructure.
- **No in-app presenter/full-screen mode** — teachers present from PowerPoint/Google Slides itself after downloading, consistent with how the DOCX/PDF exports already hand off to external tools rather than building an in-app viewer.
- **Layout chosen automatically per slide** (image vs. text-only), not teacher-configurable — keeps the exporter simple; the existing slide-image feature already determines which slides "have" an image, so the exporter just follows that.
- **Image-slide layout: text left (~55%) / image right (~45%)** — chosen over a full-bleed image-with-overlay layout because it keeps bullet text fully legible regardless of the generated image's content or aspect ratio.
- **Title slide always included** — reuses the same school-branding data already wired into the DOCX export's document header, so there's no new configuration surface for the teacher.
- **No new AI calls, no credit cost** — this endpoint only reformats data the teacher already generated (and already paid a generation credit for).
- **`slideParser.ts` extracted rather than inlined** — the pptx exporter and the existing slide-image generator both need "slide number + title" parsing; a shared module prevents the regex from drifting between the two call sites over time.
