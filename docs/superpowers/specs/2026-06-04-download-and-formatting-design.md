# Download & Content Formatting — Design Spec
**Date:** 2026-06-04  
**Project:** CurricuGen Pro  
**Status:** Approved

---

## 1. Problem Statement

CurricuGen Pro generates high-quality AI curriculum content but has two critical gaps:

1. **No download capability** — teachers can only print via `window.print()` with no control over format. There is no way to save a PDF or share an editable Word document with colleagues or students.
2. **Poor content formatting** — generated markdown renders as an undifferentiated wall of bold text with no visual hierarchy. Teacher-facing content (lesson plans) and student-facing content (worksheets, tests) look identical and unprofessional.

---

## 2. Scope

This spec covers two tightly related features delivered together:

- **Feature A:** Download dropdown (PDF + DOCX) in the Lesson Workspace toolbar
- **Feature B:** Content formatting improvements — colour-coded section cards for teacher docs, print-ready student document style, and consistent AI prompt structure to support both

Out of scope: image export, bulk classroom export, email sharing.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  LessonWorkspace                                            │
│                                                             │
│  ┌─────────────┐   generates   ┌──────────────────────┐    │
│  │ AI prompts  │ ────────────▶ │  Markdown string     │    │
│  │ (structured │               │  (single source of   │    │
│  │  sections)  │               │   truth)             │    │
│  └─────────────┘               └──────────┬───────────┘    │
│                                           │                 │
│  ┌─────────────┐   refines     ┌──────────▼───────────┐    │
│  │  AI Chatbot │ ◀────────────▶│  RenderMarkdown       │    │
│  │ (preserves  │               │  (closure counter     │    │
│  │  headings)  │               │   for h2 colouring)   │    │
│  └─────────────┘               └──────────┬───────────┘    │
│                                           │                 │
│                              ┌────────────┴────────────┐   │
│                              │   Download dropdown      │   │
│                              │   PDF → window.print()   │   │
│                              │   DOCX → /api/export/    │   │
│                              │          docx            │   │
│                              └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** The markdown string is the single source of truth. The AI generates it, the chatbot refines it, the renderer displays it, and the export functions consume it. Nothing in the visual layer writes back to the content.

---

## 4. Feature A — Download

### 4.1 UI: Download Dropdown

**Location:** Top-right toolbar in `LessonWorkspace.tsx`, replacing the standalone print icon.

**Structure:**
```
[ ⬇ Download ▼ ]
  ├── 📄 Download as PDF
  ├── 📝 Download as Word (.docx)
  └── 🖨  Print
```

- The dropdown is a controlled React state (`isDownloadOpen: boolean`)
- Closes on outside click (standard dismiss pattern)
- All three options are **disabled** with a tooltip ("Generate content first") when the active view has no content
- The button itself lives in `LessonWorkspace.tsx` alongside the existing Settings and Chat buttons

**Context-aware filename:** The export title is derived from the active view:

| Active section | Export filename |
|---|---|
| Lesson Plan | `Lesson Plan — {topicTitle}` |
| Slides | `Slide Outline — {topicTitle}` |
| Worksheet / Assignment / Test | `{resource.title}` |
| Game | `Activity — {topicTitle}` |
| Resources | `Resources — {topicTitle}` |

### 4.2 PDF Export

**Mechanism:** `window.print()` with a dedicated `@media print` stylesheet added to `globals.css`.

**Print CSS behaviour:**
- Hides: left sidebar, top toolbar, AI chat panel, download dropdown, loading overlays, all buttons
- Shows: document content area only, expanding to full page width
- Page setup: A4, portrait, margins 20mm all sides
- Page breaks: `page-break-inside: avoid` on every h2 section card so a section header never strands at the bottom of a page
- Font: switches body to a serif stack (`Georgia, 'Times New Roman', serif`) for print readability
- The school name / logo from `templateConfig` is preserved if set

**No new dependencies required.**

### 4.3 DOCX Export

**New server route:** `POST /api/export/docx`

**Request body:**
```ts
{
  content: string;       // current markdown string
  title: string;         // derived filename (no extension)
  docType: 'teacher' | 'student'; // controls DOCX styling
  metadata: {
    subject: string;
    grade: string;
    className: string;
    schoolName?: string; // from templateConfig
  }
}
```

**Response:** Binary `.docx` stream with headers:
```
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="{title}.docx"
```

