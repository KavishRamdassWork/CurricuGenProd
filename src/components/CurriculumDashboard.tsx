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
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWeekIndices, setSelectedWeekIndices] = useState<number[]>([]);

  // Re-indexing helper
  const reindexWeeks = (units: WeekUnit[]): WeekUnit[] => units.map((u, idx) => ({ ...u, weekNumber: idx + 1 }));

  // Handlers
  const handleUpdateUnit = (index: number, field: keyof WeekUnit, value: string) => {
    const newUnits = [...blueprint.units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    onUpdateBlueprint({ ...blueprint, units: newUnits });
  };

  const handleInsertDelay = (index: number) => {
    const newUnits = [...blueprint.units];
    const delayUnit: WeekUnit = {
      weekNumber: 0,
      topicTitle: "Consolidation & Review",
      summary: "Dedicated time for students to review material and reinforce foundational concepts.",
      learningOutcome: "Remediation and mastery."
    };
    newUnits.splice(index, 0, delayUnit);
    onUpdateBlueprint({ ...blueprint, units: reindexWeeks(newUnits) });
  };

  const handleAddWeek = () => {
    const newUnits = [...blueprint.units];
    newUnits.push({
      weekNumber: newUnits.length + 1,
      topicTitle: "New Topic",
      summary: "Content summary...",
      learningOutcome: "Outcomes..."
    });
    onUpdateBlueprint({ ...blueprint, units: reindexWeeks(newUnits) });
  };

  const handleDeleteWeek = (index: number) => {
    if (!window.confirm("Remove this week from the curriculum?")) return;
    const newUnits = [...blueprint.units];
    newUnits.splice(index, 1);
    onUpdateBlueprint({ ...blueprint, units: reindexWeeks(newUnits) });
  };

  const toggleSelection = (index: number) => {
    if (selectedWeekIndices.includes(index)) {
      setSelectedWeekIndices(prev => prev.filter(i => i !== index));
    } else {
      setSelectedWeekIndices(prev => [...prev, index]);
    }
  };

  const handleOpenSelected = () => {
    const units = selectedWeekIndices.sort((a, b) => a - b).map(i => blueprint.units[i]);
    onSelectUnits(units);
    setSelectedWeekIndices([]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-blue-100/40 via-purple-50/20 to-transparent rounded-bl-full pointer-events-none" />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-10 py-8 flex items-end justify-between z-10 sticky top-0 shadow-sm min-w-0">
        <div className="min-w-0 pr-4">
          <div className="flex items-center gap-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex-wrap">
             <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full whitespace-nowrap">{activeClass.grade}</span>
             <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full tracking-widest whitespace-nowrap">{activeClass.subject}</span>
             {(activeClass.accommodations || activeClass.learningStyles?.length) && (
                 <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap"><Sparkles className="w-3 h-3"/> Adapted</span>
             )}
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight truncate">{blueprint.title}</h1>
          <p className="mt-2 text-slate-500 font-medium max-w-2xl text-sm leading-relaxed line-clamp-2">{blueprint.description}</p>
        </div>
        
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
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-12 z-0 custom-scrollbar relative">
        <div className="max-w-4xl mx-auto pb-32">
           {/* Timeline Spine Container */}
           <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-[2.25rem] top-8 bottom-0 w-1 bg-gradient-to-b from-blue-200 via-indigo-100 to-transparent rounded-full" />

              <div className="space-y-8">
                {blueprint.units.map((unit, index) => {
                  const isSelected = selectedWeekIndices.includes(index);
                  return (
                    <div key={`${unit.weekNumber}-${index}`} className="relative pl-24 group">
                       {/* Timeline Marker */}
                       <div 
                         onClick={() => toggleSelection(index)}
                         className={`absolute left-3 top-6 w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-lg cursor-pointer transition-all duration-500 z-10 shadow-lg ${
                           isSelected 
                             ? 'bg-blue-600 outline outline-4 outline-blue-100 text-white scale-110 shadow-blue-600/30' 
                             : 'bg-white border-2 border-slate-100 text-slate-400 group-hover:border-blue-300 group-hover:text-blue-600 group-hover:scale-105 group-hover:shadow-blue-900/10'
                         }`}
                       >
                          {isSelected ? <CheckSquare className="w-6 h-6 animate-in zoom-in duration-200" /> : unit.weekNumber}
                       </div>

                       {/* Card */}
                       <div 
                         className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden relative ${
                           isSelected 
                             ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-2xl shadow-blue-900/10 -translate-y-1' 
                             : 'border-white shadow-xl shadow-slate-200/40 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-900/5 hover:-translate-y-1'
                         }`}
                       >
                          {isSelected && <div className="absolute inset-0 bg-blue-50/30 pointer-events-none" />}
                          {isEditing ? (
                             <div className="p-6 bg-slate-50/50 space-y-4">
                                <div className="flex justify-between items-center mb-4">
                                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Week {unit.weekNumber} Editor</span>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleInsertDelay(index)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors"><Clock className="w-3.5 h-3.5" /> Delay / Review</button>
                                    <button onClick={() => handleDeleteWeek(index)} className="p-1.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </div>
                                <input 
                                  value={unit.topicTitle} 
                                  onChange={(e) => handleUpdateUnit(index, 'topicTitle', e.target.value)}
                                  className="w-full font-extrabold text-2xl text-slate-900 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none px-2 py-2 transition-colors"
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                   <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Content Summary</label>
                                      <textarea 
                                        value={unit.summary}
                                        onChange={(e) => handleUpdateUnit(index, 'summary', e.target.value)}
                                        className="w-full text-sm text-slate-700 font-medium bg-white border border-slate-200 rounded-xl p-4 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none h-32 transition-all"
                                      />
                                   </div>
                                   <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Learning Outcomes</label>
                                      <textarea 
                                        value={unit.learningOutcome}
                                        onChange={(e) => handleUpdateUnit(index, 'learningOutcome', e.target.value)}
                                        className="w-full text-sm text-emerald-700 font-medium bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 focus:ring-4 focus:ring-emerald-500/10 outline-none resize-none h-32 transition-all"
                                      />
                                   </div>
                                </div>
                             </div>
                          ) : (
                             <div 
                               onClick={() => !isEditing && toggleSelection(index)}
                               className="p-8 cursor-pointer flex flex-col md:flex-row gap-8 items-start relative z-10"
                             >
                                <div className="flex-1">
                                   <h3 className="text-2xl font-extrabold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors tracking-tight">{unit.topicTitle}</h3>
                                   <p className="text-slate-600 text-base font-medium leading-relaxed">{unit.summary}</p>
                                </div>
                                <div className="flex-none w-full md:w-72 bg-gradient-to-br from-slate-50 to-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                   <div className="flex items-center gap-2 text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest mb-3">
                                      <Target className="w-4 h-4" /> Expected Outcome
                                   </div>
                                   <p className="text-sm text-slate-700 font-medium leading-relaxed italic border-l-2 border-emerald-200 pl-3">"{unit.learningOutcome}"</p>
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                  );
                })}

                {/* Add Week Node */}
                {isEditing && (
                  <div className="pl-24 relative pt-4">
                     <button onClick={handleAddWeek} className="w-full border-2 border-dashed border-slate-300 rounded-[2rem] p-6 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition-all gap-3 group">
                        <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                           <Plus className="w-6 h-6" />
                        </div>
                        <span className="font-extrabold text-lg">Append Week</span>
                     </button>
                  </div>
                )}
              </div>
           </div>
        </div>
      </main>

      {/* Floating Bulk Action Dock */}
      {selectedWeekIndices.length > 0 && (
         <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl text-white px-8 py-4 rounded-full shadow-2xl shadow-slate-900/30 flex items-center gap-8 animate-in slide-in-from-bottom-10 duration-500 z-50 border border-slate-700/50">
            <div className="flex items-center gap-4">
               <div className="bg-blue-500 text-white font-extrabold w-8 h-8 rounded-full flex items-center justify-center shadow-inner shadow-blue-400">{selectedWeekIndices.length}</div>
               <div className="flex flex-col">
                  <span className="font-bold text-sm leading-none">Weeks Selected</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Ready for workspace</span>
               </div>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <button 
              onClick={handleOpenSelected}
              className="flex items-center gap-3 text-sm font-extrabold text-blue-400 hover:text-white transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-6 py-2.5 rounded-full"
            >
               Open Workspace <ArrowRight className="w-4 h-4" />
            </button>
         </div>
      )}
    </div>
  );
};

export default CurriculumDashboard;
