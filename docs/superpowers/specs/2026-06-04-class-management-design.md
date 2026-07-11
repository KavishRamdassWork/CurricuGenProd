# Class Management — Design Spec
**Date:** 2026-06-04
**Project:** CurricuGen Pro
**Sub-project:** 2 of 3 (Edit / Delete / Outdated Content)
**Status:** Approved

---

## 1. Problem Statement

`ClassManager.tsx` can only create classrooms. Two server-side endpoints already exist but have no UI:
- `PATCH /api/classrooms/[id]` — updates a classroom
- `DELETE /api/classrooms/[id]` — deletes a classroom (`Dashboard.tsx` already has `handleDeleteClass`, but nothing calls it)

Teachers currently cannot fix a typo in a class profile, correct student counts, or remove a class they no longer teach without going around the app (e.g. directly in the DB). Additionally, once a class is edited, any AI-generated content that was produced under the old profile (subject, grade, curriculum, student count, performance level, learning styles, accommodations, interests) silently goes stale with no indication to the teacher.

---

## 2. Scope

**In scope:**
- Edit an existing classroom via the same 2-step wizard used for creation, pre-filled
- Delete a classroom via a detailed, informative confirmation modal
- Detect and visually flag lesson content that was generated under settings that no longer match the current class profile
- Post-edit prompt offering to regenerate the blueprint (with a token-cost warning) or keep existing content
- Clear the "outdated" flag when the teacher explicitly chooses to keep existing content

**Out of scope:**
- Automatic/background regeneration of content
- Editing individual saved lesson sections independently of the class profile
- Slideshow presentation mode (Sub-project 3)

---

## 3. Architecture Overview

```
src/lib/types.ts                        ← LessonContent.settingsHash?: string
src/lib/classHash.ts                    ← NEW: computeSettingsHash(classroom)
src/app/api/classrooms/[id]/route.ts    ← PATCH allowedFields gains learningStyles/
                                            accommodations/studentInterests
src/components/ClassManager.tsx         ← editingClass prop, edit trigger (card hover
                                            action row), delete modal + trigger
src/components/Dashboard.tsx            ← handleEditClass, wires onDeleteClass with
                                            confirmation, post-save regenerate prompt
src/components/LessonWorkspace.tsx      ← NavButton gains isOutdated prop; outdated
                                            check computed from activeClass + unitKey
```

**Single source of truth:** `Classroom.savedLessons[unitKey].settingsHash` — a string computed from the AI-relevant fields at the moment that unit's content was generated. No new DB columns; it rides inside the existing `savedLessons` JSON blob.

---

## 4. Feature A — Edit Class

### 4.1 Trigger points (Option C — both)

1. **Class card hover action row** — the analytics button (`BarChart2`) on each class card is joined by an Edit (`Pencil`) and Delete (`Trash2`) icon, grouped together so the card header doesn't get crowded:

```tsx
<div className="flex items-center gap-1">
  <button onClick={(e) => { e.stopPropagation(); onEditClass(cls); }} title="Edit Class"
    className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all">
    <Pencil className="w-4 h-4" />
  </button>
  <button onClick={(e) => { e.stopPropagation(); setActiveAnalysisClassId(cls.id); }} title="Class Analytics"
    className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 transition-all">
    <BarChart2 className="w-4 h-4" />
  </button>
  <button onClick={(e) => { e.stopPropagation(); setDeleteTargetId(cls.id); }} title="Delete Class"
    className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-all">
    <Trash2 className="w-4 h-4" />
  </button>
</div>
```

This row replaces the existing lone `BarChart2` button in the card header (`ClassManager.tsx:196-201`).

2. **Workspace header** — when a teacher is already inside a class's curriculum dashboard, an "Edit Class" button opens the same modal without navigating back to the class list. (Added to `CurriculumDashboard.tsx` header, calling the same `onEditClass` handler passed down from `Dashboard.tsx`.)

### 4.2 `ClassManager.tsx` — `editingClass` prop

```tsx
interface ClassManagerProps {
  classes: Classroom[];
  setClasses: React.Dispatch<React.SetStateAction<Classroom[]>>;
  onOpenClass: (classroom: Classroom) => void;
  onCreateClass?: (classroom: Omit<Classroom, 'id'>) => Promise<Classroom | null>;
  onUpdateClass?: (classroomId: string, patch: Partial<Classroom>) => Promise<Classroom | null>;
  onDeleteClass?: (classroomId: string) => Promise<void>;
  editingClass?: Classroom | null;
  onCloseEdit?: () => void;
}
```

