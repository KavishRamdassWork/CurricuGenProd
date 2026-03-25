'use client';

import React, { useState } from 'react';
import { Blueprint, WeekUnit, Classroom } from '@/lib/types';
import { Calendar, ChevronRight, Target, Plus, Trash2, Clock, Edit3, CheckSquare, Layers, ArrowRight, LayoutList } from 'lucide-react';

interface CurriculumDashboardProps {
  blueprint: Blueprint;
  activeClass: Classroom;
  onSelectUnits: (units: WeekUnit[]) => void;
  onUpdateBlueprint: (blueprint: Blueprint) => void;
  onReset: () => void;
}

const CurriculumDashboard: React.FC<CurriculumDashboardProps> = ({ blueprint, activeClass, onSelectUnits, onUpdateBlueprint, onReset }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWeekIndices, setSelectedWeekIndices] = useState<number[]>([]);

  const reindexWeeks = (units: WeekUnit[]): WeekUnit[] => units.map((u, idx) => ({ ...u, weekNumber: idx + 1 }));

  const handleUpdateUnit = (index: number, field: keyof WeekUnit, value: string) => {
    const newUnits = [...blueprint.units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    onUpdateBlueprint({ ...blueprint, units: newUnits });
  };

  const handleInsertDelay = (index: number) => {
    const newUnits = [...blueprint.units];
    newUnits.splice(index, 0, { weekNumber: 0, topicTitle: "Catch-up Week", summary: "Buffer time for review and remediation.", learningOutcome: "Consolidation." });
    onUpdateBlueprint({ ...blueprint, units: reindexWeeks(newUnits) });
  };

  const handleAddWeek = () => {
    const newUnits = [...blueprint.units];
    newUnits.push({ weekNumber: newUnits.length + 1, topicTitle: "New Topic", summary: "Content summary...", learningOutcome: "Outcomes..." });
    onUpdateBlueprint({ ...blueprint, units: reindexWeeks(newUnits) });
  };

  const handleDeleteWeek = (index: number) => {
    if (!window.confirm("Remove this week?")) return;
    const newUnits = [...blueprint.units];
    newUnits.splice(index, 1);
    onUpdateBlueprint({ ...blueprint, units: reindexWeeks(newUnits) });
  };

  const toggleSelection = (index: number) => {
    setSelectedWeekIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };

  const handleOpenSelected = () => {
    const units = selectedWeekIndices.sort((a, b) => a - b).map(i => blueprint.units[i]);
    onSelectUnits(units);
    setSelectedWeekIndices([]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shadow-sm z-10 flex-none">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            <span className="text-blue-600">{activeClass.grade}</span><span>•</span><span>{activeClass.subject}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{blueprint.title}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(!isEditing)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${isEditing ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            {isEditing ? <CheckSquare className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {isEditing ? 'Done Editing' : 'Edit Plan'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-5xl mx-auto pb-24">
          <div className="relative">
            <div className="absolute left-6 top-4 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-6">
              {blueprint.units.map((unit, index) => {
                const isSelected = selectedWeekIndices.includes(index);
                return (
                  <div key={`${unit.weekNumber}-${index}`} className="relative pl-20 group">
                    <div onClick={() => toggleSelection(index)} className={`absolute left-0 top-6 w-12 h-12 rounded-xl border-4 flex items-center justify-center font-bold text-sm shadow-sm cursor-pointer transition-all z-10 ${isSelected ? 'bg-blue-600 border-white text-white scale-110 shadow-blue-200' : 'bg-white border-slate-100 text-slate-500 group-hover:border-blue-200 group-hover:text-blue-600'}`}>
                      {isSelected ? <CheckSquare className="w-5 h-5" /> : unit.weekNumber}
                    </div>
                    <div className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
                      {isEditing ? (
                        <div className="p-4 bg-slate-50/50 space-y-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase">Week {unit.weekNumber} Editor</span>
                            <div className="flex gap-1">
                              <button onClick={() => handleInsertDelay(index)} className="p-1.5 hover:bg-amber-100 text-slate-400 hover:text-amber-600 rounded" title="Insert Delay"><Clock className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteWeek(index)} className="p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                          <input value={unit.topicTitle} onChange={(e) => handleUpdateUnit(index, 'topicTitle', e.target.value)} className="w-full font-bold text-slate-800 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none px-1 py-1" />
                          <textarea value={unit.summary} onChange={(e) => handleUpdateUnit(index, 'summary', e.target.value)} className="w-full text-sm text-slate-600 bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none h-20" />
                        </div>
                      ) : (
                        <div onClick={() => !isEditing && toggleSelection(index)} className="p-5 cursor-pointer flex flex-col md:flex-row gap-6 items-start">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">{unit.topicTitle}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">{unit.summary}</p>
                          </div>
                          <div className="flex-none w-full md:w-64 bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-1"><Target className="w-3 h-3" /> Outcome</div>
                            <p className="text-xs text-slate-600 italic line-clamp-3">{unit.learningOutcome}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isEditing && (
                <div className="pl-20 relative">
                  <button onClick={handleAddWeek} className="w-full border-2 border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all gap-2">
                    <Plus className="w-5 h-5" /><span className="font-bold">Append Week</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {selectedWeekIndices.length > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-xs font-bold px-2 py-0.5 rounded-md">{selectedWeekIndices.length}</div>
            <span className="font-medium text-sm">Weeks Selected</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <button onClick={handleOpenSelected} className="flex items-center gap-2 text-sm font-bold text-blue-300 hover:text-white transition-colors">
            Open Workspace <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CurriculumDashboard;
