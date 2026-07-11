# Mobile-Responsive Shell — Design Spec
**Date:** 2026-07-11
**Project:** CurricuGen Pro
**Sub-project:** Mobile optimization, Phase 1 of 2 (Dashboard shell, ClassManager, CurriculumDashboard)
**Status:** Approved

---

## 1. Problem Statement

The app is structurally desktop-only. `Dashboard.tsx` (the top-level shell every screen renders inside) has zero responsive classes and uses a permanent fixed-width `flex` sidebar (`w-64`/`w-20`) — on a 375px phone this consumes 55–85% of the viewport width with no way to collapse it below a breakpoint. `ClassManager.tsx` and `CurriculumDashboard.tsx` are partially adapted (grid layouts already stack on mobile) but have undersized touch targets and no mobile-specific spacing tuning. There is no explicit `viewport` meta configuration and no mobile-specific CSS in `globals.css`.

`LessonWorkspace.tsx` (the 3-panel lesson editor) is even more broken — fixed `w-72` + `w-96` panels — but is deliberately **out of scope here**; it needs a separate, more invasive drawer/tab rework and is planned as Phase 2.

## 2. Scope

**In scope:**
- Explicit `viewport` export in `src/app/layout.tsx`
- Mobile-first hamburger + slide-out drawer navigation in `Dashboard.tsx`, reverting to the existing permanent sidebar at `md:` and up
- Touch-target sizing (≥48×48px) on mobile for `Dashboard.tsx` nav items, `ClassManager.tsx` card action icons, and `CurriculumDashboard.tsx` header buttons — compact/unchanged on desktop
- Mobile spacing/padding tuning for `ClassManager.tsx` modals
- Smooth-scrolling CSS addition to `globals.css`

**Out of scope:**
- `LessonWorkspace.tsx`'s 3-panel structural rework (Phase 2, separate spec)
- Marketing pages (`page.tsx`, `pricing/page.tsx`) — already the best-adapted screens; revisit only if Phase 1 surfaces shared-component changes that affect them
- Rewriting the 75 existing `hover:` classes — Tailwind v4's default hover strategy already gates these behind `@media (hover: hover)`, so touch devices don't get stuck-hover states today. Will verify in-browser during implementation rather than speculatively rewrite.
- Any new dependencies

---

## 3. Architecture Overview

```
src/app/layout.tsx                  ← add explicit `viewport` export
src/app/globals.css                 ← add -webkit-overflow-scrolling: touch
src/components/Dashboard.tsx        ← mobile top bar + hamburger + drawer sidebar;
                                       touch-target sizing on NavItem
src/components/ClassManager.tsx     ← touch-target sizing on card action icons;
                                       mobile padding tuning on modals
src/components/CurriculumDashboard.tsx ← touch-target sizing on header buttons
```

**Breakpoint strategy:** Tailwind's default breakpoints (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px), already partially in use across the codebase — no custom breakpoint config needed. The drawer/permanent-sidebar split happens at `md:` (768px), matching where a device stops being "phone-sized" in practice.

---

## 4. Global Setup

### 4.1 `src/app/layout.tsx` — explicit viewport

Current:
```tsx
export const metadata: Metadata = {
  title: "CurricuGen Pro — AI Curriculum Generator",
  description: "Generate professional lesson plans, worksheets, assessments, and more with AI — built for teachers.",
};
```

New — add a sibling `viewport` export (the Next.js App Router convention; separate from `metadata` since Next.js 14):
```tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "CurricuGen Pro — AI Curriculum Generator",
  description: "Generate professional lesson plans, worksheets, assessments, and more with AI — built for teachers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
```

This is functionally identical to what Next.js already injects by default with no `viewport` export — making it explicit gives a single place to tune later (e.g. `maximumScale` for a specific form screen) without hunting for where the meta tag lives.

### 4.2 `src/app/globals.css` — momentum scrolling

Add near the existing print styles:
```css
/* ─── Mobile scroll behavior ────────────────────────────── */
.overflow-y-auto,
.overflow-x-auto {
  -webkit-overflow-scrolling: touch;
}
```

This targets Tailwind's own utility class names directly (no new custom class needed) so every existing scrollable pane in the app gets momentum scrolling on iOS Safari without touching each component.

