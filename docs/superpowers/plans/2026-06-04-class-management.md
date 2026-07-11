# Class Management (Edit / Delete / Outdated Content) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers edit and delete existing classrooms, and see when previously generated lesson content no longer matches the class's current settings.

**Architecture:** Reuse the existing 2-step class creation wizard in `ClassManager.tsx` for editing (pre-filled via a new `editingClass` prop). Add a settings-hash helper (`src/lib/classHash.ts`) stamped into each unit's saved content; compare it against the live classroom on render to flag stale sections with an amber badge. Delete gets a real confirmation modal with an impact summary, wired to the `DELETE` endpoint that already exists.

**Tech Stack:** Next.js 16.2 App Router, React 19, Prisma, PostgreSQL, TypeScript, Tailwind CSS, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-06-04-class-management-design.md`

---

### Task 1: Settings hash helper

**Files:**
- Create: `src/lib/classHash.ts`
- Test: `src/lib/classHash.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/classHash.test.ts
import { describe, it, expect } from 'vitest';
import { computeSettingsHash } from './classHash';

const base = {
  subject: 'Mathematics',
  grade: 'Grade 5',
  curriculum: 'CAPS',
  studentCount: 30,
  averagePercentile: 65,
  learningStyles: ['Visual', 'Kinesthetic'],
  accommodations: 'Extra time',
  studentInterests: 'Minecraft',
  teachingNotes: 'Struggles with fractions',
};

describe('computeSettingsHash', () => {
  it('produces the same hash for identical settings', () => {
    expect(computeSettingsHash(base)).toBe(computeSettingsHash({ ...base }));
  });

  it('produces a different hash when subject changes', () => {
    expect(computeSettingsHash(base)).not.toBe(computeSettingsHash({ ...base, subject: 'Science' }));
  });

  it('is order-independent for learningStyles', () => {
    const reordered = { ...base, learningStyles: ['Kinesthetic', 'Visual'] };
    expect(computeSettingsHash(base)).toBe(computeSettingsHash(reordered));
  });

  it('treats missing optional fields as empty string / empty array', () => {
    const minimal = {
      subject: 'Mathematics', grade: 'Grade 5', curriculum: 'CAPS',
      studentCount: 30, averagePercentile: 65, teachingNotes: '',
    };
    expect(() => computeSettingsHash(minimal)).not.toThrow();
  });
});
```

Check if this repo has a test runner configured before assuming `vitest`:

Run: `cat package.json | grep -A3 '"scripts"'`

If no test runner is present, skip Steps 1-2 (the failing-test step) and go straight to Step 3, then manually verify with a throwaway `node -e` script instead of an automated test. Do not add a new test framework just for this helper — match what the project already does (this repo currently has none configured for unit tests, only Playwright scripts in `debug-scripts/`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "require('./src/lib/classHash.ts')"` will fail because the file doesn't exist yet — confirms the target state. (Skip if no test runner, per Step 1 note.)

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/classHash.ts
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

- [ ] **Step 4: Verify manually**

Run:
```bash
node -e "
const { computeSettingsHash } = require('./src/lib/classHash.ts');
" 2>&1 || echo "expected: ts-node not configured, that's fine — verify via 'npx tsc --noEmit' instead"
npx tsc --noEmit
```
Expected: no type errors referencing `classHash.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/classHash.ts src/lib/classHash.test.ts
git commit -m "feat(class-hash): add computeSettingsHash for outdated-content detection"
```

---

### Task 2: `settingsHash` field on `LessonContent`

**Files:**
- Modify: `src/lib/types.ts:31-39`

- [ ] **Step 1: Add the field**

Current (`src/lib/types.ts`):
```ts
export interface LessonContent {
  plan: string;
  slides: string;
  worksheets: EducationalResource[];
  assignments: EducationalResource[];
  tests: EducationalResource[];
  imageUrl?: string;
  slideImages?: { slideNumber: number; imageUrl: string }[];
}
```

New:
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

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors (field is optional, so no existing call sites break).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add settingsHash to LessonContent"
```

---

### Task 3: Allow edit-only fields through PATCH

**Files:**
- Modify: `src/app/api/classrooms/[id]/route.ts:33-37`

- [ ] **Step 1: Update `allowedFields`**

Current:
```ts
  const allowedFields: string[] = [
    'name', 'subject', 'grade', 'curriculum', 'studentCount',
    'averagePercentile', 'teachingNotes', 'blueprint',
    'students', 'assessmentColumns', 'savedLessons', 'analysis',
  ];
