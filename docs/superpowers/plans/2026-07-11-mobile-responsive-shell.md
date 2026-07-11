# Mobile-Responsive Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app's navigation shell (Dashboard sidebar, ClassManager, CurriculumDashboard) fully usable on mobile — hamburger + slide-out drawer nav below `md:` (768px), ≥48×48px touch targets on mobile, and an explicit viewport configuration. Desktop behavior is unchanged.

**Architecture:** `Dashboard.tsx`'s permanent sidebar gets a `fixed`/`translate-x` treatment below `md:` (off-canvas drawer, toggled by a new mobile-only top bar + hamburger), reverting to today's `static` permanent sidebar at `md:`+. Touch targets on `NavItem`, `ClassManager`'s card action icons, and `CurriculumDashboard`'s header buttons grow via `min-w-12 min-h-12 md:w-9 md:h-9`-style mobile-only overrides. No new dependencies, no new components — pure Tailwind class changes plus one new `isMobileNavOpen` boolean in `Dashboard.tsx`.

**Tech Stack:** Next.js 16.2 App Router, React 19, Tailwind CSS v4, TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-11-mobile-responsive-shell-design.md`

---

### Task 1: Explicit viewport export

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add the `viewport` export**

Current (`src/app/layout.tsx`):
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CurricuGen Pro — AI Curriculum Generator",
  description: "Generate professional lesson plans, worksheets, assessments, and more with AI — built for teachers.",
};
```

New:
```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CurricuGen Pro — AI Curriculum Generator",
  description: "Generate professional lesson plans, worksheets, assessments, and more with AI — built for teachers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(mobile): add explicit viewport export"
```

---

### Task 2: Momentum scrolling CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Read the current file to find the print-styles section**

Run: `grep -n "@media print" src/app/globals.css` to find the insertion point (add the new block immediately before it, or at the end of the file if simpler — either is fine, just don't insert it inside another rule block).

- [ ] **Step 2: Add the rule**

```css
/* ─── Mobile scroll behavior ────────────────────────────── */
.overflow-y-auto,
.overflow-x-auto {
  -webkit-overflow-scrolling: touch;
}
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no CSS errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(mobile): add momentum scrolling for scrollable panes"
```

---

### Task 3: Dashboard mobile nav — state, top bar, drawer, backdrop

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Add `isMobileNavOpen` state**

Current (`src/components/Dashboard.tsx:26`, alongside `isSidebarCollapsed`):
```tsx
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
```

New:
```tsx
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
```

- [ ] **Step 2: Add the mobile top bar**

Current (`src/components/Dashboard.tsx:258-261`):
```tsx
  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden flex">
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out z-50 shadow-2xl flex-none`}>
```

New — add the top bar as the first child of the root `<div>`, before the `{/* Sidebar */}` comment:
```tsx
  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden flex">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 flex items-center px-4 z-40 shadow-lg">
        <button
          onClick={() => setIsMobileNavOpen(true)}
          className="min-w-12 min-h-12 flex items-center justify-center text-white -ml-2"
          aria-label="Open navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">CurricuGen</span>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out z-50 shadow-2xl flex-none`}>
```

`Menu` and `Sparkles` are already imported in this file (used by the desktop collapse toggle and the loading screens respectively) — no new imports needed.

- [ ] **Step 3: Make the sidebar an off-canvas drawer below `md:`**