---

## 5. Dashboard Shell — Mobile Navigation

### 5.1 New state

In `Dashboard.tsx`, alongside the existing `isSidebarCollapsed` state:
```tsx
const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
```

This is a separate piece of state from `isSidebarCollapsed` (which only applies at `md:`+) — mobile nav is either fully open (drawer visible) or fully closed (drawer off-canvas), there's no "collapsed-but-visible" state on mobile.

### 5.2 Mobile top bar (new, `md:hidden`)

Added above the existing `<div className="h-screen ... flex">` root, or as its first child — a thin fixed bar visible only below `md:`:

```tsx
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
```

`Menu` icon is already imported from `lucide-react` in this file (used for the desktop collapse toggle) — no new import needed.

### 5.3 Sidebar becomes a drawer below `md:`

Current (`src/components/Dashboard.tsx`):
```tsx
<aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out z-50 shadow-2xl flex-none`}>
```

New:
```tsx
<aside className={`
  fixed md:static inset-y-0 left-0 z-50
  w-64 md:${isSidebarCollapsed ? 'w-20' : 'w-64'}
  bg-slate-900 text-slate-300 flex flex-col
  transition-transform md:transition-all duration-300 ease-in-out
  shadow-2xl flex-none
  ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
`}>
```

Below `md:`: the sidebar is always full-width (`w-64`) but slides fully off-screen (`-translate-x-full`) unless `isMobileNavOpen` is true, at which point it slides in (`translate-x-0`) as an overlay (`fixed`, `z-50`). At `md:` and up: reverts to today's exact behavior — `static` positioning, width driven by `isSidebarCollapsed`, always visible (`md:translate-x-0` overrides any mobile transform state).

All existing sidebar content (logo, `NavItem`s, active-class card, credits panel, `UserButton`, collapse toggle) stays exactly as-is inside this `<aside>` — only the wrapper's positioning classes change.

### 5.4 Backdrop (new, mobile-only)

Rendered as a sibling of `<aside>`, only when the drawer is open:
```tsx
{isMobileNavOpen && (
  <div
    className="md:hidden fixed inset-0 bg-black/40 z-40"
    onClick={() => setIsMobileNavOpen(false)}
  />
)}
```

### 5.5 Closing the drawer on navigation

Every `NavItem`'s `onClick` and the "back to classes" flows should also close the mobile drawer, so selecting a destination doesn't leave the overlay open on top of the new screen. Wrap the existing handlers:

```tsx
<NavItem icon={Users} label="My Classes" isActive={appState === AppState.CLASS_LIST} onClick={() => { handleBackToClasses(); setIsMobileNavOpen(false); }} collapsed={isSidebarCollapsed} />
```
(same pattern for the "Curriculum" `NavItem`)

### 5.6 Content area offset for the mobile top bar

The main content `<div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">` needs top padding on mobile to clear the new fixed top bar:
```tsx
<div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 pt-14 md:pt-0">
```

### 5.7 Touch targets — `NavItem`