```

New:
```ts
  const allowedFields: string[] = [
    'name', 'subject', 'grade', 'curriculum', 'studentCount',
    'averagePercentile', 'teachingNotes', 'blueprint',
    'learningStyles', 'accommodations', 'studentInterests',
    'students', 'assessmentColumns', 'savedLessons', 'analysis',
  ];
```

- [ ] **Step 2: Verify manually**

Run the dev server and PATCH a classroom directly to confirm the fields persist:

```bash
npm run dev
```

In another terminal (replace `<id>` and cookie with a real signed-in session, or just do this via the browser DevTools console on `/dashboard` — `fetch` calls carry the session cookie automatically):

```js
fetch('/api/classrooms/<id>', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ accommodations: 'test value' }),
}).then(r => r.json()).then(console.log)
```

Expected: response `classroom.accommodations === 'test value'`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/classrooms/[id]/route.ts
git commit -m "fix(api): allow learningStyles/accommodations/studentInterests through classroom PATCH"
```

---

### Task 4: `ClassManager.tsx` — edit mode (props, pre-fill, submit branching)

**Files:**
- Modify: `src/components/ClassManager.tsx`

- [ ] **Step 1: Extend props and imports**

At the top of `src/components/ClassManager.tsx`, change:

```tsx
import { Users, Plus, ArrowRight, X, BarChart2, Download, Upload, AlertTriangle, TrendingUp, Sparkles, PieChart, Loader2, BrainCircuit, Heart, Fingerprint, BookOpen, HelpCircle } from 'lucide-react';

interface ClassManagerProps {
  classes: Classroom[];
  setClasses: React.Dispatch<React.SetStateAction<Classroom[]>>;
  onOpenClass: (classroom: Classroom) => void;
  onCreateClass?: (classroom: Omit<Classroom, 'id'>) => Promise<Classroom | null>;
  onDeleteClass?: (classroomId: string) => Promise<void>;
}
```

to:

```tsx
import { Users, Plus, ArrowRight, X, BarChart2, Download, Upload, AlertTriangle, TrendingUp, Sparkles, PieChart, Loader2, BrainCircuit, Heart, Fingerprint, BookOpen, HelpCircle, Pencil, Trash2 } from 'lucide-react';

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

- [ ] **Step 2: Destructure new props and add pre-fill effect**

Change the component signature:

```tsx
const ClassManager: React.FC<ClassManagerProps> = ({ classes, setClasses, onOpenClass, onCreateClass, onDeleteClass }) => {
```

to:

```tsx
const ClassManager: React.FC<ClassManagerProps> = ({ classes, setClasses, onOpenClass, onCreateClass, onUpdateClass, onDeleteClass, editingClass, onCloseEdit }) => {
```

Add `useEffect` to the imports (`src/components/ClassManager.tsx:3`):

```tsx
import React, { useState, useRef, useEffect } from 'react';
```

After the existing state declarations (right after the `toggleLearningStyle` function, before `handleCreateClass`), add:

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

- [ ] **Step 3: Branch `handleCreateClass` for edit vs create**

Current:
```tsx
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wizardStep === 1) {
      if (name && subject && grade) {
        setWizardStep(2);
        setStepChangeTime(Date.now());
      }
      return;
    }
    
    // Prevent accidental double-clicks or Enter key repeats from immediately submitting
    if (Date.now() - stepChangeTime < 500) {
      return;
    }

    setIsCreating(true);
    const classData = {
      name, subject, grade, curriculum, studentCount,
      averagePercentile: percentile,
      teachingNotes: notes,
      learningStyles, accommodations, studentInterests,
      students: [],
      assessmentColumns: [],
    };
    try {
      if (onCreateClass) {
        const created = await onCreateClass(classData);
        if (created) { setIsModalOpen(false); resetForm(); onOpenClass(created); }
      } else {
        // Fallback for local use
        const newClass: Classroom = { id: Date.now().toString(), ...classData };
        setClasses(prev => [...prev, newClass]);
        setIsModalOpen(false); resetForm(); onOpenClass(newClass);
      }
    } finally {
      setIsCreating(false);
    }
  };
