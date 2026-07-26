# Mobile Content Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix generated lesson content (lesson plans, slides, games, resources, worksheets/tests/memos) rendering too squashed and narrow on mobile, by removing the desktop "paper card" chrome below `md:`, shrinking wrapper padding, scaling down typography, and tightening table cell sizing on small screens.

**Architecture:** Pure Tailwind-breakpoint CSS/JSX changes to `src/components/LessonWorkspace.tsx` (wrapper `className`s and the custom `table`/`th`/`td` markdown renderers) and `src/app/globals.css` (`.markdown-body` typography, mobile-first with a `@media (min-width: 768px)` block restoring current desktop values). No new components, no new state, no JS viewport detection — matches the pattern used in the two prior mobile phases.

**Tech Stack:** Next.js 16 / React 19, Tailwind CSS v4, react-markdown, plain CSS in `globals.css`.

---

## Task 1: Shrink outer/inner wrapper padding and defer paper-card chrome to `md:`

**Files:**
- Modify: `src/components/LessonWorkspace.tsx:622` (outer scroll wrapper)
- Modify: `src/components/LessonWorkspace.tsx:623` (paper card)
- Modify: `src/components/LessonWorkspace.tsx:630` (inner content wrapper)

- [ ] **Step 1: Change outer scroll wrapper padding**

Current:
```tsx
<div className="flex-1 overflow-y-auto p-8 md:p-12 relative bg-slate-100">
```
New:
```tsx
<div className="flex-1 overflow-y-auto p-2 md:p-12 relative bg-slate-100">
```

- [ ] **Step 2: Defer paper-card shadow/rounding to `md:`**

Current:
```tsx
<div className="mx-auto min-h-[1000px] bg-white shadow-xl rounded-xl overflow-hidden print:shadow-none print:rounded-none">
```
New:
```tsx
<div className="mx-auto min-h-[1000px] bg-white md:shadow-xl md:rounded-xl overflow-hidden print:shadow-none print:rounded-none">
```

- [ ] **Step 3: Shrink inner content padding**

Current:
```tsx
<div className={`p-12 lg:p-16 print:p-0 ${isRefining ? 'is-refining' : ''}`}>
```
New:
```tsx
<div className={`p-5 md:p-12 lg:p-16 print:p-0 ${isRefining ? 'is-refining' : ''}`}>
```

- [ ] **Step 4: Verify in browser at mobile viewport**

Start the dev server preview, resize the Browser pane to the `mobile` preset (375×812), navigate to a class with existing generated content (Lesson Plan tab), and take a screenshot.

Expected: card has no visible shadow/rounded corners, background is edge-to-edge white against the slate page background, roughly 300+px of horizontal text width available (verify padding via `javascript_tool` computing `getComputedStyle` on the inner content div if the screenshot is ambiguous).

- [ ] **Step 5: Verify desktop is unchanged**

Resize the Browser pane to the `desktop` preset (1280×800), reload, screenshot the same Lesson Plan tab.

Expected: card still has shadow + rounded corners, padding looks identical to before this change (visually compare against git stash or prior screenshot if available).

- [ ] **Step 6: Commit**

```bash
git add src/components/LessonWorkspace.tsx
git commit -m "fix(mobile): shrink content wrapper padding, defer paper-card chrome to md:"
```

---

## Task 2: Mobile-first typography in `.markdown-body`

**Files:**
- Modify: `src/app/globals.css:44-69`

- [ ] **Step 1: Replace the `.markdown-body` base rules with mobile-first sizing plus a `md:` restore block**

Current (`src/app/globals.css:44-69`):
```css
.markdown-body {
  color: #334155; /* Slate 700 */
  line-height: 1.8;
  font-size: 1.05rem;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
  color: #0f172a; /* Slate 900 */
  font-weight: 800;
  margin-top: 2em;
  margin-bottom: 1em;
  line-height: 1.3;
  letter-spacing: -0.025em;
}
.markdown-body h1 {
  font-size: 2.25rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.5rem;
}
.markdown-body h2 {
  font-size: 1.875rem;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 0.3rem;
}
.markdown-body h3 {
  font-size: 1.5rem;
}
```

New:
```css
.markdown-body {
  color: #334155; /* Slate 700 */
  line-height: 1.7;
  font-size: 1rem;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
  color: #0f172a; /* Slate 900 */
  font-weight: 800;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  line-height: 1.25;
  letter-spacing: -0.025em;
}
.markdown-body h1 {
  font-size: 1.75rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.4rem;
}
.markdown-body h2 {
  font-size: 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 0.25rem;
}
.markdown-body h3 {
  font-size: 1.25rem;
}

@media (min-width: 768px) {
  .markdown-body {
    line-height: 1.8;
    font-size: 1.05rem;
  }
  .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
    margin-top: 2em;
    margin-bottom: 1em;
    line-height: 1.3;
  }
  .markdown-body h1 {
    font-size: 2.25rem;
    padding-bottom: 0.5rem;
  }
  .markdown-body h2 {
    font-size: 1.875rem;
    padding-bottom: 0.3rem;
  }
  .markdown-body h3 {
    font-size: 1.5rem;
  }
}
```

