# Mobile-Responsive Lesson Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `LessonWorkspace.tsx` usable on mobile as a read/review + download experience — no generation, no chat, no editing. Desktop (`md:`+) behavior stays pixel-identical.

**Architecture:** Hide the left content-nav `<aside>` and right AI-chat `<aside>` below `md:` via `hidden md:flex`/`hidden md:inline-flex`, add a compact mobile-only dropdown section-switcher in their place, and give the shared `EmptyState` component a CSS-only mobile-nudge / desktop-generate-button split. Single file change, no new components, no JS viewport detection.

**Tech Stack:** Next.js 16.2 App Router, React 19, Tailwind CSS v4, TypeScript, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-11-mobile-lesson-workspace-design.md`

---

### Task 1: Hide left sidebar below `md:` + add mobile section-switcher dropdown

**Files:**
- Modify: `src/components/LessonWorkspace.tsx`

- [ ] **Step 1: Add mobile dropdown state**

Current (`src/components/LessonWorkspace.tsx:45`, alongside `isSidebarCollapsed`):
```tsx
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
```

New:
```tsx
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSectionMenuOpen, setIsMobileSectionMenuOpen] = useState(false);
```

- [ ] **Step 2: Hide the left sidebar below `md:`**

Current (`src/components/LessonWorkspace.tsx:419`):
```tsx
      <aside className={`no-print bg-white border-r border-slate-200 flex flex-col z-20 transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-72'}`}>
```

New:
```tsx
      <aside className={`no-print hidden md:flex bg-white border-r border-slate-200 flex-col z-20 transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-72'}`}>
```

This single change removes the entire sidebar — including the "Add Context PDF" upload, the Teacher Guide nav, and the Resources "+" button — from mobile. No other edits are needed inside the `<aside>` itself.

- [ ] **Step 3: Add the `MOBILE_SECTIONS` lookup**

Read the actual current file to find where `type MainTab = ...` is declared (near the top of the file, alongside `type ResourceType`), and add this constant immediately after it:

```tsx
const MOBILE_SECTIONS: { key: MainTab; label: string; icon: LucideIcon }[] = [
  { key: 'plan', label: 'Lesson Plan', icon: BookOpen },
  { key: 'slides', label: 'Slides', icon: MonitorPlay },
  { key: 'visuals', label: 'Visual Aids', icon: ImageIcon },
  { key: 'game', label: 'Activity', icon: Gamepad2 },
  { key: 'resources', label: 'Links', icon: Library },
];
```

`BookOpen`, `MonitorPlay`, `ImageIcon` (aliased from `Image`), `Gamepad2`, and `Library` are all already imported in this file (used by the existing `NavButton` call sites) — no new icon imports needed. `LucideIcon` is also already imported.

- [ ] **Step 4: Add the mobile dropdown bar JSX**

Locate the closing `</aside>` tag for the left sidebar (from Step 2) — read the live file to find its exact line, since line numbers will have shifted from Steps 1-3. Immediately after that `</aside>` and before whatever the next sibling element is (the main content area's opening `<div>`), insert:

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

`ChevronDown` is already imported (used by the Download dropdown elsewhere in this file).

**Important — check `activeSection`'s type:** `activeSection` is typed as `MainTab | 'educational'` in this component (there's a 6th state, `'educational'`, used when viewing a specific worksheet/assignment/test resource, which isn't one of the 5 `MainTab` values in `MOBILE_SECTIONS`). The `MOBILE_SECTIONS.find(s => s.key === activeSection)` comparison and the `onClick={() => setActiveSection(key)}` call both need to type-check correctly against this — `key` is typed as `MainTab` which is a valid subtype of `MainTab | 'educational'` for the setter, and the `.find()` comparison works fine since `===` between a `MainTab | 'educational'` value and a `MainTab` value type-checks in TypeScript. If `npx tsc --noEmit` reports an issue here, it's most likely a red herring from a different unrelated line — read the actual error carefully before assuming this comparison is the cause.

- [ ] **Step 5: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/LessonWorkspace.tsx
git commit -m "feat(mobile): hide left content-nav sidebar below md:, add mobile section dropdown"
```

---

### Task 2: Hide chat toggle and Settings gear below `md:`

**Files:**
- Modify: `src/components/LessonWorkspace.tsx`

- [ ] **Step 1: Hide the Settings (Template) gear button**

Current (`src/components/LessonWorkspace.tsx:496`):
```tsx
            <button onClick={() => setIsTemplateModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg flex-shrink-0"><Settings className="w-5 h-5" /></button>
```