Current `NavItem` component:
```tsx
const NavItem = ({ icon: Icon, label, isActive, onClick, collapsed }: NavItemProps) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'} ${collapsed ? 'justify-center' : ''}`} title={collapsed ? label : undefined}>
```

New — add `min-h-12 md:min-h-0`:
```tsx
const NavItem = ({ icon: Icon, label, isActive, onClick, collapsed }: NavItemProps) => (
  <button onClick={onClick} className={`w-full min-h-12 md:min-h-0 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'} ${collapsed ? 'justify-center' : ''}`} title={collapsed ? label : undefined}>
```

---

## 6. `ClassManager.tsx` — Touch Targets & Modal Spacing

### 6.1 Card action icons

Current (edit/analytics/delete buttons, each `w-9 h-9`):
```tsx
<button title="Edit Class" onClick={...} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all duration-300">
```

New — `min-w-12 min-h-12 md:w-9 md:h-9`:
```tsx
<button title="Edit Class" onClick={...} className="min-w-12 min-h-12 md:w-9 md:h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all duration-300">
```
Same pattern applied to the analytics and delete buttons in the same row.

### 6.2 Modal padding

Current wizard modal:
```tsx
<div className="bg-white/95 backdrop-blur-xl w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[92vh] border border-white">
  <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center flex-none bg-white">
```

New — reduce padding on mobile:
```tsx
<div className="bg-white/95 backdrop-blur-xl w-full max-w-2xl rounded-2xl sm:rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[92vh] border border-white">
  <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-100 flex justify-between items-center flex-none bg-white">
```
Same `px-8`→`px-4 sm:px-8` / `py-6`→`py-4 sm:py-6` pattern applied to the form body padding (`p-8` → `p-4 sm:p-8`) and the delete-confirmation modal's `p-8`.

---

## 7. `CurriculumDashboard.tsx` — Touch Targets

### 7.1 Header buttons

Current "Edit Class" / "Edit Blueprint" buttons use `px-6 py-3` — already close to 48px tall (py-3 = 12px × 2 + line height ≈ 44-48px depending on font), but verify in-browser and add `min-h-12` if short:
```tsx
<button onClick={onEditClass} className="min-h-12 flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all duration-300 shadow-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5">
```
Same `min-h-12` addition to the "Edit Blueprint" toggle button.

---

## 8. Error Handling / Edge Cases

| Scenario | Behaviour |
|---|---|
| Drawer open, user resizes window past `md:` (e.g. rotating a tablet, or a desktop dev-tools resize) | `md:translate-x-0` in the className always wins at `md:`+ regardless of `isMobileNavOpen` state — no visual glitch, drawer effectively becomes "always visible" the moment the breakpoint crosses, no JS resize listener needed. |
| User taps backdrop while a modal (create/edit class) is also open | Backdrop only renders for the nav drawer (`isMobileNavOpen`), which is a separate piece of state from the modal's `isModalOpen` — no interaction between the two, standard z-index stacking (drawer `z-50`, its backdrop `z-40`, modals already use `z-[100]`) keeps modals on top. |
| Very small screens (<375px, e.g. old iPhone SE) | Sidebar drawer is `w-64` (256px) — leaves ~119px of visible backdrop on a 375px screen, acceptable; no further scaling needed since 256px already comfortably fits the smallest realistic target device. |

---

## 9. Files Changed

| File | Change |
|---|---|
| `src/app/layout.tsx` | Add explicit `viewport` export |
| `src/app/globals.css` | Add `-webkit-overflow-scrolling: touch` for scrollable panes |
| `src/components/Dashboard.tsx` | Mobile top bar + hamburger; sidebar becomes off-canvas drawer below `md:`; backdrop; drawer-close-on-navigate; `NavItem` touch-target sizing; content-area top padding |
| `src/components/ClassManager.tsx` | Card action icon touch-target sizing (mobile-only growth); modal padding tuning for mobile |
| `src/components/CurriculumDashboard.tsx` | Header button touch-target verification/sizing |

---

## 10. Constraints & Decisions

- **Phased: shell first, `LessonWorkspace.tsx` second** — the shell (Dashboard + ClassManager + CurriculumDashboard) affects every screen and is a more contained, lower-risk change; the 3-panel lesson editor needs a genuinely different interaction pattern (tabs or stacked drawers instead of 3 simultaneous columns) and deserves its own spec.
- **Touch targets grow mobile-only, not everywhere** — desktop users have mouse precision and benefit from denser UI; forcing 48px everywhere would visually bloat the desktop experience for no accessibility gain there.
- **Hamburger + drawer over bottom tab bar** — reuses the existing sidebar's content and markup almost unchanged (just repositioning), versus building an entirely new bottom-nav component from scratch. Matches the nav's actual complexity (2 primary destinations + account/credits info), which doesn't need the always-visible urgency a bottom tab bar implies.
- **No hover-class rewrite** — Tailwind v4's default `hover` media strategy already wraps `hover:` utilities in `@media (hover: hover)`, so this was already not a live bug; rewriting 75 call sites for a non-issue would be pure risk with no benefit. Will be spot-checked in-browser during implementation, not blindly trusted.
- **Breakpoint at `md:` (768px)**, not `sm:` (640px) — matches where the codebase already draws its mobile/desktop line in the handful of places that do have responsive classes (`ClassManager.tsx`'s `grid-cols-1 md:grid-cols-2`), keeping the new drawer logic consistent with existing conventions rather than introducing a second breakpoint convention.