Current (`src/components/Dashboard.tsx`, the `<aside>` opening tag from Step 2 above):
```tsx
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out z-50 shadow-2xl flex-none`}>
```

New:
```tsx
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 md:${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col transition-transform md:transition-all duration-300 ease-in-out shadow-2xl flex-none ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
```

**Important Tailwind gotcha:** the template literal `` md:${isSidebarCollapsed ? 'w-20' : 'w-64'} `` will NOT work with Tailwind's JIT compiler — Tailwind scans source files for literal class strings and cannot resolve dynamically-interpolated class names like `` `md:${variable}` ``. You must write out both full literal classes and pick between them:

```tsx
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'} bg-slate-900 text-slate-300 flex flex-col transition-transform md:transition-all duration-300 ease-in-out shadow-2xl flex-none ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
```

This is the correct version — use this one, not the broken interpolated one shown first (that broken version is included above only to explain the mistake to avoid; do not write it).

- [ ] **Step 4: Add the backdrop**

Insert immediately after the `</aside>` closing tag (`src/components/Dashboard.tsx:313` in the pre-edit file — re-locate it in your live copy since Steps 2-3 shifted line numbers):

```tsx
      </aside>

      {/* Mobile nav backdrop */}
      {isMobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Main Content */}
```

- [ ] **Step 5: Offset main content for the mobile top bar**

Current (`src/components/Dashboard.tsx:316`):
```tsx
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
```

New:
```tsx
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 pt-14 md:pt-0">
```

- [ ] **Step 6: Close the drawer on navigation**

Current (`src/components/Dashboard.tsx:272, 283`):
```tsx
          <NavItem icon={Users} label="My Classes" isActive={appState === AppState.CLASS_LIST} onClick={handleBackToClasses} collapsed={isSidebarCollapsed} />
```
and
```tsx
              <NavItem icon={LayoutDashboard} label="Curriculum" isActive={appState === AppState.DASHBOARD || appState === AppState.LESSON_VIEW} onClick={() => setAppState(AppState.DASHBOARD)} collapsed={isSidebarCollapsed} />
```

New:
```tsx
          <NavItem icon={Users} label="My Classes" isActive={appState === AppState.CLASS_LIST} onClick={() => { handleBackToClasses(); setIsMobileNavOpen(false); }} collapsed={isSidebarCollapsed} />
```
and
```tsx
              <NavItem icon={LayoutDashboard} label="Curriculum" isActive={appState === AppState.DASHBOARD || appState === AppState.LESSON_VIEW} onClick={() => { setAppState(AppState.DASHBOARD); setIsMobileNavOpen(false); }} collapsed={isSidebarCollapsed} />
```

- [ ] **Step 7: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat(mobile): add hamburger + slide-out drawer navigation to Dashboard shell"
```

---

### Task 4: `NavItem` touch-target sizing

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Add mobile touch-target sizing**

Current (`src/components/Dashboard.tsx:365-366`):
```tsx
const NavItem = ({ icon: Icon, label, isActive, onClick, collapsed }: NavItemProps) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'} ${collapsed ? 'justify-center' : ''}`} title={collapsed ? label : undefined}>
```

New:
```tsx
const NavItem = ({ icon: Icon, label, isActive, onClick, collapsed }: NavItemProps) => (
  <button onClick={onClick} className={`w-full min-h-12 md:min-h-0 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'} ${collapsed ? 'justify-center' : ''}`} title={collapsed ? label : undefined}>
```

- [ ] **Step 2: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat(mobile): grow NavItem touch targets to 48px on mobile"
```

---

### Task 5: `ClassManager.tsx` — card icon touch targets + modal padding

**Files:**
- Modify: `src/components/ClassManager.tsx`

- [ ] **Step 1: Card action icon touch targets**

Read the actual current file around lines 229-256 first to confirm exact structure (it should match Sub-project 2's card action row: Edit/Analytics/Delete buttons, each currently `w-9 h-9`).

Current (each of the three buttons, e.g. the Edit button):
```tsx
                       <button
                          title="Edit Class"
                          onClick={(e) => { e.stopPropagation(); onOpenEditClass?.(cls); }}
                          className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all duration-300"
                       >
```

New — replace `w-9 h-9` with `min-w-12 min-h-12 md:w-9 md:h-9` on all three buttons (Edit, Class Analytics, Delete):
```tsx
                       <button
                          title="Edit Class"
                          onClick={(e) => { e.stopPropagation(); onOpenEditClass?.(cls); }}
                          className="min-w-12 min-h-12 md:w-9 md:h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all duration-300"
                       >
```
Apply the same `w-9 h-9` → `min-w-12 min-h-12 md:w-9 md:h-9` replacement to the `title="Class Analytics"` and `title="Delete Class"` buttons in the same row.

- [ ] **Step 2: Modal header padding — create/edit wizard**

Current (`src/components/ClassManager.tsx:305-306`):
```tsx
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[92vh] border border-white">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center flex-none bg-white">
```

New:
```tsx
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-2xl rounded-2xl sm:rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[92vh] border border-white">
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-100 flex justify-between items-center flex-none bg-white">
```

- [ ] **Step 3: Modal body padding — create/edit wizard**

Current (`src/components/ClassManager.tsx:314`):
```tsx
            <form onSubmit={handleCreateClass} className="p-8 overflow-y-auto flex-1 custom-scrollbar">
```

New:
```tsx
            <form onSubmit={handleCreateClass} className="p-4 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
```

- [ ] **Step 4: Delete confirmation modal padding**

Current (`src/components/ClassManager.tsx:530`):
```tsx
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-300 border border-white">
```

New:
```tsx
          <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-[2rem] shadow-2xl p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-300 border border-white">
```

- [ ] **Step 5: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ClassManager.tsx
git commit -m "feat(mobile): grow card action icons to 48px and tune modal padding on mobile"
```

---

### Task 6: `CurriculumDashboard.tsx` — header button touch targets

**Files:**
- Modify: `src/components/CurriculumDashboard.tsx`

- [ ] **Step 1: Read the actual current header buttons**

Run: `sed -n '92,110p' src/components/CurriculumDashboard.tsx` (or Read the file) to confirm the exact current classNames for the "Edit Class" and "Edit Blueprint" buttons before editing — the excerpt below is accurate as of plan-writing time.

Current (`src/components/CurriculumDashboard.tsx:93-104`):
```tsx
           <button
             onClick={onEditClass}
             className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all duration-300 shadow-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5"
           >
             <Pencil className="w-4 h-4" />
             Edit Class
           </button>
           <button 
             onClick={() => setIsEditing(!isEditing)}
             className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all duration-300 shadow-sm ${
               isEditing 
                 ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-500 hover:-translate-y-0.5' 
                 : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5'
             }`}
           >
```

New — add `min-h-12` to both buttons:
```tsx
           <button
             onClick={onEditClass}
             className="min-h-12 flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all duration-300 shadow-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5"
           >
             <Pencil className="w-4 h-4" />
             Edit Class
           </button>
           <button 
             onClick={() => setIsEditing(!isEditing)}
             className={`min-h-12 flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all duration-300 shadow-sm ${
               isEditing 
                 ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-500 hover:-translate-y-0.5' 
                 : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5'
             }`}
           >
```

- [ ] **Step 2: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CurriculumDashboard.tsx
git commit -m "feat(mobile): ensure CurriculumDashboard header buttons meet 48px touch target"
```

---

### Task 7: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no type errors.

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: 0 errors (pre-existing warnings acceptable, no new ones).

- [ ] **Step 3: Resize the Browser pane to mobile and walk through**

Use `resize_window` with the `mobile` preset (375×812) on the Browser pane, sign in, and verify:
1. The desktop sidebar is gone; a thin dark top bar with a hamburger icon and the CurricuGen logo is visible instead.
2. Tapping the hamburger opens the drawer sliding in from the left, with a dark backdrop covering the rest of the screen.
3. Tapping the backdrop closes the drawer.
4. Tapping "My Classes" or "Curriculum" inside the drawer navigates AND closes the drawer automatically.
5. On the class list, the edit/analytics/delete icons on each card are visibly larger than before and easy to tap without mis-hitting a neighboring icon.
6. Opening the create/edit class modal shows tighter padding than desktop but is still fully readable and usable — no horizontal overflow/scrollbar.
7. The delete confirmation modal fits within the viewport without horizontal overflow.
8. In `CurriculumDashboard`, the "Edit Class" and "Edit Blueprint" buttons are comfortably tappable.
9. Resize back to desktop width (1280×800) — confirm the sidebar returns to its normal permanent/collapsible behavior with zero visual regression from before this plan.

- [ ] **Step 4: Report results**

No commit for this task — it's verification. If any step fails, return to the relevant task above and fix before proceeding to code review.
