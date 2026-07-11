'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Classroom, Student } from '@/lib/types';
import { CURRICULUMS, GRADES, SUBJECTS_COMMON } from '@/lib/constants';
import { generateMarksTemplate, parseMarksTemplate } from '@/lib/excelHelper';
import { analyzeClassPerformance } from '@/lib/gemini';
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
  onOpenEditClass?: (classroom: Classroom) => void;
}

const LEARNING_STYLES = ['Visual', 'Auditory', 'Reading/Writing', 'Kinesthetic', 'Logical', 'Social', 'Solitary'];

const ClassManager: React.FC<ClassManagerProps> = ({ classes, setClasses, onOpenClass, onCreateClass, onUpdateClass, onDeleteClass, editingClass, onCloseEdit, onOpenEditClass }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAnalysisClassId, setActiveAnalysisClassId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteTarget = classes.find(c => c.id === deleteTargetId);
  const [stepChangeTime, setStepChangeTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState(GRADES[0]);
  const [curriculum, setCurriculum] = useState(CURRICULUMS[0]);
  const [studentCount, setStudentCount] = useState(30);
  const [percentile, setPercentile] = useState(65);
  const [notes, setNotes] = useState('');
  const [learningStyles, setLearningStyles] = useState<string[]>([]);
  const [accommodations, setAccommodations] = useState('');
  const [studentInterests, setStudentInterests] = useState('');

  const activeAnalysisClass = classes.find(c => c.id === activeAnalysisClassId);

  const toggleLearningStyle = (style: string) => {
    setLearningStyles(prev => prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]);
  };

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
      if (editingClass) {
        if (!onUpdateClass) throw new Error('onUpdateClass handler is missing');
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

  const resetForm = () => {
    setName('');
    setSubject('');
    setGrade(GRADES[0]);
    setNotes('');
    setPercentile(65);
    setStudentCount(30);
    setLearningStyles([]);
    setAccommodations('');
    setStudentInterests('');
    setWizardStep(1);
  };

  const handleDownloadTemplate = () => {
    if (!activeAnalysisClass) return;
    const columns = activeAnalysisClass.assessmentColumns.length > 0 
      ? activeAnalysisClass.assessmentColumns 
      : ['Term 1 Test', 'Assignment 1', 'Mid-Year Exam'];
    const studentsForTemplate = activeAnalysisClass.students.length > 0 
      ? activeAnalysisClass.students 
      : Array.from({ length: 5 }).map((_, i) => ({ id: `ST${i+1}`, name: `Student ${i+1}` } as Student));
    generateMarksTemplate(studentsForTemplate, columns);
  };

  const handleUploadMarks = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAnalysisClass) return;
    setIsAnalyzing(true);
    try {
      const { students, assessmentNames } = await parseMarksTemplate(file);
      setClasses(prev => prev.map(c => {
        if (c.id === activeAnalysisClass.id) return { ...c, students, assessmentColumns: assessmentNames };
        return c;
      }));
      const analysis = await analyzeClassPerformance(students);
      setClasses(prev => prev.map(c => {
        if (c.id === activeAnalysisClass.id) {
          return { 
            ...c, 
            analysis,
            averagePercentile: Math.round(students.reduce((acc, s) => acc + (s.average || 0), 0) / students.length) || c.averagePercentile
          };
        }
        return c;
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to analyze data.");
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

  return (
    <div className="flex-1 h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-6 md:p-10 relative">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/50 text-blue-700 text-sm font-semibold mb-4 border border-blue-200">
               <Sparkles className="w-4 h-4" /> AI-Powered Curriculum
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">Classpaces</h1>
            <p className="text-slate-500 text-lg max-w-2xl font-light">
              Design, organize, and deeply analyze your classrooms. Create tailored curriculums driven by specific student needs and AI intelligence.
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="group flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-7 py-4 rounded-full font-bold shadow-xl shadow-slate-900/10 transition-all transform hover:-translate-y-1 active:scale-95"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span className="tracking-wide">Create Class</span>
          </button>
        </div>

        {/* Class Grid */}
        {classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-2xl shadow-slate-200/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-8 rounded-full mb-8 shadow-2xl shadow-blue-500/30 transform group-hover:scale-110 transition-transform duration-500">
              <Users className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-3xl font-extrabold text-slate-800 mb-4 tracking-tight">No Classes Yet</h3>
            <p className="text-slate-500 max-w-md text-center text-lg mb-10 leading-relaxed">
              Your workspace is a blank canvas. Profile your first class to generate highly-tailored curriculum content.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-blue-600 font-bold flex items-center gap-2 hover:bg-blue-50 px-6 py-3 rounded-full transition-colors"
            >
               Get Started <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {classes.map(cls => (
              <div 
                key={cls.id} 
                className="bg-white rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-200/60 hover:shadow-2xl hover:shadow-slate-300/60 hover:border-slate-300/80 hover:-translate-y-1 transition-all duration-500 flex flex-col overflow-hidden group relative"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-700" />
                
                <div className="p-8 flex-1 cursor-pointer z-10" onClick={() => onOpenClass(cls)}>
                  <div className="flex justify-between items-start mb-6">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 uppercase tracking-widest">
                       {cls.grade}
                    </span>
                    <div className="flex items-center gap-1">
                       <button
                          title="Edit Class"
                          onClick={(e) => { e.stopPropagation(); onOpenEditClass?.(cls); }}
                          className="min-w-12 min-h-12 md:min-w-0 md:min-h-0 md:w-9 md:h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all duration-300"
                       >
                          <Pencil className="w-4 h-4" />
                       </button>
                       <button
                          title="Class Analytics"
                          onClick={(e) => { e.stopPropagation(); setActiveAnalysisClassId(cls.id); }}
                          className="min-w-12 min-h-12 md:min-w-0 md:min-h-0 md:w-9 md:h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 transition-all duration-300"
                       >
                          <BarChart2 className="w-4 h-4" />
                       </button>
                       <button
                          title="Delete Class"
                          onClick={(e) => { e.stopPropagation(); setDeleteTargetId(cls.id); }}
                          className="min-w-12 min-h-12 md:min-w-0 md:min-h-0 md:w-9 md:h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-all duration-300"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-extrabold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors tracking-tight">{cls.name}</h3>
                  <p className="text-sm font-medium text-slate-500 mb-8">{cls.subject} • {cls.curriculum}</p>
                  
                  <div className="grid grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                    <div>
                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Students</div>
                       <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-slate-400" />
                          <span className="font-extrabold text-slate-700 text-lg">{cls.studentCount}</span>
                       </div>
                    </div>
                    <div>
                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Avg. Grade</div>
                       <div className="flex items-center gap-2">
                          <PieChart className={`w-5 h-5 ${cls.averagePercentile < 50 ? 'text-red-400' : cls.averagePercentile > 75 ? 'text-green-500' : 'text-slate-400'}`} />
                          <span className={`font-extrabold text-lg ${cls.averagePercentile < 50 ? 'text-red-500' : cls.averagePercentile > 75 ? 'text-green-600' : 'text-slate-700'}`}>
                             {cls.averagePercentile}%
                          </span>
                       </div>
                    </div>
                  </div>
                  
                  {/* Quick look at accommodations/interests if any */}
                  {(cls.accommodations || cls.studentInterests) && (
                     <div className="mt-4 flex flex-wrap gap-2">
                        {cls.accommodations && <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Accommodations</span>}
                        {cls.studentInterests && <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">Interests Mapped</span>}
                     </div>
                  )}
                </div>

                {/* Footer Action */}
                <div onClick={() => onOpenClass(cls)} className="p-5 flex items-center justify-between border-t border-slate-100 bg-white/50 group-hover:bg-blue-600 transition-colors duration-300 cursor-pointer z-10">
                   <span className="text-xs font-bold text-slate-400 group-hover:text-blue-50 uppercase tracking-widest pl-3">Open Workspace</span>
                   <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white transform group-hover:translate-x-0.5 transition-all" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE CLASS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-2xl rounded-2xl sm:rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[92vh] border border-white">
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-100 flex justify-between items-center flex-none bg-white">
              <div>
                 <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{editingClass ? 'Edit Class Profile' : 'New Class Profile'}</h2>
                 <p className="text-slate-500 text-sm font-medium">Step {wizardStep} of 2</p>
              </div>
              <button title="Close Modal" onClick={() => { setIsModalOpen(false); onCloseEdit?.(); }} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            
            <form onSubmit={handleCreateClass} className="p-4 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
               {wizardStep === 1 ? (
                  <div className="space-y-6">
                     <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-slate-800">Core Details</h3>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Class Name</label>
                        <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grade 5 - Hawks Group" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-sm text-slate-800 placeholder-slate-400/80" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Subject</label>
                           <input required list="subjects" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Select Subject" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm text-slate-800 font-medium placeholder-slate-400/80" />
                           <datalist id="subjects">{SUBJECTS_COMMON.map(s => <option key={s} value={s} />)}</datalist>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Grade</label>
                           <select required value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none text-sm text-slate-800 font-medium">
                           {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                           </select>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Student Count</label>
                           <input type="number" min="1" required value={studentCount} onChange={e => setStudentCount(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm text-slate-800 font-medium" />
                        </div>
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-1.5" title="Average performance helps the AI adjust the baseline difficulty of materials."><HelpCircle className="w-3 h-3"/> Avg. Performance (%)</label>
                           <input type="number" min="0" max="100" required value={percentile} onChange={e => setPercentile(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm text-slate-800 font-medium" />
                        </div>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Curriculum Standard</label>
                        <select required value={curriculum} onChange={e => setCurriculum(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none text-sm text-slate-800 font-medium">
                           {CURRICULUMS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                  </div>
               ) : (
                  <div className="space-y-6">
                     <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                           <BrainCircuit className="w-5 h-5 text-indigo-500" />
                           <h3 className="font-bold text-slate-800">Advanced AI Customization</h3>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-wider">Boosts Output Quality</span>
                     </div>
                     
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-2" title="Helps the AI generate targeted multi-modal content (e.g., visual diagrams, hands-on activities).">
                           <Fingerprint className="w-3 h-3" /> Dominant Learning Styles (Optional) <HelpCircle className="w-3 h-3 text-slate-300"/>
                        </label>
                        <div className="flex flex-wrap gap-2">
                           {LEARNING_STYLES.map(style => (
                              <button
                                 key={style}
                                 type="button"
                                 onClick={() => toggleLearningStyle(style)}
                                 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                    learningStyles.includes(style)
                                       ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                                       : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                 }`}
                              >
                                 {style}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-2" title="The AI will adapt formatting, vocabulary, and structure to meet these needs.">
                              <Heart className="w-3 h-3" /> Accommodations / IEPs <HelpCircle className="w-3 h-3 text-slate-300"/>
                           </label>
                           <textarea value={accommodations} onChange={e => setAccommodations(e.target.value)} placeholder="e.g. Dyslexia friendly fonts, extra time..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all h-24 resize-none text-sm text-slate-800 placeholder-slate-400/80" />
                        </div>
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-2" title="The AI will use these interests to create engaging word problems and examples.">
                              <Sparkles className="w-3 h-3" /> Student Interests <HelpCircle className="w-3 h-3 text-slate-300"/>
                           </label>
                           <textarea value={studentInterests} onChange={e => setStudentInterests(e.target.value)} placeholder="e.g. Minecraft, Space explorer, Sports..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all h-24 resize-none text-sm text-slate-800 placeholder-slate-400/80" />
                        </div>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-1.5" title="Any context you think is important for the AI to know about this class."><HelpCircle className="w-3 h-3"/> General Teaching Context</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any other context? E.g. Class struggles with reading comprehension..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all h-16 resize-none text-sm text-slate-800 placeholder-slate-400/80" />
                     </div>
                  </div>
               )}

               {/* Footer */}
               <div className="mt-10 pt-6 border-t border-slate-100 flex gap-4 justify-end">
                 {wizardStep === 1 ? (
                    <>
                       <button type="button" onClick={() => { setIsModalOpen(false); onCloseEdit?.(); }} className="px-8 py-4 rounded-full text-slate-500 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                       <button type="button" onClick={() => { setWizardStep(2); setStepChangeTime(Date.now()); }} disabled={!name || !subject || !grade} className="px-10 py-4 rounded-full bg-blue-600 text-white font-extrabold shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
                          Next Step <ArrowRight className="w-5 h-5" />
                       </button>
                    </>
                 ) : (
                    <>
                       <button type="button" onClick={() => setWizardStep(1)} className="px-8 py-4 rounded-full text-slate-500 font-bold hover:bg-slate-50 transition-colors">Back</button>
                       <button type="submit" disabled={isCreating} className="px-10 py-4 rounded-full bg-slate-900 text-white font-extrabold shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
                          {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} {editingClass ? 'Save Changes' : 'Create Workspace'} <ArrowRight className="w-5 h-5" />
                       </button>
                    </>
                 )}
               </div>
            </form>
          </div>
        </div>
      )}

      {/* ANALYTICS SLIDE-OVER */}
      {activeAnalysisClass && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setActiveAnalysisClassId(null)} />
          <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-3xl shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-500 border-l border-white">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-10">
               <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Intelligence Hub</h2>
                  <p className="font-medium text-slate-500">{activeAnalysisClass.name}</p>
               </div>
               <button title="Close Analytics" onClick={() => setActiveAnalysisClassId(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
               {/* Quick Actions */}
               <div className="grid grid-cols-2 gap-6">
                  <button onClick={handleDownloadTemplate} className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all text-left flex flex-col justify-center items-start group">
                     <div className="w-12 h-12 bg-blue-100/50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                        <Download className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                     </div>
                     <div className="font-extrabold text-slate-800 text-lg mb-1">Get Data Template</div>
                     <div className="text-sm font-medium text-slate-500">Download Excel format</div>
                  </button>
                  <div className="relative">
                     <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleUploadMarks} className="hidden" />
                     <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="w-full h-full p-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all text-left flex flex-col justify-center items-start group disabled:opacity-50 disabled:hover:translate-y-0">
                        <div className="w-12 h-12 bg-indigo-100/50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
                           {isAnalyzing ? <Loader2 className="w-6 h-6 text-indigo-600 group-hover:text-white animate-spin" /> : <Upload className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />}
                        </div>
                        <div className="font-extrabold text-slate-800 text-lg mb-1">{isAnalyzing ? 'Analyzing...' : 'Upload & Analyze'}</div>
                        <div className="text-sm font-medium text-slate-500">Run AI insights</div>
                     </button>
                  </div>
               </div>

               {/* Analysis Report */}
               {!activeAnalysisClass.analysis ? (
                 <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                       <BarChart2 className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">No Data Available</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto">Upload student marks to generate deep AI insights and intervention strategies.</p>
                 </div>
               ) : (
                 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                       <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                       <h3 className="font-extrabold text-lg mb-3 flex items-center gap-2 tracking-wide"><Sparkles className="w-5 h-5 text-indigo-200" /> Executive Summary</h3>
                       <p className="text-indigo-50 leading-relaxed font-medium">{activeAnalysisClass.analysis.summary}</p>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                       <h3 className="font-extrabold text-slate-900 mb-4 flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5 text-emerald-500" /> Class Performance Trends</h3>
                       <div className="p-5 bg-emerald-50/50 rounded-2xl text-slate-700 leading-relaxed font-medium">
                          {activeAnalysisClass.analysis.generalTrends}
                       </div>
                    </div>

                    <div>
                       <h3 className="font-extrabold text-slate-900 mb-6 flex items-center gap-2 text-lg"><AlertTriangle className="w-5 h-5 text-rose-500" /> Intervention Targets</h3>
                       {activeAnalysisClass.analysis.atRiskStudents.length === 0 ? (
                         <div className="p-6 bg-emerald-50 text-emerald-700 rounded-2xl font-bold flex items-center justify-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> No high-risk students identified in this batch.
                         </div>
                       ) : (
                         <div className="space-y-4">
                           {activeAnalysisClass.analysis.atRiskStudents.map((s, i) => (
                             <div key={i} className="bg-white border hover:border-rose-200 border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center mb-4">
                                   <span className="font-extrabold text-slate-900 text-lg">{s.name}</span>
                                   <span className="px-3 py-1 bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full">Requires Attention</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="p-4 bg-slate-50 rounded-xl">
                                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Identified Issue</p>
                                      <p className="text-sm text-slate-700 font-medium">{s.reason}</p>
                                   </div>
                                   <div className="p-4 bg-indigo-50/50 rounded-xl">
                                      <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">Suggested Intervention</p>
                                      <p className="text-sm text-indigo-900 font-medium">{s.intervention}</p>
                                   </div>
                                </div>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-[2rem] shadow-2xl p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-300 border border-white">
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
    </div>
  );
};

function countResources(cls: Classroom, key: 'worksheets' | 'assignments' | 'tests'): number {
  return Object.values(cls.savedLessons ?? {}).reduce((sum, lesson) => sum + (lesson[key]?.length ?? 0), 0);
}

export default ClassManager;