**Pipeline (using `remark-docx`):**
```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDocx from 'remark-docx';
import { latexPlugin } from 'remark-docx/plugins/latex';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)       // tables, task lists
  .use(remarkMath)      // $inline$ and $$block$$ math
  .use(remarkDocx, {
    plugins: [latexPlugin()],  // renders math as Office Math (OMML)
    // teacher vs student styling passed via custom plugin
  });
```

**Why `remark-docx`:**
- Uses the same `unified` / `remark-gfm` / `remark-math` pipeline already in the project — no separate markdown parser
- LaTeX math renders as native Office Math (OMML) — not an image — so it is editable in Word
- GFM tables render as proper Word tables
- Custom heading plugins allow DOCX headings to match the on-screen colour-coded card style
- Outputs an `ArrayBuffer` that streams directly from the API route — no temp files, no disk I/O

**Teacher DOCX style:** Custom `remark-docx` heading plugin maps h2 index → Word paragraph shading colour (blue, green, amber, purple, slate) matching the on-screen cards.

**Student DOCX style:** h2 headings render as dark-background Word paragraphs (matching the approved student document design). A document header block (subject, grade, name/date/marks fields) is prepended programmatically before the markdown content is processed.

**Auth:** The route is protected by Clerk auth (`auth()` from `@clerk/nextjs/server`). DOCX export does **not** consume a generation credit — it is an export of already-generated content.

**Client trigger (in `LessonWorkspace.tsx`):**
```ts
const handleDocxDownload = async () => {
  const res = await fetch('/api/export/docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, title, docType, metadata }),
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.docx`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## 5. Feature B — Content Formatting

### 5.1 AI Prompt Restructuring (`aiService.ts`)

Every generation function is updated to enforce a **fixed section order**. The AI writes freely within each section but sections always appear in the same sequence. This makes positional rendering reliable.

**Lesson Plan — enforced section order:**
```
## Objective & Success Criteria
## Key Concepts & Vocabulary
## Materials Needed
## Common Misconceptions
## Differentiation Strategies
## Lesson Flow
## Closure & Exit Ticket
```

**Slide Outline — enforced per-slide structure:**
```
## Slide {N}: {Title}
### Bullet Points
### Speaker Notes
### Suggested Visual
```

**Worksheet / Assignment / Test — enforced student document structure:**
```
# {Document Title}
**Subject:** · **Grade:** · **Total:** · **Time:**
---
## Section A — {Question Type} ({marks} marks)
## Section B — {Question Type} ({marks} marks)
## Section C — {Question Type} ({marks} marks)
```

**Curriculum context isolation:** The Pinecone RAG injection block remains in its own clearly labelled section at the top of every prompt (`OFFICIAL CURRICULUM CONTEXT — YOU MUST ADHERE TO THIS:`), separated from formatting instructions by a horizontal divider in the prompt string. These two concerns never share a paragraph.

**Chatbot refinement resilience:** The `refineContent` prompt gains an explicit instruction:
> "Preserve the existing section heading structure exactly. You may rewrite content within sections but do not rename, reorder, merge, or remove section headings (`##` level). Return only the updated Markdown."

### 5.2 In-App Rendering (`LessonWorkspace.tsx` + `globals.css`)

**Mechanism:** A closure counter inside the `RenderMarkdown` component tracks how many `h2` elements have been rendered in the current pass and applies positional styles.

```tsx
const RenderMarkdown = ({ children, docType = 'teacher' }: { children: string; docType?: 'teacher' | 'student' }) => {
  let h2Index = 0; // resets fresh on every render — reliable with synchronous ReactMarkdown

  const teacherH2Colors = [
    { bg: '#eff6ff', border: '#2563eb', text: '#1e3a8a' }, // Objective — blue
    { bg: '#eef2ff', border: '#4f46e5', text: '#312e81' }, // Key Concepts — indigo
    { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' }, // Materials — green
    { bg: '#fffbeb', border: '#d97706', text: '#78350f' }, // Misconceptions — amber
    { bg: '#faf5ff', border: '#9333ea', text: '#581c87' }, // Differentiation — purple
    { bg: '#f8fafc', border: '#475569', text: '#1e293b' }, // Lesson Flow — slate
    { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' }, // Closure — green (fallback)
  ];

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h2: ({ children, ...props }) => {
          if (docType === 'teacher') {
            const color = teacherH2Colors[Math.min(h2Index, teacherH2Colors.length - 1)];
            h2Index++;
            return (
              <h2
                style={{
                  background: color.bg,
                  borderLeft: `4px solid ${color.border}`,
                  color: color.text,
                  padding: '10px 16px',
                  borderRadius: '0 8px 8px 0',
                  marginTop: '2rem',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}
                {...props}
              >
                {children}
              </h2>
            );
          }
          // Student doc: dark header bar
          h2Index++;
          return (
            <h2
              style={{
                background: '#0f172a',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '4px',
                marginTop: '2rem',
                fontWeight: 800,
                fontSize: '1rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
              {...props}
            >
              {children}
            </h2>
          );
        },
        // Existing table/thead/th/td overrides preserved
        table: ({ ...props }) => (
          <div className="overflow-x-auto my-6">
            <table className="min-w-full text-sm divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden" {...props} />
          </div>
        ),
        thead: ({ ...props }) => <thead className="bg-slate-50" {...props} />,
        th: ({ ...props }) => <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider" {...props} />,
        td: ({ ...props }) => <td className="px-4 py-3 border-t border-slate-200" {...props} />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
};
```