When `editingClass` is set (from `Dashboard.tsx`), the modal opens pre-filled and in edit mode:

```tsx
useEffect(() => {
  if (editingClass) {
    setName(editingClass.name);
    setSubject(editingClass.subject);
    setGrade(editingClass.grade);
    setCurriculum(editingClass.curriculum);
    setStudentCount(editingClass.studentCount);
    setPercentile(editingClass.averagePercentile);
    setNotes(editingClass.teachingNotes);
    setLearningStyles(editingClass.learningStyles ?? []);
    setAccommodations(editingClass.accommodations ?? '');
    setStudentInterests(editingClass.studentInterests ?? '');
    setWizardStep(1);
    setIsModalOpen(true);
  }
}, [editingClass]);
```

The modal title and submit button change based on mode:

```tsx
<h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
  {editingClass ? 'Edit Class Profile' : 'New Class Profile'}
</h2>
```

```tsx
<button type="submit" disabled={isCreating} ...>
  {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
  {editingClass ? 'Save Changes' : 'Create Workspace'} <ArrowRight className="w-5 h-5" />
</button>
```

`handleCreateClass` branches at submit time:

```tsx
const handleCreateClass = async (e: React.FormEvent) => {
  e.preventDefault();
  if (wizardStep === 1) {
    if (name && subject && grade) { setWizardStep(2); setStepChangeTime(Date.now()); }
    return;
  }
  if (Date.now() - stepChangeTime < 500) return;

  setIsCreating(true);
  const classData = {
    name, subject, grade, curriculum, studentCount,
    averagePercentile: percentile,
    teachingNotes: notes,
    learningStyles, accommodations, studentInterests,
  };
  try {
    if (editingClass && onUpdateClass) {
      const updated = await onUpdateClass(editingClass.id, classData);
      if (updated) { setIsModalOpen(false); resetForm(); onCloseEdit?.(); }
    } else if (onCreateClass) {
      const created = await onCreateClass({ ...classData, students: [], assessmentColumns: [] });
      if (created) { setIsModalOpen(false); resetForm(); onOpenClass(created); }
    }
  } finally {
    setIsCreating(false);
  }
};
```

Closing the modal (X button or Cancel) must also call `onCloseEdit?.()` when in edit mode, so `Dashboard.tsx` clears its `editingClass` state:

```tsx
<button onClick={() => { setIsModalOpen(false); onCloseEdit?.(); }} ...>
```

### 4.3 `PATCH /api/classrooms/[id]` — allow the new fields

`src/app/api/classrooms/[id]/route.ts:33-37` — `allowedFields` currently omits `learningStyles`, `accommodations`, `studentInterests`, so edits to those fields silently drop. Add them:

```ts
const allowedFields: string[] = [
  'name', 'subject', 'grade', 'curriculum', 'studentCount',
  'averagePercentile', 'teachingNotes', 'blueprint',
  'learningStyles', 'accommodations', 'studentInterests',
  'students', 'assessmentColumns', 'savedLessons', 'analysis',
];
```

### 4.4 `Dashboard.tsx` — edit handler + post-save regeneration prompt

```tsx
const [editingClass, setEditingClass] = useState<Classroom | null>(null);

const handleEditClass = (classroom: Classroom) => setEditingClass(classroom);

const handleUpdateClass = async (classroomId: string, patch: Partial<Classroom>) => {
  const before = classes.find(c => c.id === classroomId);
  if (!before) return null;

  const beforeHash = computeSettingsHash(before);
  const afterHash = computeSettingsHash({ ...before, ...patch } as Classroom);

  try {
    const res = await fetch(`/api/classrooms/${classroomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update classroom');
    const { classroom: updated } = await res.json();
    const full: Classroom = { ...before, ...updated };
    setClasses(prev => prev.map(c => c.id === classroomId ? full : c));

    if (beforeHash !== afterHash && full.blueprint && Object.keys(full.savedLessons || {}).length > 0) {
      promptRegenerateOrKeep(full);
    }
    return full;
  } catch (err) {
    console.error(err);
    return null;
  }
};
```

The post-save prompt (Option: regenerate with token warning, or keep existing content):

```tsx
const promptRegenerateOrKeep = (updatedClass: Classroom) => {
  const wantsRegen = window.confirm(
    `You changed settings that affect AI-generated content.\n\n` +
    `Regenerate the curriculum blueprint now? This uses one of your daily generations. ` +
    `Existing lesson plans, slides, and resources will be marked outdated but not deleted — ` +
    `you can regenerate individual items later, or keep using them as-is.\n\n` +
    `Click Cancel to keep everything exactly as it is.`
  );
  if (wantsRegen) {
    handleOpenClass({ ...updatedClass, blueprint: undefined });
  }
  // If Cancel: no action needed. Existing content is already correctly flagged
  // outdated because its stored settingsHash no longer matches computeSettingsHash(updatedClass).
};
```

Passing the new props to `ClassManager`:

```tsx
<ClassManager
  classes={classes}
  setClasses={setClasses}
  onOpenClass={handleOpenClass}
  onCreateClass={handleCreateClass}
  onUpdateClass={handleUpdateClass}
  onDeleteClass={handleDeleteClass}
  editingClass={editingClass}
  onCloseEdit={() => setEditingClass(null)}
