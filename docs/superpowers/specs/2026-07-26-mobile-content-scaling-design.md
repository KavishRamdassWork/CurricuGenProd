# Mobile-Responsive Generated Content Display — Design Spec
**Date:** 2026-07-26
**Project:** CurricuGen Pro
**Sub-project:** Mobile optimization, Phase 3 (generated content display)
**Status:** Approved

---

## 1. Problem Statement

`LessonWorkspace.tsx` renders every generated document (lesson plan, slides, activity/game, resources, worksheets/assignments/tests, and their memos) through the same nested wrapper structure and a shared `.markdown-body` CSS class (`src/app/globals.css`). Neither the wrapper padding nor the typography has any mobile-specific tuning:

- Outer scroll wrapper: `p-8 md:p-12` — 32px padding even on the smallest screens.
- "Paper" card (`bg-white shadow-xl rounded-xl`): no max-width, so it just shrinks to fill the padded parent.
- Inner content wrapper: `p-12 lg:p-16` — a flat 48px of padding with **no mobile reduction at all**.
- `.markdown-body` headings are fixed-size (h1 2.25rem/36px, h2 1.875rem/30px, h3 1.5rem/24px, body 1.05rem) with no responsive scaling.

On a ~375px-wide phone this leaves roughly 215px of usable width while text renders at desktop size — the "squashed and narrow" content the user is seeing. This is a display-only problem (Phase 2 already restricted mobile to reading/downloading, not generating), so the fix is CSS/layout only — no new interactive behavior.

## 2. Scope

**In scope:**
- Remove the "paper card" look (shadow, rounded corners, card padding) below `md:`; content goes edge-to-edge on mobile, restored to the card look at `md:`+.
- Reduce outer/inner wrapper padding to a small mobile value, scaling back up to the current desktop values at `md:`/`lg:`.
- Add a mobile tier to `.markdown-body` typography (headings and body text sized down), restored to current desktop sizes at `md:`+.
- Reduce table cell padding/font-size on mobile in the custom `table`/`th`/`td` renderers, keeping the existing `overflow-x-auto` scroll behavior unchanged.
- Applies uniformly to all doc types, since they all render through the same `RenderMarkdown` component and `.markdown-body` wrapper.

**Out of scope:**
- Print styles (`print:p-0`, `print:shadow-none`, `print:rounded-none`) — untouched, printing is unaffected.
- Any change to desktop (`md:`+) appearance — must remain pixel-identical to today.
- Restructuring tables into a stacked/card mobile layout — horizontal scroll stays, just tuned to fit more before scrolling.
- Any change to `LessonWorkspace.tsx`'s Phase 1/2 mobile nav (sidebar, chat, section dropdown, EmptyState nudge) — already handled.
- Slide-specific layout — slides render through the same markdown pipeline as everything else; no divergent structure was found.

---

## 3. Architecture Overview

```
src/components/LessonWorkspace.tsx  ← wrapper div classNames get mobile-first padding
                                        (lines 622, 623, 630); table/th/td renderer
                                        classNames get mobile-first sizing (lines
                                        1010-1027)
src/app/globals.css                 ← .markdown-body gets a mobile-first base tier
                                        for h1-h4/p font sizes, restored at md:
```

**CSS/JSX-only change.** No new components, no new state, no JS viewport detection — consistent with the pure-Tailwind-breakpoint approach used in Phases 1 and 2.

---

## 4. Wrapper Padding & Card Styling

### 4.1 Outer scroll wrapper

Current (`src/components/LessonWorkspace.tsx:622`):
```tsx
<div className="flex-1 overflow-y-auto p-8 md:p-12 relative bg-slate-100">
```
New — small mobile padding, unchanged at `md:`+:
```tsx
<div className="flex-1 overflow-y-auto p-2 md:p-12 relative bg-slate-100">
```

### 4.2 "Paper" card

