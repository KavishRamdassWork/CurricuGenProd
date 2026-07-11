# Mobile-Responsive Lesson Workspace — Design Spec
**Date:** 2026-07-11
**Project:** CurricuGen Pro
**Sub-project:** Mobile optimization, Phase 2 of 2 (LessonWorkspace)
**Status:** Approved

---

## 1. Problem Statement

`LessonWorkspace.tsx` — the lesson-plan/slides/worksheets editor — is a 3-panel desktop layout: a permanent `w-72` left content-nav sidebar, the main document pane, and an optional `w-96` right AI-chat drawer. Neither side panel has any responsive behavior; on a phone the left sidebar alone (288px) consumes over 75% of a 375px screen, and the chat panel (384px) is wider than the viewport itself.

Per the product decision made alongside Phase 1: teachers do content *generation and refinement* at a desk, not on a phone. Mobile's job here is **reading already-generated content and downloading it** — not a scaled-down editing/generation experience.

## 2. Scope

**In scope:**
- Hide the left content-nav sidebar below `md:`, replaced by a compact dropdown section-switcher
- Hide the right AI-chat panel and its toggle button below `md:` entirely — chat does not exist on mobile
- Hide generation-input controls (Add Context PDF upload, Template Settings gear, "+" new-resource button) below `md:` — these live inside the hidden sidebar/header and require no separate work beyond what hiding the sidebar already does, except the header-level Settings/Chat buttons
- Replace the "Generate Now" empty-state action with an inline nudge message on mobile, for any section with no content yet
- Download functionality (PDF/Word/PowerPoint) remains fully available and unchanged on mobile — this is the point of the mobile experience

**Out of scope:**
- Any mobile-specific chat/refine UI (explicitly not building a scaled-down version)
- Editing blueprint/lesson content inline on mobile
- Generating new content (lesson plan, slides, worksheets, images) from a phone
- Changes to desktop (`md:`+) behavior — must be pixel-identical to today

---

## 3. Architecture Overview

```
src/components/LessonWorkspace.tsx  ← left sidebar hidden below md:, mobile dropdown
                                        section-switcher added; chat toggle + chat
                                        aside hidden below md:; Settings gear hidden
                                        below md:; EmptyState gets a mobile nudge variant
```