/>
```

---

## 5. Feature B — Outdated Content Detection

### 5.1 `src/lib/classHash.ts` (new file)

```ts
import { Classroom } from './types';

/** Deterministic hash of the classroom fields that influence AI generation.
 *  Used to detect when saved lesson content was generated under different
 *  settings than the classroom currently has. */
export function computeSettingsHash(c: Pick<Classroom,
  'subject' | 'grade' | 'curriculum' | 'studentCount' | 'averagePercentile' |
  'learningStyles' | 'accommodations' | 'studentInterests' | 'teachingNotes'
>): string {
  return [
    c.subject,
    c.grade,
    c.curriculum,
    c.studentCount,
    c.averagePercentile,
    (c.learningStyles ?? []).slice().sort().join(','),
    c.accommodations ?? '',
    c.studentInterests ?? '',
    c.teachingNotes ?? '',
  ].join('|');
}
```

Learning styles are sorted before joining so that reordering the same set of styles doesn't spuriously flag content as outdated.

### 5.2 `src/lib/types.ts` — `settingsHash` on `LessonContent`

```ts
export interface LessonContent {
  plan: string;
  slides: string;
  worksheets: EducationalResource[];
  assignments: EducationalResource[];
  tests: EducationalResource[];
  imageUrl?: string;
  slideImages?: { slideNumber: number; imageUrl: string }[];
  settingsHash?: string;
}
```

### 5.3 `LessonWorkspace.tsx` — stamp hash on save, compare on load

Import `computeSettingsHash` and stamp it into every save (`LessonWorkspace.tsx:85-95`):

```tsx
import { computeSettingsHash } from '@/lib/classHash';