```

New:
```tsx
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wizardStep === 1) {
      if (name && subject && grade) {
        setWizardStep(2);
        setStepChangeTime(Date.now());
      }
      return;
    }
    
    // Prevent accidental double-clicks or Enter key repeats from immediately submitting
    if (Date.now() - stepChangeTime < 500) {
      return;
    }

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
      } else {
        // Fallback for local use
        const newClass: Classroom = { id: Date.now().toString(), ...classData, students: [], assessmentColumns: [] };
        setClasses(prev => [...prev, newClass]);
        setIsModalOpen(false); resetForm(); onOpenClass(newClass);
      }
    } finally {
      setIsCreating(false);
    }
  };
```

- [ ] **Step 4: Clear `editingClass` on modal close**

Every place that sets `setIsModalOpen(false)` for a manual close (not the successful-submit paths already handled in Step 3) must also call `onCloseEdit?.()`. There are two: the header X button and the "Cancel" button in step 1.

Current header close button:
```tsx
            <button title="Close Modal" onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
```
New:
```tsx
            <button title="Close Modal" onClick={() => { setIsModalOpen(false); onCloseEdit?.(); }} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
```

Current Cancel button (step 1 footer):
```tsx
                       <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 rounded-full text-slate-500 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
```
New:
```tsx
                       <button type="button" onClick={() => { setIsModalOpen(false); onCloseEdit?.(); }} className="px-8 py-4 rounded-full text-slate-500 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
```

- [ ] **Step 5: Update modal title and submit button text for edit mode**

Current:
```tsx
              <div>
                 <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">New Class Profile</h2>
                 <p className="text-slate-500 text-sm font-medium">Step {wizardStep} of 2</p>
              </div>
```
New:
```tsx
              <div>
                 <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{editingClass ? 'Edit Class Profile' : 'New Class Profile'}</h2>
                 <p className="text-slate-500 text-sm font-medium">Step {wizardStep} of 2</p>
              </div>
```

Current submit button (step 2 footer):
```tsx
                       <button type="submit" disabled={isCreating} className="px-10 py-4 rounded-full bg-slate-900 text-white font-extrabold shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
                          {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Create Workspace <ArrowRight className="w-5 h-5" />
                       </button>
```
New:
```tsx
                       <button type="submit" disabled={isCreating} className="px-10 py-4 rounded-full bg-slate-900 text-white font-extrabold shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
                          {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} {editingClass ? 'Save Changes' : 'Create Workspace'} <ArrowRight className="w-5 h-5" />
                       </button>
```

- [ ] **Step 6: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `ClassManager.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/components/ClassManager.tsx
git commit -m "feat(class-manager): support editing an existing class via the creation wizard"
```

---

### Task 5: Card hover action row (edit / analytics / delete triggers)

**Files:**
- Modify: `src/components/ClassManager.tsx`

- [ ] **Step 1: Add delete-modal state**

Near the top of the component, alongside existing state (after `const [isCreating, setIsCreating] = useState(false);` block, near `wizardStep`):

```tsx
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteTarget = classes.find(c => c.id === deleteTargetId);
```

- [ ] **Step 2: Replace the single analytics button with a 3-icon action row**

Current (`src/components/ClassManager.tsx`, inside the card map):
```tsx
                  <div className="flex justify-between items-start mb-6">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 uppercase tracking-widest">
                       {cls.grade}
                    </span>
                    <button 
                       onClick={(e) => { e.stopPropagation(); setActiveAnalysisClassId(cls.id); }} 
                       className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 hover:shadow-md hover:shadow-blue-500/30 transition-all duration-300"
                    >
                       <BarChart2 className="w-5 h-5" />
                    </button>
                  </div>
```

New:
```tsx
                  <div className="flex justify-between items-start mb-6">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 uppercase tracking-widest">
                       {cls.grade}
                    </span>
                    <div className="flex items-center gap-1">
                       <button
                          title="Edit Class"
                          onClick={(e) => { e.stopPropagation(); onOpenEditClass(cls); }}
                          className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all duration-300"
                       >
                          <Pencil className="w-4 h-4" />
                       </button>
                       <button
                          title="Class Analytics"
                          onClick={(e) => { e.stopPropagation(); setActiveAnalysisClassId(cls.id); }}
                          className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 transition-all duration-300"
                       >
                          <BarChart2 className="w-4 h-4" />
                       </button>
                       <button
                          title="Delete Class"
                          onClick={(e) => { e.stopPropagation(); setDeleteTargetId(cls.id); }}
                          className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-all duration-300"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
```

This calls `onOpenEditClass(cls)` — a small local wrapper that sets a *local* modal open request. Since `editingClass` is owned by `Dashboard.tsx` (Task 6), define this wrapper as a prop instead. Add to `ClassManagerProps` (already has `editingClass`/`onCloseEdit` from Task 4) one more:

```tsx
  onOpenEditClass?: (classroom: Classroom) => void;
```

and destructure it in the component signature (append to the existing destructure from Task 4, Step 2):

```tsx
const ClassManager: React.FC<ClassManagerProps> = ({ classes, setClasses, onOpenClass, onCreateClass, onUpdateClass, onDeleteClass, editingClass, onCloseEdit, onOpenEditClass }) => {
```

Update the card button to call it safely:
```tsx
                       <button
                          title="Edit Class"
                          onClick={(e) => { e.stopPropagation(); onOpenEditClass?.(cls); }}
                          className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all duration-300"
                       >
                          <Pencil className="w-4 h-4" />
                       </button>
```

- [ ] **Step 3: Add the delete confirmation modal + `countResources` helper**

Add this helper function below the `ClassManager` component definition (after the closing `};` of the component, before `export default ClassManager;`):

```tsx
function countResources(cls: Classroom, key: 'worksheets' | 'assignments' | 'tests'): number {
  return Object.values(cls.savedLessons ?? {}).reduce((sum, lesson) => sum + (lesson[key]?.length ?? 0), 0);
}
```

Add the confirm-delete handler inside the component, near `handleUploadMarks`:

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

Add the modal JSX right after the "ANALYTICS SLIDE-OVER" block closes (after its closing `)}` before the final closing `</div>` of the component's top-level return — i.e. as a sibling to the `{activeAnalysisClass && (...)}` block):

```tsx
      {/* DELETE CONFIRMATION MODAL */}
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
                className="px-6 py-3 rounded-full text-slate-500 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50">
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