**Single file change.** No new components extracted — `EmptyState` (already a local component in this file) gains a CSS-only mobile/desktop split inside itself, avoiding any JS viewport detection (matching Phase 1's pure-Tailwind-breakpoint approach, no `matchMedia`/resize listeners).

---

## 4. Left Sidebar → Mobile Dropdown

### 4.1 Hide the sidebar below `md:`

Current (`src/components/LessonWorkspace.tsx:419`):
```tsx
<aside className={`no-print bg-white border-r border-slate-200 flex flex-col z-20 transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-72'}`}>
```

New — add `hidden md:flex` so the entire sidebar (including "Add Context PDF", the Teacher Guide nav, and the Resources "+" button) disappears below `md:` without touching any of its internal content:
```tsx
<aside className={`no-print hidden md:flex bg-white border-r border-slate-200 flex-col z-20 transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-72'}`}>
```

This is the single biggest simplification in this spec: since Add Context PDF, the section nav, and the Resources "+" button all live inside this one `<aside>`, hiding the aside removes all three from mobile in one change — no per-control gating needed.

### 4.2 New mobile section-switcher dropdown

New state, alongside the existing sidebar/UI state:
```tsx
const [isMobileSectionMenuOpen, setIsMobileSectionMenuOpen] = useState(false);
```

A small lookup for the switcher's label/icon, matching what each `NavButton` already displays:
```tsx
const MOBILE_SECTIONS: { key: MainTab; label: string; icon: LucideIcon }[] = [
  { key: 'plan', label: 'Lesson Plan', icon: BookOpen },
  { key: 'slides', label: 'Slides', icon: MonitorPlay },
  { key: 'visuals', label: 'Visual Aids', icon: ImageIcon },
  { key: 'game', label: 'Activity', icon: Gamepad2 },
  { key: 'resources', label: 'Links', icon: Library },
];
```
(Resource items — worksheets/assignments/tests — aren't included in this switcher; they stay reachable exactly as they are today once a teacher is on desktop. On mobile, a teacher opens a specific resource by a link/download from elsewhere, or from desktop; the dropdown covers the five fixed `MainTab` sections.)

Rendered as a `md:hidden` bar directly above the main content pane (inserted right after the sidebar's closing `</aside>`, before the main content `<div>`):
```tsx
<div className="md:hidden relative border-b border-slate-200 bg-white">
  <button
    onClick={() => setIsMobileSectionMenuOpen(prev => !prev)}
    className="w-full min-h-12 flex items-center justify-between px-4 font-bold text-slate-800"
  >
    <span className="flex items-center gap-2">
      {(() => {
        const current = MOBILE_SECTIONS.find(s => s.key === activeSection);
        const Icon = current?.icon ?? BookOpen;
        return <><Icon className="w-4 h-4" /> {current?.label ?? 'Lesson Plan'}</>;
      })()}
    </span>
    <ChevronDown className={`w-4 h-4 transition-transform ${isMobileSectionMenuOpen ? 'rotate-180' : ''}`} />
  </button>
  {isMobileSectionMenuOpen && (
    <>
    <div className="fixed inset-0 z-20" onClick={() => setIsMobileSectionMenuOpen(false)} />
    <div className="absolute left-0 right-0 top-full bg-white border-b border-slate-200 shadow-lg z-30">
      {MOBILE_SECTIONS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => { setActiveSection(key); setIsMobileSectionMenuOpen(false); }}
          className={`w-full min-h-12 flex items-center gap-2 px-4 text-sm font-medium ${activeSection === key ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}
        >
          <Icon className="w-4 h-4" /> {label}
        </button>
      ))}
    </div>
    </>
  )}
</div>
```
`ChevronDown` is already imported in this file (used by the Download dropdown) — no new import needed for it. `LucideIcon` needs importing from `lucide-react` for the `MOBILE_SECTIONS` type annotation (same pattern already used in `Dashboard.tsx`).

---

## 5. Right AI-Chat Panel — Hidden Below `md:`

### 5.1 Hide the chat toggle button

Current (`src/components/LessonWorkspace.tsx:497`):
```tsx
<button onClick={() => setIsChatOpen(!isChatOpen)} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isChatOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}><MessageSquare className="w-5 h-5" /></button>
```

New — add `hidden md:inline-flex`:
```tsx
<button onClick={() => setIsChatOpen(!isChatOpen)} className={`hidden md:inline-flex p-2 rounded-lg transition-colors flex-shrink-0 ${isChatOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}><MessageSquare className="w-5 h-5" /></button>
```

Since `isChatOpen` can only become `true` via this button (no other code path sets it), hiding the toggle is sufficient to guarantee the chat panel never opens on mobile — no need to also gate the panel's own render condition.

### 5.2 Hide the Settings (Template) gear

Current (`src/components/LessonWorkspace.tsx:496`):
```tsx
<button onClick={() => setIsTemplateModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg flex-shrink-0"><Settings className="w-5 h-5" /></button>
```

New:
```tsx
<button onClick={() => setIsTemplateModalOpen(true)} className="hidden md:inline-flex p-2 text-slate-500 hover:bg-slate-100 rounded-lg flex-shrink-0"><Settings className="w-5 h-5" /></button>
```
Same reasoning: this is a generation-input configuration control (school logo/font used when generating documents), not needed for read/download-only mobile use. `isTemplateModalOpen` has no other trigger, so hiding the button fully prevents the modal from opening on mobile.

---

## 6. Empty-State Mobile Nudge

### 6.1 `EmptyState` component — CSS-only split

Current `EmptyState` (near the bottom of the file, alongside `NavButton`):
```tsx
const EmptyState = ({ icon: Icon, label, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-32 text-center opacity-60 hover:opacity-100 transition-opacity">
    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Icon className="w-8 h-8 text-slate-300" /></div>
    <h3 className="text-xl font-bold text-slate-700 mb-2">No {label}</h3>
    <button onClick={action} className="flex items-center gap-2 text-blue-600 font-bold hover:underline"><Sparkles className="w-4 h-4" /> Generate Now</button>
  </div>
);
```

New — the "Generate Now" button becomes desktop-only (`hidden md:flex`), and a mobile-only nudge message renders alongside it (`md:hidden`), both present in the DOM at all times with CSS deciding which shows:
```tsx
const EmptyState = ({ icon: Icon, label, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-32 text-center opacity-60 hover:opacity-100 transition-opacity">
    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Icon className="w-8 h-8 text-slate-300" /></div>
    <h3 className="text-xl font-bold text-slate-700 mb-2">No {label}</h3>
    <button onClick={action} className="hidden md:flex items-center gap-2 text-blue-600 font-bold hover:underline"><Sparkles className="w-4 h-4" /> Generate Now</button>
    <p className="md:hidden text-sm text-slate-500 max-w-xs px-6">Content generation works best on desktop — open this class on a computer to create new content.</p>
  </div>
);
```

This is the only component-level change needed for the nudge — every call site (`activeSection === 'plan' && (... : <EmptyState .../>)`, and the same pattern for slides/game/resources/visuals) already routes through this one component, so no call sites need editing.

---

## 7. Error Handling / Edge Cases

| Scenario | Behaviour |
|---|---|
| Teacher rotates a tablet from portrait (mobile-width) to landscape (crosses `md:` at 768px) | Sidebar and chat toggle reappear automatically (pure CSS breakpoint, no JS state to reconcile) — mobile dropdown (`md:hidden`) disappears at the same instant. No stale open/closed state carries over since `isMobileSectionMenuOpen` has no visual effect once `md:hidden` hides its container. |
| Teacher has content already generated, then views on mobile | Fully readable, fully downloadable — `EmptyState`'s mobile branch only ever shows for genuinely empty sections, exactly matching desktop's existing `hasContent` logic (no new logic introduced here, existing per-section content checks are untouched). |
| Mobile section dropdown open, teacher taps outside it | Closes on outside tap via the same `<div className="fixed inset-0 z-20" onClick={() => setIsMobileSectionMenuOpen(false)} />` click-catcher pattern already used by the Download dropdown elsewhere in this file, for consistency. |

---

## 8. Files Changed

| File | Change |
|---|---|
| `src/components/LessonWorkspace.tsx` | Left sidebar `hidden md:flex`; new mobile section-dropdown bar + state; chat toggle button `hidden md:inline-flex`; Settings gear button `hidden md:inline-flex`; `EmptyState` component gains CSS-split mobile nudge / desktop generate button |

---

## 9. Constraints & Decisions

- **Hide the whole sidebar rather than gate each control individually** — Add Context PDF, the Teacher Guide nav, and the Resources "+" button all live inside one `<aside>`; a single `hidden md:flex` on that wrapper removes all three from mobile at once, which is both simpler and less error-prone than three separate `md:` gates that could drift out of sync.
- **Chat and Settings modals need no render-condition changes** — both are only ever opened via a button click; hiding the button is sufficient since there's no other trigger path, avoiding redundant `isMobile &&` guards deep in JSX.
- **`EmptyState` gets both variants in the DOM, toggled by CSS** — consistent with every other mobile/desktop split in Phase 1 (pure Tailwind breakpoints, no JS `matchMedia` or resize listeners) — avoids a hydration-mismatch class of bugs that a JS-detected "isMobile" boolean would risk on the server-rendered first paint.
- **Resource items (worksheets/assignments/tests) excluded from the mobile section-switcher** — the switcher covers the five fixed `MainTab` values; resources are a dynamic, potentially-long list better suited to desktop's existing sidebar list than a dropdown, and reading a specific worksheet on mobile is a smaller, secondary use case than reading the lesson plan/slides.