Current (`src/components/LessonWorkspace.tsx:623`):
```tsx
<div className="mx-auto min-h-[1000px] bg-white shadow-xl rounded-xl overflow-hidden print:shadow-none print:rounded-none">
```
New — card look (shadow, rounded corners) starts at `md:`; background stays white (still needed as the content backdrop against `bg-slate-100`) at all sizes:
```tsx
<div className="mx-auto min-h-[1000px] bg-white md:shadow-xl md:rounded-xl overflow-hidden print:shadow-none print:rounded-none">
```

### 4.3 Inner content padding

Current (`src/components/LessonWorkspace.tsx:630`):
```tsx
<div className={`p-12 lg:p-16 print:p-0 ${isRefining ? 'is-refining' : ''}`}>
```
New — mobile drops to `p-5`, `md:`/`lg:` unchanged:
```tsx
<div className={`p-5 md:p-12 lg:p-16 print:p-0 ${isRefining ? 'is-refining' : ''}`}>
```

Combined effect: on a 375px phone, total left+right padding drops from 160px (outer `p-8`=32px + inner `p-12`=48px, ×2 sides) to 56px (outer `p-2`=8px + inner `p-5`=20px, ×2 sides), leaving ~319px of usable width instead of ~215px, with the card's shadow/rounding deferred to `md:`+ so the content reads edge-to-edge as intended.

---

## 5. Responsive Typography in `.markdown-body`

Current (`src/app/globals.css:44-69`):
```css
.markdown-body {
  color: #334155;
  line-height: 1.8;
  font-size: 1.05rem;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
  color: #0f172a;
  font-weight: 800;
  margin-top: 2em;
  margin-bottom: 1em;
  line-height: 1.3;
  letter-spacing: -0.025em;
}
.markdown-body h1 { font-size: 2.25rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
.markdown-body h2 { font-size: 1.875rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.3rem; }
.markdown-body h3 { font-size: 1.5rem; }
```

New — mobile-first base sizes, restored to the current values at `md:` (768px) and up:
```css
.markdown-body {
  color: #334155;
  line-height: 1.7;
  font-size: 1rem;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
  color: #0f172a;
  font-weight: 800;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  line-height: 1.25;
  letter-spacing: -0.025em;
}
.markdown-body h1 { font-size: 1.75rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.4rem; }
.markdown-body h2 { font-size: 1.5rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.25rem; }
.markdown-body h3 { font-size: 1.25rem; }

@media (min-width: 768px) {
  .markdown-body { line-height: 1.8; font-size: 1.05rem; }
  .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
    margin-top: 2em;
    margin-bottom: 1em;
    line-height: 1.3;
  }
  .markdown-body h1 { font-size: 2.25rem; padding-bottom: 0.5rem; }
  .markdown-body h2 { font-size: 1.875rem; padding-bottom: 0.3rem; }
  .markdown-body h3 { font-size: 1.5rem; }
}
```
`h4`, `p`, `ul`/`ol`/`li`, `strong`, `blockquote`, `code`, `pre` keep their current `em`-relative sizing — since they're defined in `em`/no absolute `rem`, they already scale down proportionally with the reduced base `font-size`, so no separate mobile override is needed for those rules.

---

## 6. Table Sizing on Mobile