- [ ] **Step 4: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ClassManager.tsx
git commit -m "feat(class-manager): add edit/delete triggers with detailed delete confirmation"
```

---

### Task 6: `Dashboard.tsx` — wire edit/update/delete handlers

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Import `computeSettingsHash` and add `editingClass` state**

Current imports (`src/components/Dashboard.tsx:1-9`):
```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import ClassManager from '@/components/ClassManager';
import CurriculumDashboard from '@/components/CurriculumDashboard';
import LessonWorkspace from '@/components/LessonWorkspace';
import { Blueprint, WeekUnit, AppState, Classroom } from '@/lib/types';
import { Sparkles, Users, LayoutDashboard, Loader2, Menu, Zap, Crown } from 'lucide-react';
```

New:
```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import ClassManager from '@/components/ClassManager';
import CurriculumDashboard from '@/components/CurriculumDashboard';
import LessonWorkspace from '@/components/LessonWorkspace';
import { Blueprint, WeekUnit, AppState, Classroom } from '@/lib/types';
import { computeSettingsHash } from '@/lib/classHash';
import { Sparkles, Users, LayoutDashboard, Loader2, Menu, Zap, Crown } from 'lucide-react';
```

Add state near `const [dbUser, setDbUser] = useState<DbUser | null>(null);` (`src/components/Dashboard.tsx:27`):

```tsx
  const [editingClass, setEditingClass] = useState<Classroom | null>(null);
```

- [ ] **Step 2: Add `handleUpdateClass` and `promptRegenerateOrKeep`**

Add after `handleCreateClass` (`src/components/Dashboard.tsx:130-149`):

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
  };

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

`handleOpenClass` is defined above this point in the file already (`src/components/Dashboard.tsx:91`), so it's in scope.

- [ ] **Step 3: Fix `handleDeleteClass` to reset navigation if the active class is deleted**

Current (`src/components/Dashboard.tsx:151-154`):
```tsx
  const handleDeleteClass = async (classroomId: string) => {
    setClasses(prev => prev.filter(c => c.id !== classroomId));
    await fetch(`/api/classrooms/${classroomId}`, { method: 'DELETE' });
  };