New:
```tsx
            <button onClick={() => setIsTemplateModalOpen(true)} className="hidden md:inline-flex p-2 text-slate-500 hover:bg-slate-100 rounded-lg flex-shrink-0"><Settings className="w-5 h-5" /></button>
```

- [ ] **Step 2: Hide the AI-chat toggle button**

Current (`src/components/LessonWorkspace.tsx:497`):
```tsx
            <button onClick={() => setIsChatOpen(!isChatOpen)} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isChatOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}><MessageSquare className="w-5 h-5" /></button>
```

New:
```tsx
            <button onClick={() => setIsChatOpen(!isChatOpen)} className={`hidden md:inline-flex p-2 rounded-lg transition-colors flex-shrink-0 ${isChatOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}><MessageSquare className="w-5 h-5" /></button>
```

Since `isChatOpen` has no other code path that sets it to `true`, hiding this button is sufficient to guarantee the `w-96` chat `<aside>` (rendered conditionally on `isChatOpen`, elsewhere in this file) never opens on mobile — no need to also touch that `<aside>`'s own render condition.

- [ ] **Step 3: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/LessonWorkspace.tsx
git commit -m "feat(mobile): hide chat toggle and template settings gear below md:"
```

---

### Task 3: `EmptyState` — mobile nudge instead of Generate button

**Files:**
- Modify: `src/components/LessonWorkspace.tsx`

- [ ] **Step 1: Update the component**

Current (`src/components/LessonWorkspace.tsx:857-862`):
```tsx
const EmptyState = ({ icon: Icon, label, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-32 text-center opacity-60 hover:opacity-100 transition-opacity">
    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Icon className="w-8 h-8 text-slate-300" /></div>
    <h3 className="text-xl font-bold text-slate-700 mb-2">No {label}</h3>
    <button onClick={action} className="flex items-center gap-2 text-blue-600 font-bold hover:underline"><Sparkles className="w-4 h-4" /> Generate Now</button>
  </div>
);
```

New:
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

`Sparkles` is already imported in this file (used elsewhere for AI-related affordances). No call sites need changes — every `<EmptyState .../>` usage across the file (Lesson Plan, Slides, Activity, Resources, and any others) routes through this one component definition.

- [ ] **Step 2: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/LessonWorkspace.tsx
git commit -m "feat(mobile): replace EmptyState Generate button with desktop nudge on mobile"
```

---

### Task 4: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build and lint**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no type errors.

Run: `npm run lint`
Expected: 0 errors (pre-existing warnings acceptable, no new ones).

- [ ] **Step 2: Live browser verification — prefer JS-based checks over screenshots**

Screenshots were unreliable during Phase 1's verification session (persistent tool timeouts) — if the same issue recurs, use `javascript_tool` to check `getComputedStyle`, `offsetWidth`/`offsetHeight`, and `className` directly rather than relying on visual screenshots, exactly as was done to verify Phase 1. Cross-check `getBoundingClientRect()` results against `offsetLeft`/`offsetWidth` if they ever disagree — Phase 1 found `getBoundingClientRect()` occasionally returned stale values while `offsetLeft` was reliable.

**Also watch for stale dev-server CSS after edits** — Phase 1 found that Turbopack's Fast Refresh sometimes serves stale computed styles after a class-name edit; if a check doesn't match the code, force a hard reload (`navigate` with `force: true`) before concluding there's a real bug.

Resize the Browser pane to mobile (375×812), sign in, open a class with an existing blueprint, enter the Lesson Workspace on a unit that has generated content (lesson plan and/or slides), and verify:

1. No left sidebar visible; instead, a bar showing the current section name (e.g. "Lesson Plan") with a chevron sits at the top of the content area.
2. Tapping that bar opens a dropdown listing Lesson Plan / Slides / Visual Aids / Activity / Links; tapping one switches `activeSection` and closes the dropdown.
3. Tapping outside the open dropdown (on the backdrop) closes it without changing section.
4. The Settings gear and chat icons are not present in the header at all (not just disabled — actually hidden).
5. The Download button is present, functional, and unchanged from desktop behavior — download at least one format (PDF or DOCX) to confirm nothing broke.
6. Navigate to a section that has never been generated for this unit (e.g. Activity, if empty) — confirm it shows the "Content generation works best on desktop..." message instead of a Generate button, and that there's no dead/non-functional button visible.
7. Resize back to desktop width (1280×800), hard-reload if needed to clear stale CSS, and confirm: left sidebar reappears exactly as before this plan, chat toggle and Settings gear are visible again, the mobile dropdown bar is gone, and any previously-empty section again shows its "Generate Now" button (not the mobile nudge text).

- [ ] **Step 3: Report results**

No commit for this task — it's verification. If any step fails, return to the relevant task above and fix before proceeding to code review.