Note: `h4`, `p`, `ul`/`ol`/`li`, `strong`, `blockquote`, `code`, `pre` rules below this block are untouched — they're already `em`-relative and scale automatically with the new base `font-size`.

- [ ] **Step 2: Verify in browser at mobile viewport**

With the Browser pane at the `mobile` preset (375×812), reload the same Lesson Plan tab used in Task 1.

Expected: h1 heading noticeably smaller than before (was 36px, now 28px), body text at 16px, no heading wraps awkwardly across more than 2-3 lines for typical section titles.

Use `javascript_tool` to confirm computed size, e.g.:
```js
const h1 = document.querySelector('.markdown-body h1');
getComputedStyle(h1).fontSize
```
Expected: `"28px"` on mobile viewport.

- [ ] **Step 3: Verify desktop is unchanged**

Resize to the `desktop` preset (1280×800), reload, re-run the same `getComputedStyle` check.

Expected: `"36px"` for h1 (matches pre-change value).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(mobile): scale down markdown-body typography below md:"
```

---

## Task 3: Tighten table cell sizing on mobile

**Files:**
- Modify: `src/components/LessonWorkspace.tsx:1010-1027` (custom `table`/`thead`/`th`/`td` renderers inside `RenderMarkdown`)

- [ ] **Step 1: Update the custom table renderers**

Current:
```tsx
table: ({ node: _node, ...props }) => (
  <div className="overflow-x-auto my-6">
    <table
      className="min-w-full text-sm divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden"
      {...props}
    />
  </div>
),
thead: ({ node: _node, ...props }) => <thead className="bg-slate-50" {...props} />,
th: ({ node: _node, ...props }) => (
  <th
    className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider"
    {...props}
  />
),
td: ({ node: _node, ...props }) => (
  <td className="px-4 py-3 border-t border-slate-200" {...props} />
),
```
New:
```tsx
table: ({ node: _node, ...props }) => (
  <div className="overflow-x-auto my-6">
    <table
      className="min-w-full text-xs md:text-sm divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden"
      {...props}
    />
  </div>
),
thead: ({ node: _node, ...props }) => <thead className="bg-slate-50" {...props} />,
th: ({ node: _node, ...props }) => (
  <th
    className="px-2 py-2 md:px-4 md:py-3 text-left font-bold text-slate-700 uppercase tracking-wider"
    {...props}
  />
),
td: ({ node: _node, ...props }) => (
  <td className="px-2 py-2 md:px-4 md:py-3 border-t border-slate-200" {...props} />
),
```

- [ ] **Step 2: Verify in browser at mobile viewport**

Find or generate content that includes a markdown table (e.g. a rubric or marks grid in a test/assignment resource). With the Browser pane at the `mobile` preset, navigate to that content and screenshot.

Expected: table cells visibly more compact than before, more columns fit before horizontal scroll is needed; table still scrolls horizontally if it doesn't fully fit (do not expect all tables to fit without scrolling — only that more fits than before).

- [ ] **Step 3: Verify desktop is unchanged**

Resize to `desktop` preset, reload the same content, screenshot.

Expected: table cell padding/font-size identical to before this change.

- [ ] **Step 4: Commit**

```bash
git add src/components/LessonWorkspace.tsx
git commit -m "fix(mobile): tighten table cell padding and font-size below md:"
```

---

## Task 4: Full regression pass across doc types

**Files:** None (verification-only task, no code changes)

- [ ] **Step 1: Check each doc type renders correctly on mobile**

With the Browser pane at the `mobile` preset (375×812) and the dev server running, visit a class with content generated for each of: Lesson Plan, Slides, Activity/Game, Resources, and at least one Worksheet/Test (via the `educational` section). For each, take a screenshot and confirm:
- No horizontal page-level scrollbar (only tables should scroll horizontally, via their own `overflow-x-auto`)
- Heading text wraps normally, no visible font overflow past the viewport edge
- Card has no shadow/rounded corners on mobile (edge-to-edge)

- [ ] **Step 2: Check print output is unaffected**

Use `javascript_tool` to check computed styles under the print media query are unaffected, or use the browser's print preview if available:
```js
window.matchMedia('print').matches
```
Confirm the print-specific classes (`print:p-0`, `print:shadow-none`, `print:rounded-none`) are still present in the DOM (inspect `className` on the relevant wrapper divs) — these were not touched by Tasks 1-3, so this is a sanity check, not expected to surface new issues.

- [ ] **Step 3: Check tablet/landscape breakpoint transition**

Resize the Browser pane from 375×812 up through 768px width (the `md:` breakpoint) and observe the transition live, or take screenshots just below (767px) and at (768px) width.

Expected: card shadow/rounding, larger padding, and larger typography all switch together at exactly 768px, no visual flash or mismatch.

- [ ] **Step 4: Final commit if any fixes were needed during regression pass**

If Steps 1-3 required any additional fixes, commit them individually with descriptive messages following the same `fix(mobile): ...` pattern as Tasks 1-3. If no fixes were needed, this task requires no commit — it was verification only.