```

New:
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

- [ ] **Step 4: Pass new props to `ClassManager`**

Current (`src/components/Dashboard.tsx:271-279`):
```tsx
          {appState === AppState.CLASS_LIST && (
            <ClassManager
              classes={classes}
              setClasses={setClasses}
              onOpenClass={handleOpenClass}
              onCreateClass={handleCreateClass}
              onDeleteClass={handleDeleteClass}
            />
          )}
```

New:
```tsx
          {appState === AppState.CLASS_LIST && (
            <ClassManager
              classes={classes}
              setClasses={setClasses}
              onOpenClass={handleOpenClass}
              onCreateClass={handleCreateClass}
              onUpdateClass={handleUpdateClass}
              onDeleteClass={handleDeleteClass}
              editingClass={editingClass}
              onOpenEditClass={setEditingClass}
              onCloseEdit={() => setEditingClass(null)}
            />
          )}
```

- [ ] **Step 5: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat(dashboard): wire class edit/update handlers with regenerate-or-keep prompt"
```

---

### Task 7: `LessonWorkspace.tsx` — stamp and compare settings hash, badge NavButton

**Files:**
- Modify: `src/components/LessonWorkspace.tsx`

- [ ] **Step 1: Import `computeSettingsHash`**

Current (`src/components/LessonWorkspace.tsx:9-11`):
```tsx
import { WeekUnit, UploadedFile, ChatMessage, EducationalResource, TemplateConfig, Classroom } from '@/lib/types';
import { generateLessonPlan, generatePresentation, generateWorksheet, generateAssignment, generateAssessment, generateMemo, generateGame, generateResources, refineContent, generateEducationalImage } from '@/lib/gemini';
import { ArrowLeft, FileText, MonitorPlay, Check, Printer, Sparkles, Upload, Paperclip, X, MessageSquare, Send, Bot, HelpCircle, Gamepad2, Library, Plus, Trash2, FileCheck, ClipboardList, BookOpen, Settings, Image as ImageIcon, LayoutTemplate, PenTool, GripVertical, Download, ChevronDown } from 'lucide-react';
```

New:
```tsx
import { WeekUnit, UploadedFile, ChatMessage, EducationalResource, TemplateConfig, Classroom } from '@/lib/types';
import { computeSettingsHash } from '@/lib/classHash';
import { generateLessonPlan, generatePresentation, generateWorksheet, generateAssignment, generateAssessment, generateMemo, generateGame, generateResources, refineContent, generateEducationalImage } from '@/lib/gemini';
import { ArrowLeft, FileText, MonitorPlay, Check, Printer, Sparkles, Upload, Paperclip, X, MessageSquare, Send, Bot, HelpCircle, Gamepad2, Library, Plus, Trash2, FileCheck, ClipboardList, BookOpen, Settings, Image as ImageIcon, LayoutTemplate, PenTool, GripVertical, Download, ChevronDown, AlertTriangle } from 'lucide-react';
```

(`AlertTriangle` is added — it is not currently imported in this file, unlike the spec draft assumed. Verify with `grep -n "AlertTriangle" src/components/LessonWorkspace.tsx` before assuming; if it's already there, don't duplicate the import.)

- [ ] **Step 2: Stamp `settingsHash` into every save**

Current (`src/components/LessonWorkspace.tsx:85-95`):
```tsx
  useEffect(() => {
    onSaveClassContent(activeClass.id, unitKey, {
      plan: lessonPlan || '',
      slides: slides || '',
      worksheets,
      assignments,
      tests,
      imageUrl: generatedImageUrl || '',
      slideImages,
    });
  }, [lessonPlan, slides, worksheets, assignments, tests, generatedImageUrl, slideImages]);
```

New:
```tsx
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

- [ ] **Step 3: Compute `isUnitOutdated`**

Add right after the `unitKey` declaration (`src/components/LessonWorkspace.tsx:27`):

```tsx
  const isRevisionMode = units.length > 1;
  const unitKey = isRevisionMode ? `revision-${units.map(u => u.weekNumber).join('-')}` : `${units[0].weekNumber}-${units[0].topicTitle}`;
  const savedHash = activeClass.savedLessons?.[unitKey]?.settingsHash;
  const isUnitOutdated = !!savedHash && savedHash !== computeSettingsHash(activeClass);