Current custom renderers (`src/components/LessonWorkspace.tsx:1010-1027`):
```tsx
table: ({ node: _node, ...props }) => (
  <div className="overflow-x-auto my-6">
    <table className="min-w-full text-sm divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden" {...props} />
  </div>
),
thead: ({ node: _node, ...props }) => <thead className="bg-slate-50" {...props} />,
th: ({ node: _node, ...props }) => (
  <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider" {...props} />
),
td: ({ node: _node, ...props }) => (
  <td className="px-4 py-3 border-t border-slate-200" {...props} />
),
```
New — smaller cell padding and text on mobile, restored at `md:`; `overflow-x-auto` scroll behavior on the wrapping `div` is unchanged:
```tsx
table: ({ node: _node, ...props }) => (
  <div className="overflow-x-auto my-6">
    <table className="min-w-full text-xs md:text-sm divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden" {...props} />
  </div>
),
thead: ({ node: _node, ...props }) => <thead className="bg-slate-50" {...props} />,
th: ({ node: _node, ...props }) => (
  <th className="px-2 py-2 md:px-4 md:py-3 text-left font-bold text-slate-700 uppercase tracking-wider" {...props} />
),
td: ({ node: _node, ...props }) => (
  <td className="px-2 py-2 md:px-4 md:py-3 border-t border-slate-200" {...props} />
),
```
These Tailwind utility classes on the custom renderers take precedence over the `.markdown-body table/th/td` CSS rules in `globals.css` (both are class-based; Tailwind's utility layer is injected after component styles), so this is the correct place to make the change — the `globals.css` `.markdown-body table` rules do not need editing.

---

## 7. Error Handling / Edge Cases

| Scenario | Behaviour |
|---|---|
| Tablet rotated from portrait (mobile-width) to landscape crossing `md:` (768px) | Card shadow/rounding, larger padding, and larger type all reappear via the same CSS breakpoint simultaneously — no JS state to reconcile, no flash of mismatched styling. |
| Printing from mobile | `print:p-0`, `print:shadow-none`, `print:rounded-none` are untouched and take precedence in the print media query exactly as today — mobile-tier padding/shadow changes don't affect print output. |
| Very long unbroken words/URLs in generated content on a narrow phone | Not addressed by this spec — existing `overflow-x-auto` on tables/code blocks (`pre`) already contains the two element types most likely to overflow; prose overflow was not observed as an existing problem and is out of scope. |
| Table with many columns on mobile | Still requires horizontal scroll past a certain column count — this spec reduces how many columns fit before scrolling starts, it does not eliminate scrolling for genuinely wide tables (matches the earlier design decision to keep scroll, not restructure). |

---

## 8. Files Changed

| File | Change |
|---|---|
| `src/components/LessonWorkspace.tsx` | Outer scroll wrapper padding (`p-8 md:p-12` → `p-2 md:p-12`, line 622); paper-card shadow/rounding deferred to `md:` (line 623); inner content padding (`p-12 lg:p-16` → `p-5 md:p-12 lg:p-16`, line 630); table/th/td custom renderer classNames get mobile-first sizing (lines 1010-1027) |
| `src/app/globals.css` | `.markdown-body` base typography (font-size, line-height, heading sizes/margins) becomes mobile-first, restored to current desktop values inside a `@media (min-width: 768px)` block (lines 44-69) |

---

## 9. Constraints & Decisions

- **Edge-to-edge on mobile, card look preserved at `md:`+** — per user decision, maximizes usable width for reading on a phone rather than preserving the printed-document metaphor at the cost of space.
- **Moderate typography scaling, not left untouched** — per user decision; headings scale down (h1 36px→28px, h2 30px→24px, h3 24px→20px) and body drops slightly (1.05rem→1rem) so hierarchy stays legible without needing extra width.
- **Horizontal scroll kept for tables, just tuned tighter** — per user decision; no restructuring into a stacked/card table layout, just smaller padding/font so more columns fit before scroll is needed.
- **Uniform treatment across all doc types** — per user decision; since lesson plans, slides, games, resources, and worksheets/tests/memos all route through the same `RenderMarkdown`/`.markdown-body` wrapper (confirmed at `LessonWorkspace.tsx:632, 633, 750, 751, 783`), one shared CSS/JSX change covers all of them — no per-doc-type branching.
- **`em`-relative markdown-body rules (`p`, `ul`/`ol`/`li`, `strong`, `blockquote`, `code`, `pre`) need no explicit mobile override** — they already scale with the mobile-first base `font-size` change since they were authored in relative units, not absolute `rem`/`px`.
- **Table Tailwind classes, not `.markdown-body` CSS, are the effective styling for table cells** — the custom `table`/`th`/`td` renderers apply their own Tailwind utility classes on top of the elements, which take precedence over the `.markdown-body table` CSS block; mobile tuning goes in the renderer classNames, and the CSS block is left as a fallback/no-op change.