useEffect(() => {
  onSaveClassContent(activeClass.id, unitKey, {
    plan: lessonPlan || '',
    slides: slides || '',
    worksheets,
    assignments,
    tests,
    imageUrl: generatedImageUrl || '',
    slideImages,
    settingsHash: computeSettingsHash(activeClass),
  });
}, [lessonPlan, slides, worksheets, assignments, tests, generatedImageUrl, slideImages]);
```

Compute whether the currently loaded unit is outdated:

```tsx
const currentHash = computeSettingsHash(activeClass);
const savedHash = activeClass.savedLessons?.[unitKey]?.settingsHash;
const isUnitOutdated = !!savedHash && savedHash !== currentHash;
```

`isUnitOutdated` is `false` for content that predates this feature (no `settingsHash` stored) — it does not retroactively flag old content, only content that is provably stale.

### 5.4 `NavButton` — `isOutdated` prop

`LessonWorkspace.tsx:921` — extend the existing component:

```tsx
const NavButton = ({ icon: Icon, label, active, onClick, collapsed, hasContent, isOutdated }: any) => (
  <button onClick={onClick} title={collapsed ? label : undefined}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'} ${collapsed ? 'justify-center' : ''}`}>
    <Icon className={`w-4.5 h-4.5 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
    {!collapsed && (
      <span className="flex-1 flex items-center justify-between text-sm font-semibold">
        {label}
        {isOutdated ? (
          <span className="bg-amber-100 text-amber-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> Outdated
          </span>
        ) : hasContent ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : null}
      </span>
    )}
  </button>
);
```

Wire it up at each call site (`LessonWorkspace.tsx:397-422`):

```tsx
<NavButton icon={BookOpen} label="Lesson Plan" active={activeSection === 'plan'} onClick={() => setActiveSection('plan')} collapsed={isSidebarCollapsed} hasContent={!!lessonPlan} isOutdated={isUnitOutdated && !!lessonPlan} />
<NavButton icon={MonitorPlay} label="Slides" active={activeSection === 'slides'} onClick={() => setActiveSection('slides')} collapsed={isSidebarCollapsed} hasContent={!!slides} isOutdated={isUnitOutdated && !!slides} />
<NavButton icon={ImageIcon} label="Visual Aids" active={activeSection === 'visuals'} onClick={() => setActiveSection('visuals')} collapsed={isSidebarCollapsed} hasContent={!!generatedImageUrl} isOutdated={isUnitOutdated && !!generatedImageUrl} />
<NavButton icon={Gamepad2} label="Activity" active={activeSection === 'game'} onClick={() => setActiveSection('game')} collapsed={isSidebarCollapsed} hasContent={!!game} isOutdated={isUnitOutdated && !!game} />
<NavButton icon={Library} label="Links" active={activeSection === 'resources'} onClick={() => setActiveSection('resources')} collapsed={isSidebarCollapsed} hasContent={!!resources} isOutdated={isUnitOutdated && !!resources} />
```

`isOutdated` is gated on the section actually having content — an empty, never-generated section shouldn't show an "outdated" badge, since there's nothing outdated about it.

`AlertTriangle` is already imported in `LessonWorkspace.tsx` (used elsewhere); no new import needed beyond `computeSettingsHash`.

### 5.5 Clearing the flag ("Keep Existing" acknowledgement)

When the teacher declines regeneration in the post-edit prompt (§4.4, Cancel branch), the mismatch is real and intentional — the teacher has seen the warning and chosen to keep using the content as-is. Nothing needs to change for this to work correctly: the badge already reflects ground truth (settings changed, content didn't). The badge clears itself automatically the next time that unit's content is saved with a hash recomputed from the current settings — e.g., if the teacher uses the AI chat to refine that section, the `useEffect` in §5.3 re-stamps `settingsHash` to the current value and the mismatch resolves. No separate "acknowledge" UI is needed.

---

## 6. Feature C — Delete Class

### 6.1 Confirmation modal (Option B — detailed impact)

New state in `ClassManager.tsx`:

```tsx
const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
const [isDeleting, setIsDeleting] = useState(false);
const deleteTarget = classes.find(c => c.id === deleteTargetId);
```

```tsx
const handleConfirmDelete = async () => {
  if (!deleteTarget || !onDeleteClass) return;
  setIsDeleting(true);
  try {
    await onDeleteClass(deleteTarget.id);
    setDeleteTargetId(null);
  } finally {
    setIsDeleting(false);
  }
};
```

Modal JSX, added alongside the other modals in `ClassManager.tsx`:

```tsx
{deleteTarget && (
  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-300 border border-white">
      <h2 className="text-xl font-extrabold text-slate-900 mb-1">Delete Class</h2>
      <p className="text-slate-500 text-sm mb-6">This action cannot be undone.</p>

      <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-5">
        <div className="font-bold text-red-900">{deleteTarget.name}</div>
        <div className="text-xs text-red-600 font-medium">
          {deleteTarget.grade} • {deleteTarget.subject} • {deleteTarget.studentCount} students
        </div>
      </div>

      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        The following will be permanently deleted
      </p>
      <ul className="text-sm text-slate-600 space-y-2 mb-8">
        <li>• Curriculum blueprint {deleteTarget.blueprint ? `(${deleteTarget.blueprint.units.length} weeks)` : '(not yet generated)'}</li>
        <li>• {Object.keys(deleteTarget.savedLessons ?? {}).length} saved lesson{Object.keys(deleteTarget.savedLessons ?? {}).length === 1 ? '' : 's'}</li>
        <li>• {countResources(deleteTarget, 'worksheets')} worksheets, {countResources(deleteTarget, 'assignments')} assignments, {countResources(deleteTarget, 'tests')} tests</li>
        <li>• All student marks &amp; analysis for {deleteTarget.studentCount} students</li>
      </ul>

      <div className="flex gap-3 justify-end">
        <button onClick={() => setDeleteTargetId(null)} disabled={isDeleting}
          className="px-6 py-3 rounded-full text-slate-500 font-bold hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button onClick={handleConfirmDelete} disabled={isDeleting}
          className="px-6 py-3 rounded-full bg-red-600 text-white font-extrabold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50">
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Forever
        </button>
      </div>
    </div>
  </div>
)}
```

`countResources` is a small local helper (resource counts come from `savedLessons`, since resources are per-unit, not top-level on `Classroom`):

```tsx
function countResources(cls: Classroom, key: 'worksheets' | 'assignments' | 'tests'): number {
  return Object.values(cls.savedLessons ?? {}).reduce((sum, lesson) => sum + (lesson[key]?.length ?? 0), 0);
}
```

### 6.2 `Dashboard.tsx` — `handleDeleteClass` already correct

`Dashboard.tsx:151-154` already implements the DELETE call and local state cleanup:

```tsx
const handleDeleteClass = async (classroomId: string) => {
  setClasses(prev => prev.filter(c => c.id !== classroomId));
  await fetch(`/api/classrooms/${classroomId}`, { method: 'DELETE' });
};
```

One addition: if the deleted class is the currently active one, reset navigation back to the class list so the app doesn't strand the teacher on a dashboard for a class that no longer exists:

```tsx
const handleDeleteClass = async (classroomId: string) => {
  setClasses(prev => prev.filter(c => c.id !== classroomId));
  if (activeClassId === classroomId) {
    setActiveClassId(null);
    setAppState(AppState.CLASS_LIST);
  }
  await fetch(`/api/classrooms/${classroomId}`, { method: 'DELETE' });
};
```

---

## 7. Error Handling Summary

| Scenario | Behaviour |
|---|---|
| PATCH fails (network/server error) | `handleUpdateClass` returns `null`; `ClassManager` leaves the modal open with `isCreating` reset so the teacher can retry. No silent data loss — local state is not optimistically updated until the server confirms. |
| DELETE fails after optimistic removal | Class disappears from the UI immediately (per existing `handleDeleteClass` behavior); a failed DELETE leaves an orphaned row server-side. Acceptable for this iteration — matches the existing behavior already shipped for delete, not a regression. |
| Class edited but has no saved lessons yet | `beforeHash !== afterHash` check is skipped (`Object.keys(savedLessons).length > 0` guard) — no pointless regenerate prompt for a class with nothing to go stale. |
| Class edited but blueprint never generated | Same guard (`full.blueprint` check) — nothing to regenerate. |
| Teacher edits back to original values | Hash naturally matches again; no outdated flags appear. |

---

## 8. Files Changed

| File | Change |
|---|---|
| `src/lib/classHash.ts` | New file — `computeSettingsHash()` |
| `src/lib/types.ts` | Add `settingsHash?: string` to `LessonContent` |
| `src/app/api/classrooms/[id]/route.ts` | Add `learningStyles`, `accommodations`, `studentInterests` to PATCH `allowedFields` |
| `src/components/ClassManager.tsx` | `editingClass`/`onUpdateClass`/`onCloseEdit` props; edit pre-fill effect; card hover action row (edit/analytics/delete icons); delete confirmation modal; `countResources` helper |
| `src/components/Dashboard.tsx` | `editingClass` state, `handleEditClass`, `handleUpdateClass` (with hash-diff regenerate prompt), `handleDeleteClass` navigation-safety fix |
| `src/components/LessonWorkspace.tsx` | Stamp `settingsHash` on every save; compute `isUnitOutdated`; `NavButton` gains `isOutdated` prop and amber badge rendering |
| `src/components/CurriculumDashboard.tsx` | "Edit Class" button in header, wired to `onEditClass` |

---

## 9. Constraints & Decisions

- **Settings hash over timestamp or DB flag** — a plain field-diff hash needs no migration, doesn't false-positive on cosmetic renames (class name isn't in the hash), and self-heals when content is regenerated.
- **Hash lives per-unit inside `savedLessons`, not per-classroom** — different units can be regenerated independently over time, so staleness must be tracked at the same granularity as the content itself.
- **No forced regeneration** — teachers keep full control; the prompt is advisory with a clear token-cost warning, and declining leaves everything intact except the badge.
- **Badge only shows on sections that have content** — avoids a confusing "Outdated" label on a tab the teacher hasn't touched yet.
- **Delete confirmation shows real counts, not just a generic warning** — teachers manage their own real classes; an impact list makes an irreversible action feel deliberate rather than risky.