```

- [ ] **Step 4: Add `isOutdated` to `NavButton` and pass it at each call site**

Current `NavButton` (`src/components/LessonWorkspace.tsx:921-927`):
```tsx
const NavButton = ({ icon: Icon, label, active, onClick, collapsed, hasContent }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${active ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
    <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
    {!collapsed && <span className={`flex-1 text-left text-sm font-medium ${active ? 'font-bold' : ''}`}>{label}</span>}
    {!collapsed && hasContent && <Check className="w-3 h-3 text-green-500" />}
  </button>
);
```

New:
```tsx
const NavButton = ({ icon: Icon, label, active, onClick, collapsed, hasContent, isOutdated }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${active ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
    <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
    {!collapsed && <span className={`flex-1 text-left text-sm font-medium ${active ? 'font-bold' : ''}`}>{label}</span>}
    {!collapsed && isOutdated && (
      <span className="bg-amber-100 text-amber-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1">
        <AlertTriangle className="w-2.5 h-2.5" /> Outdated
      </span>
    )}
    {!collapsed && !isOutdated && hasContent && <Check className="w-3 h-3 text-green-500" />}
  </button>
);
```

Current call sites (`src/components/LessonWorkspace.tsx:397-398, 420-422`):
```tsx
              <NavButton icon={BookOpen} label="Lesson Plan" active={activeSection === 'plan'} onClick={() => setActiveSection('plan')} collapsed={isSidebarCollapsed} hasContent={!!lessonPlan} />
              <NavButton icon={MonitorPlay} label="Slides" active={activeSection === 'slides'} onClick={() => setActiveSection('slides')} collapsed={isSidebarCollapsed} hasContent={!!slides} />
```
```tsx
              <NavButton icon={ImageIcon} label="Visual Aids" active={activeSection === 'visuals'} onClick={() => setActiveSection('visuals')} collapsed={isSidebarCollapsed} hasContent={!!generatedImageUrl} />
              <NavButton icon={Gamepad2} label="Activity" active={activeSection === 'game'} onClick={() => setActiveSection('game')} collapsed={isSidebarCollapsed} hasContent={!!game} />
              <NavButton icon={Library} label="Links" active={activeSection === 'resources'} onClick={() => setActiveSection('resources')} collapsed={isSidebarCollapsed} hasContent={!!resources} />
```

New:
```tsx
              <NavButton icon={BookOpen} label="Lesson Plan" active={activeSection === 'plan'} onClick={() => setActiveSection('plan')} collapsed={isSidebarCollapsed} hasContent={!!lessonPlan} isOutdated={isUnitOutdated && !!lessonPlan} />
              <NavButton icon={MonitorPlay} label="Slides" active={activeSection === 'slides'} onClick={() => setActiveSection('slides')} collapsed={isSidebarCollapsed} hasContent={!!slides} isOutdated={isUnitOutdated && !!slides} />
```
```tsx
              <NavButton icon={ImageIcon} label="Visual Aids" active={activeSection === 'visuals'} onClick={() => setActiveSection('visuals')} collapsed={isSidebarCollapsed} hasContent={!!generatedImageUrl} isOutdated={isUnitOutdated && !!generatedImageUrl} />
              <NavButton icon={Gamepad2} label="Activity" active={activeSection === 'game'} onClick={() => setActiveSection('game')} collapsed={isSidebarCollapsed} hasContent={!!game} isOutdated={isUnitOutdated && !!game} />
              <NavButton icon={Library} label="Links" active={activeSection === 'resources'} onClick={() => setActiveSection('resources')} collapsed={isSidebarCollapsed} hasContent={!!resources} isOutdated={isUnitOutdated && !!resources} />
```

- [ ] **Step 5: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/LessonWorkspace.tsx
git commit -m "feat(lesson-workspace): flag outdated content sections with amber badge"
```

---

### Task 8: "Edit Class" button in `CurriculumDashboard.tsx` header

**Files:**
- Modify: `src/components/CurriculumDashboard.tsx`
- Modify: `src/components/Dashboard.tsx` (pass the new prop)

- [ ] **Step 1: Add `onEditClass` prop and `Pencil` import**

Current (`src/components/CurriculumDashboard.tsx:1-13`):
```tsx
'use client';

import React, { useState } from 'react';
import { Blueprint, WeekUnit, Classroom } from '@/lib/types';
import { Target, Plus, Trash2, Clock, Edit3, CheckSquare, ArrowRight, LayoutList, Sparkles, Wand2 } from 'lucide-react';

interface CurriculumDashboardProps {
  blueprint: Blueprint;
  activeClass: Classroom;
  onSelectUnits: (units: WeekUnit[]) => void;
  onUpdateBlueprint: (blueprint: Blueprint) => void;
  onReset: () => void;
}

const CurriculumDashboard: React.FC<CurriculumDashboardProps> = ({ blueprint, activeClass, onSelectUnits, onUpdateBlueprint, onReset }) => {
```

New:
```tsx
'use client';

import React, { useState } from 'react';
import { Blueprint, WeekUnit, Classroom } from '@/lib/types';
import { Target, Plus, Trash2, Clock, Edit3, CheckSquare, ArrowRight, LayoutList, Sparkles, Wand2, Pencil } from 'lucide-react';

interface CurriculumDashboardProps {
  blueprint: Blueprint;
  activeClass: Classroom;
  onSelectUnits: (units: WeekUnit[]) => void;
  onUpdateBlueprint: (blueprint: Blueprint) => void;
  onReset: () => void;
  onEditClass: () => void;
}

const CurriculumDashboard: React.FC<CurriculumDashboardProps> = ({ blueprint, activeClass, onSelectUnits, onUpdateBlueprint, onReset, onEditClass }) => {
```

- [ ] **Step 2: Add the button to the header**

Current (`src/components/CurriculumDashboard.tsx:92-104`):
```tsx
        <div className="flex gap-3 flex-shrink-0">
           <button 
             onClick={() => setIsEditing(!isEditing)}
             className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all duration-300 shadow-sm ${
               isEditing 
                 ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-500 hover:-translate-y-0.5' 
                 : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5'
             }`}
           >
             {isEditing ? <CheckSquare className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
             {isEditing ? 'Finish Editing' : 'Edit Blueprint'}
           </button>
        </div>
```

New:
```tsx
        <div className="flex gap-3 flex-shrink-0">
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
             {isEditing ? <CheckSquare className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
             {isEditing ? 'Finish Editing' : 'Edit Blueprint'}
           </button>
        </div>
```

- [ ] **Step 4: Wire it up in `Dashboard.tsx`**

Current (`src/components/Dashboard.tsx:280-288`):
```tsx
          {appState === AppState.DASHBOARD && activeClass && activeClass.blueprint && (
            <CurriculumDashboard
              blueprint={activeClass.blueprint}
              activeClass={activeClass}
              onSelectUnits={handleOpenWorkspace}
              onUpdateBlueprint={handleUpdateBlueprint}
              onReset={handleBackToClasses}
            />
          )}
```
New:
```tsx
          {appState === AppState.DASHBOARD && activeClass && activeClass.blueprint && (
            <CurriculumDashboard
              blueprint={activeClass.blueprint}
              activeClass={activeClass}
              onSelectUnits={handleOpenWorkspace}
              onUpdateBlueprint={handleUpdateBlueprint}
              onReset={handleBackToClasses}
              onEditClass={() => setEditingClass(activeClass)}
            />
          )}
```

- [ ] **Step 5: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/CurriculumDashboard.tsx src/components/Dashboard.tsx
git commit -m "feat(curriculum-dashboard): add edit-class entry point from workspace header"
```

---

### Task 9: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no type errors, all routes listed.

- [ ] **Step 2: Manual walkthrough**

Run: `npm run dev`, open `http://localhost:3000/dashboard` signed in.

1. Create a class, generate a blueprint, generate a lesson plan for one unit.
2. From the class card, click the edit (pencil) icon — confirm the wizard opens pre-filled with the class's current values across both steps.
3. Change the subject and save. Confirm the "regenerate or keep" prompt appears (since a blueprint + saved lesson exist).
4. Click Cancel on that prompt (keep existing). Open the class, navigate to the unit's Lesson Plan tab — confirm the amber "Outdated" badge appears next to "Lesson Plan" in the sidebar, and does NOT appear next to sections with no content (e.g. Activity, if never generated).
5. From the class card, click delete (trash icon) — confirm the modal shows the correct blueprint week count, saved lesson count, and resource counts, then click Delete Forever — confirm the class disappears and (if it was the active class) the app returns to the class list.
6. Repeat step 2-3 but choose "regenerate" — confirm a new blueprint generation kicks off and the flow doesn't crash.

- [ ] **Step 3: Report results**

No commit for this task — it's verification. If any step fails, return to the relevant task above and fix before proceeding to code review.
