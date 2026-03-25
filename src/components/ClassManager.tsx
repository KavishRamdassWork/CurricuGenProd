'use client';

import React, { useState, useRef } from 'react';
import { Classroom, Student, ClassAnalysis } from '@/lib/types';
import { CURRICULUMS, GRADES, SUBJECTS_COMMON } from '@/lib/constants';
import { generateMarksTemplate, parseMarksTemplate } from '@/lib/excelHelper';
import { analyzeClassPerformance } from '@/lib/gemini';
import { Users, Plus, ChevronRight, BookOpen, GraduationCap, Globe, Layers, ArrowRight, X, BarChart2, Download, Upload, AlertTriangle, TrendingUp, Sparkles, FileSpreadsheet, MoreHorizontal, PieChart, Loader2 } from 'lucide-react';

interface ClassManagerProps {
  classes: Classroom[];
  setClasses: React.Dispatch<React.SetStateAction<Classroom[]>>;
  onOpenClass: (classroom: Classroom) => void;
  onCreateClass?: (classroom: Omit<Classroom, 'id'>) => Promise<Classroom | null>;
  onDeleteClass?: (classroomId: string) => Promise<void>;
}

const ClassManager: React.FC<ClassManagerProps> = ({ classes, setClasses, onOpenClass, onCreateClass, onDeleteClass }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAnalysisClassId, setActiveAnalysisClassId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState(GRADES[0]);
  const [curriculum, setCurriculum] = useState(CURRICULUMS[0]);
  const [studentCount, setStudentCount] = useState(30);
  const [percentile, setPercentile] = useState(65);
  const [notes, setNotes] = useState('');

  const activeAnalysisClass = classes.find(c => c.id === activeAnalysisClassId);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const classData = {
      name, subject, grade, curriculum, studentCount,
      averagePercentile: percentile,
      teachingNotes: notes,
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

  const resetForm = () => {
    setName(''); setSubject(''); setGrade(GRADES[0]);
    setNotes(''); setPercentile(65); setStudentCount(30);
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
            ...c, analysis,
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

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 p-6 md:p-10 relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Class Manager</h1>
            <p className="text-slate-500 text-lg max-w-2xl">Design, organize, and analyze your classrooms. Create tailored curriculums driven by AI.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-xl shadow-blue-500/20 transition-all transform hover:-translate-y-1 active:scale-95">
            <Plus className="w-5 h-5" /> Create Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="bg-blue-50 p-6 rounded-full mb-6"><Users className="w-12 h-12 text-blue-400" /></div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">No Classes Created</h3>
            <p className="text-slate-400 max-w-md text-center mb-8">Your workspace is empty. Create your first class profile to start generating lesson content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {classes.map(cls => (
              <div key={cls.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-2xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden group">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600 w-full" />
                <div className="p-6 flex-1 cursor-pointer" onClick={() => onOpenClass(cls)}>
                  <div className="flex justify-between items-start mb-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 uppercase tracking-wide">{cls.grade}</span>
                    <button onClick={(e) => { e.stopPropagation(); setActiveAnalysisClassId(cls.id); }} className="text-slate-300 hover:text-blue-600 transition-colors">
                      <BarChart2 className="w-5 h-5" />
                    </button>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{cls.name}</h3>
                  <p className="text-sm font-medium text-slate-500 mb-6">{cls.subject} • {cls.curriculum}</p>
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">Students</div>
                      <div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" /><span className="font-bold text-slate-700">{cls.studentCount}</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">Avg. Grade</div>
                      <div className="flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-slate-400" />
                        <span className={`font-bold ${cls.averagePercentile < 50 ? 'text-red-500' : cls.averagePercentile > 75 ? 'text-green-600' : 'text-slate-700'}`}>{cls.averagePercentile}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div onClick={() => onOpenClass(cls)} className="bg-slate-50 p-4 flex items-center justify-between border-t border-slate-100 group-hover:bg-blue-600 transition-colors cursor-pointer">
                  <span className="text-xs font-bold text-slate-500 group-hover:text-white uppercase tracking-wider">Open Curriculum</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white transform group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE CLASS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center flex-none">
              <h2 className="text-2xl font-bold text-slate-900">New Class Profile</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={handleCreateClass} className="p-8 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="col-span-full">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Class Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grade 5 - Hawks Group" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Subject</label>
                  <input required list="subjects" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Select Subject" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                  <datalist id="subjects">{SUBJECTS_COMMON.map(s => <option key={s} value={s} />)}</datalist>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Grade</label>
                  <select required value={grade} onChange={e => setGrade(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none">
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="col-span-full">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Curriculum</label>
                  <select required value={curriculum} onChange={e => setCurriculum(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none">
                    {CURRICULUMS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Student Count</label>
                  <input type="number" min="1" required value={studentCount} onChange={e => setStudentCount(Number(e.target.value))} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Avg. Performance (%)</label>
                  <input type="number" min="0" max="100" required value={percentile} onChange={e => setPercentile(Number(e.target.value))} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                </div>
                <div className="col-span-full">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Teaching Context</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="E.g. Class struggles with reading comprehension..." className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all h-24 resize-none" />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-[2] py-3.5 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors">Create Class</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANALYTICS SLIDE-OVER */}
      {activeAnalysisClass && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setActiveAnalysisClassId(null)} />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Analytics Dashboard</h2>
                <p className="text-sm text-slate-500">{activeAnalysisClass.name}</p>
              </div>
              <button onClick={() => setActiveAnalysisClassId(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleDownloadTemplate} className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group">
                  <Download className="w-5 h-5 text-slate-400 group-hover:text-blue-600 mb-2" />
                  <div className="font-bold text-slate-700">Download Template</div>
                  <div className="text-xs text-slate-400">Get Excel format</div>
                </button>
                <div className="relative">
                  <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleUploadMarks} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="w-full h-full p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group disabled:opacity-50">
                    {isAnalyzing ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin mb-2" /> : <Upload className="w-5 h-5 text-slate-400 group-hover:text-blue-600 mb-2" />}
                    <div className="font-bold text-slate-700">{isAnalyzing ? 'Analyzing...' : 'Upload Marks'}</div>
                    <div className="text-xs text-slate-400">Import & Analyze</div>
                  </button>
                </div>
              </div>
              {!activeAnalysisClass.analysis ? (
                <div className="text-center py-12 opacity-50">
                  <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Upload student data to generate insights.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-blue-100">
                    <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Summary</h3>
                    <p className="text-slate-700 leading-relaxed text-sm">{activeAnalysisClass.analysis.summary}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-500" /> Trends</h3>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-600">{activeAnalysisClass.analysis.generalTrends}</div>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> At-Risk Students</h3>
                    {activeAnalysisClass.analysis.atRiskStudents.length === 0 ? (
                      <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm font-medium">No high-risk students identified.</div>
                    ) : (
                      <div className="space-y-3">
                        {activeAnalysisClass.analysis.atRiskStudents.map((s, i) => (
                          <div key={i} className="bg-white border border-red-100 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-slate-800">{s.name}</span>
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold uppercase rounded-full">Action Needed</span>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-slate-500"><strong className="text-slate-700">Issue:</strong> {s.reason}</p>
                              <p className="text-xs text-slate-500"><strong className="text-slate-700">Intervention:</strong> {s.intervention}</p>
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
    </div>
  );
};

export default ClassManager;