The `docType` prop is passed from the parent section in `LessonWorkspace`. The mapping is exhaustive and covers every content type:

| Workspace section | `docType` |
|---|---|
| Lesson Plan | `teacher` |
| Slides | `teacher` |
| Game / Activity | `teacher` |
| Extra Resources | `teacher` |
| Worksheet | `student` |
| Assignment | `student` |
| Test / Assessment | `student` |
| Memo (answer key) | `student` |

### 5.3 Print Stylesheet (`globals.css`)

A dedicated `@media print` block is added. Key rules:

```css
@media print {
  /* Hide all UI chrome */
  aside, header, [data-no-print], .no-print { display: none !important; }

  /* Expand document to full page */
  .print\:shadow-none { box-shadow: none !important; }
  main { padding: 0 !important; }
  .bg-white.shadow-xl { border-radius: 0 !important; }

  /* Page setup */
  @page { size: A4 portrait; margin: 20mm; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; color: #000; }

  /* Prevent section headers orphaning at page bottom */
  h2, h3 { page-break-after: avoid; }
  h2 + *, h3 + * { page-break-before: avoid; }
  
  /* Student docs: preserve dark section headers in print */
  .student-doc h2 { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Teacher docs: preserve coloured card backgrounds */
  .teacher-doc h2 { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

---

## 6. New Files & Changed Files

| File | Change |
|---|---|
| `src/components/LessonWorkspace.tsx` | Add download dropdown; update `RenderMarkdown` with closure counter and `docType` prop; pass `docType` per section |
| `src/app/globals.css` | Add `@media print` block; minor refinements to `.markdown-body` base styles |
| `src/lib/aiService.ts` | Restructure all generation prompts for fixed section order; update `refineContent` prompt with heading-preservation instruction |
| `src/app/api/export/docx/route.ts` | **New** — POST endpoint, Clerk auth, remark-docx pipeline, binary response |

---

## 7. Dependencies

One new production dependency: **`remark-docx`** (latest stable — exact version pinned at implementation time).

`remark-parse`, `remark-gfm`, and `remark-math` are already in the project. `unified` is a transitive dependency already present.

No new dev dependencies.

---

## 8. Error Handling

| Scenario | Behaviour |
|---|---|
| DOCX route — unauthenticated request | 401 JSON response; client shows alert |
| DOCX route — content exceeds Vercel's 4MB body limit | 413 response; client shows "Document too large to export. Try exporting individual sections." (In practice this limit will not be hit by normal generated content.) |
| DOCX route — remark-docx throws | 500 response; client shows "DOCX generation failed. Try downloading as PDF instead." |
| PDF — browser blocks print dialog | No handling needed — browser UI handles this |
| Download dropdown — no content in active view | Buttons disabled with `title="Generate content first"` tooltip |
| Chatbot refine breaks section structure | Graceful degradation — colour counter still runs, just assigns colours to whatever h2s exist |

---

## 9. Constraints & Decisions

- **No generation credit consumed for export** — exporting is not a generation; it transforms existing content
- **`remark-docx` over `docx` package** — avoids writing a custom markdown-to-DOCX mapper; math support is critical for Science/Maths teachers
- **Closure counter over CSS nth-of-type** — more explicit, handles mixed h1/h2 content, survives chatbot refinement
- **`window.print()` over React-PDF** — zero additional bundle weight, no Vercel cold-start concern, excellent for document-style content
- **Pinecone RAG block stays isolated** — curriculum adherence prompt block is never in the same paragraph as formatting instructions; they cannot compete
