'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import ClassManager from '@/components/ClassManager';
import CurriculumDashboard from '@/components/CurriculumDashboard';
import LessonWorkspace from '@/components/LessonWorkspace';
import { Blueprint, WeekUnit, AppState, Classroom, LessonContent } from '@/lib/types';
import { computeSettingsHash } from '@/lib/classHash';
import { Sparkles, Users, LayoutDashboard, Loader2, Menu, Zap, Crown, LucideIcon } from 'lucide-react';

interface DbUser {
  plan: string;
  generationsLeft: number;
  imagesLeft: number;
  name: string | null;
}

const Dashboard = () => {
  const { user: clerkUser } = useUser();
  const [appState, setAppState] = useState<AppState>(AppState.CLASS_LIST);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<WeekUnit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [editingClass, setEditingClass] = useState<Classroom | null>(null);

  const activeClass = classes.find(c => c.id === activeClassId);

  // ─── Load classrooms + user profile from DB on mount ─────────────────────
  useEffect(() => {
    if (!clerkUser) return;
    const load = async () => {
      setIsDbLoading(true);
      try {
        const [classRes, userRes] = await Promise.all([
          fetch('/api/classrooms'),
          fetch('/api/user/me'),
        ]);
        if (classRes.ok) {
          const { classrooms } = await classRes.json();
          // Prisma returns JSON fields as plain objects — cast them back
          setClasses(classrooms.map((c: Classroom) => ({
            ...c,
            blueprint: c.blueprint ?? undefined,
            students: c.students ?? [],
            assessmentColumns: c.assessmentColumns ?? [],
            savedLessons: c.savedLessons ?? {},
            analysis: c.analysis ?? undefined,
          })));
        }
        if (userRes.ok) {
          const { user } = await userRes.json();
          setDbUser(user);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setIsDbLoading(false);
      }
    };
    load();
  }, [clerkUser?.id]);

  const refreshUser = useCallback(async () => {
    try {
      const userRes = await fetch('/api/user/me');
      if (userRes.ok) {
        const { user } = await userRes.json();
        setDbUser(user);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, []);

  // ─── Persist a classroom update to the DB ────────────────────────────────
  const persistClassroom = useCallback(async (classroomId: string, patch: Partial<Classroom>) => {
    try {
      await fetch(`/api/classrooms/${classroomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      console.error('Failed to persist classroom:', err);
    }
  }, []);

  const handleOpenClass = async (classroom: Classroom) => {
    setActiveClassId(classroom.id);
    if (!classroom.blueprint) {
      setIsLoading(true);
      try {
        const res = await fetch('/api/generate/blueprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classroom }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.code === 'LIMIT_REACHED') {
            if (window.confirm('You have reached your daily limit of 10 free generations.\n\nWould you like to upgrade to Pro for unlimited access?')) window.location.href = '/pricing';
          } else {
            alert(data.error || 'Failed to generate curriculum.');
          }
          setActiveClassId(null);
          return;
        }
        const updated = { ...classroom, blueprint: data.blueprint };
        setClasses(prev => prev.map(c => c.id === classroom.id ? updated : c));
        await persistClassroom(classroom.id, { blueprint: data.blueprint });
        // Refresh credits
        const userRes = await fetch('/api/user/me');
        if (userRes.ok) { const { user } = await userRes.json(); setDbUser(user); }
        setAppState(AppState.DASHBOARD);
      } catch (err) {
        console.error('Blueprint failed', err);
        alert('Could not generate. Please check your connection.');
        setActiveClassId(null);
      } finally {
        setIsLoading(false);
      }
    } else {
      setAppState(AppState.DASHBOARD);
    }
  };

  const handleCreateClass = async (classroom: Omit<Classroom, 'id'>) => {
    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classroom),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create classroom');
      }
      const { classroom: created } = await res.json();
      const full: Classroom = { ...created, blueprint: undefined, students: [], assessmentColumns: [], savedLessons: {} };
      setClasses(prev => [full, ...prev]);
      return full;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

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

  const handleDeleteClass = async (classroomId: string) => {
    setClasses(prev => prev.filter(c => c.id !== classroomId));
    if (activeClassId === classroomId) {
      setActiveClassId(null);
      setAppState(AppState.CLASS_LIST);
    }
    await fetch(`/api/classrooms/${classroomId}`, { method: 'DELETE' });
  };

  const handleUpdateBlueprint = async (updatedBlueprint: Blueprint) => {
    if (!activeClassId) return;
    setClasses(prev => prev.map(c => c.id === activeClassId ? { ...c, blueprint: updatedBlueprint } : c));
    await persistClassroom(activeClassId, { blueprint: updatedBlueprint });
  };

  const handleSaveClassLesson = async (classId: string, unitKey: string, content: LessonContent) => {
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      const savedLessons = { ...(c.savedLessons || {}), [unitKey]: content };
      return { ...c, savedLessons };
    }));
    const cls = classes.find(c => c.id === classId);
    if (cls) {
      const savedLessons = { ...(cls.savedLessons || {}), [unitKey]: content };
      await persistClassroom(classId, { savedLessons });
    }
  };

  const handleOpenWorkspace = (units: WeekUnit[]) => { setSelectedUnits(units); setAppState(AppState.LESSON_VIEW); };
  const handleBackToDashboard = () => { setAppState(AppState.DASHBOARD); setSelectedUnits([]); };
  const handleBackToClasses = () => { setAppState(AppState.CLASS_LIST); setActiveClassId(null); setSelectedUnits([]); };

  if (isDbLoading) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 mx-auto animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="text-slate-400 text-sm">Loading your workspace...</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-white z-0" />
        <div className="z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-blue-200 animate-bounce">
            <Sparkles className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-3">Designing Curriculum</h2>
          <p className="text-slate-500 mb-8 text-lg">Building your personalised teaching plan...</p>
          <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-md border border-slate-100">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-slate-600">AI is at work...</span>
          </div>
        </div>
      </div>
    );
  }

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
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'} bg-slate-900 text-slate-300 flex flex-col transition-transform md:transition-all duration-300 ease-in-out shadow-2xl flex-none ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="h-16 flex items-center px-5 border-b border-slate-800">
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center w-full' : ''}`}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            {!isSidebarCollapsed && <span className="font-bold text-white text-lg tracking-tight">CurricuGen</span>}
          </div>
        </div>

        <div className="flex-1 py-6 px-3 space-y-2">
          <NavItem icon={Users} label="My Classes" isActive={appState === AppState.CLASS_LIST} onClick={() => { handleBackToClasses(); setIsMobileNavOpen(false); }} collapsed={isSidebarCollapsed} />
          {activeClass && (
            <>
              <div className="my-4 border-t border-slate-800 mx-3" />
              {!isSidebarCollapsed && <div className="px-3 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Active Class</div>}
              {!isSidebarCollapsed && (
                <div className="px-3 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 mb-2">
                  <div className="text-sm font-bold text-white mb-1 truncate">{activeClass.name}</div>
                  <div className="text-xs text-slate-400">{activeClass.grade} • {activeClass.subject}</div>
                </div>
              )}
              <NavItem icon={LayoutDashboard} label="Curriculum" isActive={appState === AppState.DASHBOARD || appState === AppState.LESSON_VIEW} onClick={() => { setAppState(AppState.DASHBOARD); setIsMobileNavOpen(false); }} collapsed={isSidebarCollapsed} />
            </>
          )}
        </div>

        {/* Credits + User */}
        <div className="border-t border-slate-800 p-4 space-y-3">
          {!isSidebarCollapsed && dbUser && (
            <div className={`px-3 py-2.5 rounded-xl text-xs font-medium ${dbUser.plan === 'PRO' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : dbUser.plan === 'BETA' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>
              {dbUser.plan === 'PRO' || dbUser.plan === 'BETA' ? (
                <div className="flex items-center gap-2">
                  <Crown className={`w-3.5 h-3.5 ${dbUser.plan === 'PRO' ? 'text-amber-400' : 'text-blue-400'}`} /> 
                  {dbUser.plan === 'PRO' ? 'Pro Plan' : 'Beta Tester'} — Unlimited
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> {dbUser.generationsLeft} generations left today</span>
                  <a href="/pricing" className="text-blue-400 hover:text-blue-300 font-bold">Upgrade</a>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <UserButton />
            {!isSidebarCollapsed && <span className="text-sm text-slate-400 truncate">{clerkUser?.firstName || 'Teacher'}</span>}
          </div>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile nav backdrop */}
      {isMobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 pt-14 md:pt-0">
        <div className="flex-1 overflow-hidden relative">
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
          {appState === AppState.LESSON_VIEW && activeClass && selectedUnits.length > 0 && (
            <LessonWorkspace
              units={selectedUnits}
              activeClass={activeClass}
              onBack={handleBackToDashboard}
              onSaveClassContent={handleSaveClassLesson}
              onContentGenerated={refreshUser}
              imagesLeft={dbUser?.imagesLeft ?? 0}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  collapsed: boolean;
}

const NavItem = ({ icon: Icon, label, isActive, onClick, collapsed }: NavItemProps) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'} ${collapsed ? 'justify-center' : ''}`} title={collapsed ? label : undefined}>
    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
    {!collapsed && <span className="font-medium text-sm">{label}</span>}
  </button>
);

export default Dashboard;
