'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { WeekUnit, UploadedFile, ChatMessage, EducationalResource, TemplateConfig, Classroom } from '@/lib/types';
import { generateLessonPlan, generatePresentation, generateWorksheet, generateAssignment, generateAssessment, generateMemo, generateGame, generateResources, refineContent, generateEducationalImage } from '@/lib/gemini';
import { ArrowLeft, FileText, MonitorPlay, Check, Printer, Sparkles, Upload, Paperclip, X, MessageSquare, Send, Bot, HelpCircle, Gamepad2, Library, Plus, Trash2, FileCheck, ClipboardList, BookOpen, Settings, Image as ImageIcon, LayoutTemplate, PenTool, GripVertical, Download } from 'lucide-react';

interface LessonWorkspaceProps {
  units: WeekUnit[];
  activeClass: Classroom;
  onBack: () => void;
  onSaveClassContent: (classId: string, unitId: string, content: any) => void;
  onContentGenerated?: () => void;
}

type MainTab = 'plan' | 'slides' | 'game' | 'resources' | 'visuals';
type ResourceType = 'worksheet' | 'assignment' | 'test';

const LessonWorkspace: React.FC<LessonWorkspaceProps> = ({ units, activeClass, onBack, onSaveClassContent, onContentGenerated }) => {
  const isRevisionMode = units.length > 1;
  const unitKey = isRevisionMode ? `revision-${units.map(u => u.weekNumber).join('-')}` : `${units[0].weekNumber}-${units[0].topicTitle}`;

  const [activeSection, setActiveSection] = useState<MainTab | 'educational'>('plan');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [resourceViewMode, setResourceViewMode] = useState<'content' | 'memo'>('content');
  const [lessonPlan, setLessonPlan] = useState<string | null>(null);
  const [slides, setSlides] = useState<string | null>(null);
  const [game, setGame] = useState<string | null>(null);
  const [resources, setResources] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [worksheets, setWorksheets] = useState<EducationalResource[]>([]);
  const [assignments, setAssignments] = useState<EducationalResource[]>([]);
  const [tests, setTests] = useState<EducationalResource[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [generatingMemo, setGeneratingMemo] = useState(false);
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>({ schoolName: '', logo: null, font: 'modern', layout: 'standard' });
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [creationType, setCreationType] = useState<ResourceType | null>(null);
  const [creationInstruction, setCreationInstruction] = useState('');
  const [creationScope, setCreationScope] = useState<number[]>(units.map(u => u.weekNumber));
  const [chatInput, setChatInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [attachedFile, setAttachedFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = activeClass.savedLessons?.[unitKey];
    if (saved) {
      setLessonPlan(saved.plan || null); setSlides(saved.slides || null);
      setWorksheets(saved.worksheets || []); setAssignments(saved.assignments || []); setTests(saved.tests || []);
    } else {
      setLessonPlan(null); setSlides(null); setWorksheets([]); setAssignments([]); setTests([]);
    }
  }, [activeClass.id, unitKey]);

  useEffect(() => {
    onSaveClassContent(activeClass.id, unitKey, { plan: lessonPlan || '', slides: slides || '', worksheets, assignments, tests });
  }, [lessonPlan, slides, worksheets, assignments, tests]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isRefining]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setAttachedFile({ name: file.name, mimeType: file.type, data: (event.target?.result as string).split(',')[1] });
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setTemplateConfig(p => ({ ...p, logo: event.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleGenerateMain = async (type: MainTab) => {
    setLoading(true);
    try {
      if (type === 'visuals') {
        const url = await generateEducationalImage(units[0]);
        setGeneratedImageUrl(url);
      } else {
        let content = "";
        if (type === 'plan') content = await generateLessonPlan(activeClass, units, attachedFile || undefined);
        else if (type === 'slides') content = await generatePresentation(activeClass, units);
        else if (type === 'game') content = await generateGame(activeClass, units[0], attachedFile || undefined);
        else if (type === 'resources') content = await generateResources(activeClass, units[0], attachedFile || undefined);
        if (type === 'plan') setLessonPlan(content);
        if (type === 'slides') setSlides(content);
        if (type === 'game') setGame(content);
        if (type === 'resources') setResources(content);
        onContentGenerated?.();
      }
    } catch (e: any) {
      if (e.code === 'LIMIT_REACHED') {
        if (window.confirm('You have reached your daily limit of 10 free generations.\\n\\nWould you like to upgrade to Pro for unlimited access?')) window.location.href = '/pricing';
      } else if (type === 'visuals' && e.message && (e.message.includes('400') || e.message.includes('429') || e.message.includes('paid plan') || e.message.includes('Quota'))) {
        alert("Image generation requires a Paid/Pro Gemini API key (Free Tier quota is 0).");
      } else {
        alert(e.message || 'Error generating content.');
      }
      console.error(e);
    } finally { setLoading(false); }
  };

  const handleAddResource = async () => {
    if (!creationType) return;
    setLoading(true); setIsCreationModalOpen(false);
    try {
      const id = Date.now().toString();
      const scopeUnits = activeClass.blueprint?.units.filter(u => creationScope.includes(u.weekNumber)) || units;
      let content = "", title = "";
      if (creationType === 'worksheet') {
        title = `Worksheet: ${units[0].topicTitle}`;
        content = await generateWorksheet(activeClass, units[0], "Standard", attachedFile || undefined, creationInstruction);
        setWorksheets(p => [...p, { id, type: 'worksheet', title, content, memo: null }]);
      } else if (creationType === 'assignment') {
        title = `Assignment: ${units[0].topicTitle}`;
        content = await generateAssignment(activeClass, units[0], attachedFile || undefined, creationInstruction);
        setAssignments(p => [...p, { id, type: 'assignment', title, content, memo: null }]);
      } else if (creationType === 'test') {
        title = `Test: Weeks ${creationScope.join(', ')}`;
        content = await generateAssessment(activeClass, units[0], attachedFile || undefined, creationInstruction, scopeUnits);
        setTests(p => [...p, { id, type: 'test', title, content, memo: null }]);
      }
      setActiveSection('educational'); setSelectedResourceId(id); setResourceViewMode('content');
      onContentGenerated?.();
    } catch (e: any) {
      if (e.code === 'LIMIT_REACHED') {
        if (window.confirm('You have reached your daily limit of 10 free generations.\\n\\nWould you like to upgrade to Pro for unlimited access?')) window.location.href = '/pricing';
      } else {
        alert(e.message || 'Error creating resource.');
      }
      console.error(e);
    } finally { setLoading(false); setCreationType(null); }
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    let currentContent = "";
    if (activeSection === 'plan') currentContent = lessonPlan || "";
    else if (activeSection === 'slides') currentContent = slides || "";
    else if (activeSection === 'game') currentContent = game || "";
    else if (activeSection === 'resources') currentContent = resources || "";
    else if (activeSection === 'educational' && selectedResourceId) {
      const res = [...worksheets, ...assignments, ...tests].find(r => r.id === selectedResourceId);
      currentContent = (resourceViewMode === 'content' ? res?.content : res?.memo) || "";
    }
    if (!currentContent) { alert("Generate content first."); return; }
    setChatHistory(p => [...p, { id: Date.now().toString(), role: 'user', text: chatInput }]);
    setChatInput(''); setIsRefining(true);
    try {
      const updated = await refineContent(currentContent, chatInput, activeSection, attachedFile || undefined);
      if (activeSection === 'plan') setLessonPlan(updated);
      else if (activeSection === 'slides') setSlides(updated);
      else if (activeSection === 'game') setGame(updated);
      else if (activeSection === 'resources') setResources(updated);
      else if (activeSection === 'educational' && selectedResourceId) {
        if (resourceViewMode === 'content') {
          setWorksheets(p => p.map(r => r.id === selectedResourceId ? { ...r, content: updated } : r));
          setAssignments(p => p.map(r => r.id === selectedResourceId ? { ...r, content: updated } : r));
          setTests(p => p.map(r => r.id === selectedResourceId ? { ...r, content: updated } : r));
        } else {
          setWorksheets(p => p.map(r => r.id === selectedResourceId ? { ...r, memo: updated } : r));
          setAssignments(p => p.map(r => r.id === selectedResourceId ? { ...r, memo: updated } : r));
          setTests(p => p.map(r => r.id === selectedResourceId ? { ...r, memo: updated } : r));
        }
      }
      setChatHistory(p => [...p, { id: Date.now().toString(), role: 'ai', text: "Content updated successfully." }]);
      onContentGenerated?.();
    } catch (e: any) {
      if (e.code === 'LIMIT_REACHED') {
        if (window.confirm('You have reached your daily limit of 10 free generations.\\n\\nWould you like to upgrade to Pro for unlimited access?')) window.location.href = '/pricing';
      } else {
        alert(e.message || 'Error refining content.');
      }
      console.error(e);
    } finally { setIsRefining(false); }
  };

  const DocumentHeader = () => {
    if (!templateConfig.logo && !templateConfig.schoolName) return null;
    return (
      <div className={`mb-8 flex items-center gap-4 pb-6 border-b-2 ${templateConfig.layout === 'formal' ? 'border-black justify-center' : 'border-slate-200 justify-between'}`}>
        {templateConfig.logo && <img src={templateConfig.logo} alt="Logo" className="h-16 w-auto object-contain" />}
        {templateConfig.schoolName && <h2 className="text-xl font-bold uppercase tracking-wider">{templateConfig.schoolName}</h2>}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden relative">
      {/* LEFT TOOLBAR */}
      <aside className={`bg-white border-r border-slate-200 flex flex-col z-20 transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-72'}`}>
        <div className="h-16 border-b border-slate-100 flex items-center px-4 gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
          {!isSidebarCollapsed && <span className="font-bold text-slate-800 truncate">Workspace</span>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <div className={`p-3 rounded-xl border-2 border-dashed transition-colors ${attachedFile ? 'border-blue-200 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
            {!attachedFile ? (
              <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer flex flex-col items-center text-center">
                <Upload className="w-5 h-5 text-slate-400 mb-1" />
                {!isSidebarCollapsed && <span className="text-xs font-bold text-slate-500">Add Context PDF</span>}
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Paperclip className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  {!isSidebarCollapsed && <span className="text-xs font-medium text-blue-700 truncate">{attachedFile.name}</span>}
                </div>
                <button onClick={() => setAttachedFile(null)}><X className="w-3 h-3 text-slate-400 hover:text-red-500" /></button>
              </div>
            )}
          </div>
          <div>
            {!isSidebarCollapsed && <h3 className="px-2 text-xs font-bold text-slate-400 uppercase mb-2">Teacher Guide</h3>}
            <div className="space-y-1">
              <NavButton icon={BookOpen} label="Lesson Plan" active={activeSection === 'plan'} onClick={() => setActiveSection('plan')} collapsed={isSidebarCollapsed} hasContent={!!lessonPlan} />
              <NavButton icon={MonitorPlay} label="Slides" active={activeSection === 'slides'} onClick={() => setActiveSection('slides')} collapsed={isSidebarCollapsed} hasContent={!!slides} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              {!isSidebarCollapsed && <h3 className="text-xs font-bold text-slate-400 uppercase">Resources</h3>}
              <button onClick={() => { setCreationType('worksheet'); setIsCreationModalOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              {[...worksheets, ...assignments, ...tests].map(r => (
                <button key={r.id} onClick={() => { setActiveSection('educational'); setSelectedResourceId(r.id); }} className={`w-full flex items-center gap-3 p-2 rounded-lg text-sm transition-all ${selectedResourceId === r.id && activeSection === 'educational' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {r.type === 'worksheet' && <FileText className="w-4 h-4" />}
                  {r.type === 'assignment' && <ClipboardList className="w-4 h-4" />}
                  {r.type === 'test' && <HelpCircle className="w-4 h-4" />}
                  {!isSidebarCollapsed && <span className="truncate">{r.title}</span>}
                </button>
              ))}
            </div>
          </div>
          <div>
            {!isSidebarCollapsed && <h3 className="px-2 text-xs font-bold text-slate-400 uppercase mb-2">Enhancements</h3>}
            <div className="space-y-1">
              <NavButton icon={ImageIcon} label="Visual Aids" active={activeSection === 'visuals'} onClick={() => setActiveSection('visuals')} collapsed={isSidebarCollapsed} hasContent={!!generatedImageUrl} />
              <NavButton icon={Gamepad2} label="Activity" active={activeSection === 'game'} onClick={() => setActiveSection('game')} collapsed={isSidebarCollapsed} hasContent={!!game} />
              <NavButton icon={Library} label="Links" active={activeSection === 'resources'} onClick={() => setActiveSection('resources')} collapsed={isSidebarCollapsed} hasContent={!!resources} />
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN DOCUMENT AREA */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-none">
          <div className="min-w-0 pr-4 flex-1">
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
              <span className="truncate">{isRevisionMode ? "Revision Plan" : units[0].topicTitle}</span>
              {activeSection === 'educational' && selectedResourceId && (
                <span className="text-slate-400 font-normal truncate flex-shrink-0">
                  / {[...worksheets, ...assignments, ...tests].find(r => r.id === selectedResourceId)?.title}
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeSection === 'educational' && (
              <div className="flex bg-slate-100 p-1 rounded-lg mr-4 flex-shrink-0">
                <button onClick={() => setResourceViewMode('content')} className={`px-3 py-1 text-xs font-bold rounded-md ${resourceViewMode === 'content' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Content</button>
                <button onClick={() => setResourceViewMode('memo')} className={`px-3 py-1 text-xs font-bold rounded-md ${resourceViewMode === 'memo' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500'}`}>Memo</button>
              </div>
            )}
            <button onClick={() => setIsTemplateModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg flex-shrink-0"><Settings className="w-5 h-5" /></button>
            <button onClick={() => setIsChatOpen(!isChatOpen)} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isChatOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}><MessageSquare className="w-5 h-5" /></button>
            <button onClick={() => window.print()} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg flex-shrink-0"><Printer className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-12 relative bg-slate-100">
          <div className="mx-auto min-h-[1000px] bg-white shadow-xl rounded-xl overflow-hidden print:shadow-none print:rounded-none">
            {loading && (
              <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Drafting content...</p>
              </div>
            )}
            <div className="p-12 lg:p-16 print:p-0">
              <DocumentHeader />
              {activeSection === 'plan' && (lessonPlan ? <div className="markdown-body"><RenderMarkdown docType="teacher">{lessonPlan}</RenderMarkdown></div> : <EmptyState icon={BookOpen} label="Lesson Plan" action={() => handleGenerateMain('plan')} />)}
              {activeSection === 'slides' && (slides ? <div className="markdown-body"><RenderMarkdown docType="teacher">{slides}</RenderMarkdown></div> : <EmptyState icon={MonitorPlay} label="Slide Outline" action={() => handleGenerateMain('slides')} />)}
              {activeSection === 'visuals' && (
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-80">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Visual Elements</h3>
                  <p className="text-slate-500 max-w-sm mb-6">We are currently upgrading our image generation engine. This feature will be available soon!</p>
                  <div className="px-4 py-1.5 bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider rounded-full">Coming Soon</div>
                </div>
              )}
              {activeSection === 'game' && (game ? <div className="markdown-body"><RenderMarkdown docType="teacher">{game}</RenderMarkdown></div> : <EmptyState icon={Gamepad2} label="Activity / Game" action={() => handleGenerateMain('game')} />)}
              {activeSection === 'resources' && (resources ? <div className="markdown-body"><RenderMarkdown docType="teacher">{resources}</RenderMarkdown></div> : <EmptyState icon={Library} label="Resources" action={() => handleGenerateMain('resources')} />)}
              {activeSection === 'educational' && selectedResourceId && (() => {
                const res = [...worksheets, ...assignments, ...tests].find(r => r.id === selectedResourceId);
                if (!res) return null;
                const contentToShow = resourceViewMode === 'content' ? res.content : res.memo;
                if (!contentToShow && resourceViewMode === 'memo') {
                  return (
                    <div className="flex flex-col items-center justify-center py-20">
                      <FileCheck className="w-16 h-16 text-green-200 mb-4" />
                      <h3 className="text-lg font-bold text-slate-700 mb-2">No Answer Key Yet</h3>
                      <button onClick={async () => {
                        try {
                          setLoading(true);
                          const m = await generateMemo(res.content, activeClass);
                          setTests(prev => prev.map(t => t.id === res.id ? {...t, memo: m} : t));
                          setAssignments(prev => prev.map(t => t.id === res.id ? {...t, memo: m} : t));
                          setWorksheets(prev => prev.map(t => t.id === res.id ? {...t, memo: m} : t));
                          onContentGenerated?.();
                        } catch (e: any) {
                          if (e.code === 'LIMIT_REACHED') {
                            if (window.confirm('You have reached your daily limit of 10 free generations.\n\nWould you like to upgrade to Pro for unlimited access?')) window.location.href = '/pricing';
                          } else {
                            alert(e.message || 'Error generating memo. Content might be too large.');
                          }
                        } finally {
                          setLoading(false);
                        }
                      }} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20">Generate Memo</button>
                    </div>
                  );
                }
                return <div className="markdown-body"><RenderMarkdown docType="student">{contentToShow || ''}</RenderMarkdown></div>;
              })()}
            </div>
          </div>
        </div>
      </main>

      {/* AI CHAT SIDEBAR */}
      {isChatOpen && (
        <aside className="w-96 bg-white border-l border-slate-200 shadow-2xl z-30 flex flex-col">
          <div className="h-16 border-b border-slate-100 flex items-center px-6 bg-slate-50/50 justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-600" /> AI Assistant</h3>
            <button onClick={() => setIsChatOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatHistory.length === 0 && (<div className="text-center text-slate-400 text-sm py-10"><Bot className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>Ask me to refine, shorten, or expand the current document.</p></div>)}
            {chatHistory.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {msg.role === 'user' ? <MessageSquare className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 border-t border-slate-100">
            <form onSubmit={handleRefine} className="relative">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Make it shorter..." className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
              <button type="submit" disabled={isRefining || !chatInput} className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"><Send className="w-4 h-4" /></button>
            </form>
          </div>
        </aside>
      )}

      {/* CREATION MODAL */}
      {isCreationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex gap-3">
                {(['worksheet', 'assignment', 'test'] as ResourceType[]).map(t => (
                  <button key={t} onClick={() => setCreationType(t)} className={`px-3 py-1.5 rounded-lg text-sm font-bold capitalize ${creationType === t ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>{t}</button>
                ))}
              </div>
              <button onClick={() => setIsCreationModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {creationType === 'test' && (
                <div className="border rounded-lg p-3 max-h-32 overflow-y-auto bg-slate-50">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Scope</label>
                  {activeClass.blueprint?.units.map(u => (
                    <label key={u.weekNumber} className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-white px-2 rounded">
                      <input type="checkbox" checked={creationScope.includes(u.weekNumber)} onChange={e => e.target.checked ? setCreationScope(p => [...p, u.weekNumber]) : setCreationScope(p => p.filter(n => n !== u.weekNumber))} className="rounded text-blue-600 focus:ring-0" />
                      <span className="truncate">W{u.weekNumber}: {u.topicTitle}</span>
                    </label>
                  ))}
                </div>
              )}
              <textarea value={creationInstruction} onChange={e => setCreationInstruction(e.target.value)} placeholder="Specific instructions..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-32 resize-none focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsCreationModalOpen(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-200 rounded-lg">Cancel</button>
              <button onClick={handleAddResource} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/20">Generate</button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between">
              <h3 className="font-bold text-slate-800">Document Settings</h3>
              <button onClick={() => setIsTemplateModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">School Logo</label>
                <div className="flex gap-4">
                  <div onClick={() => logoInputRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-blue-400">
                    {templateConfig.logo ? <img src={templateConfig.logo} className="w-full h-full object-contain p-1" /> : <Upload className="w-6 h-6 text-slate-300" />}
                  </div>
                  <input type="file" ref={logoInputRef} className="hidden" onChange={handleLogoUpload} />
                  <div className="flex-1 space-y-2">
                    <input value={templateConfig.schoolName} onChange={e => setTemplateConfig(p => ({...p, schoolName: e.target.value}))} placeholder="School Name" className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Font Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {['modern', 'classic', 'playful'].map(f => (
                    <button key={f} onClick={() => setTemplateConfig(p => ({...p, font: f as any}))} className={`p-2 border rounded-lg text-sm capitalize ${templateConfig.font === f ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'text-slate-600'}`}>{f}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 text-right">
              <button onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ icon: Icon, label, action }: any) => (
  <div className="flex flex-col items-center justify-center py-32 text-center opacity-60 hover:opacity-100 transition-opacity">
    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Icon className="w-8 h-8 text-slate-300" /></div>
    <h3 className="text-xl font-bold text-slate-700 mb-2">No {label}</h3>
    <button onClick={action} className="flex items-center gap-2 text-blue-600 font-bold hover:underline"><Sparkles className="w-4 h-4" /> Generate Now</button>
  </div>
);

const TEACHER_H2_COLORS = [
  { bg: '#eff6ff', border: '#2563eb', text: '#1e3a8a' }, // 0: Objective — blue
  { bg: '#eef2ff', border: '#4f46e5', text: '#312e81' }, // 1: Key Concepts — indigo
  { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' }, // 2: Materials — green
  { bg: '#fffbeb', border: '#d97706', text: '#78350f' }, // 3: Misconceptions — amber
  { bg: '#faf5ff', border: '#9333ea', text: '#581c87' }, // 4: Differentiation — purple
  { bg: '#f8fafc', border: '#475569', text: '#1e293b' }, // 5: Lesson Flow — slate
  { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' }, // 6+: fallback — green
] as const;

const RenderMarkdown = ({
  children,
  docType = 'teacher',
}: {
  children: string;
  docType?: 'teacher' | 'student';
}) => {
  // Closure counter: resets to 0 on every render call.
  // ReactMarkdown renders synchronously so this is safe.
  let h2Index = 0;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h2: ({ children: h2Children, ...props }) => {
          if (docType === 'teacher') {
            const color =
              TEACHER_H2_COLORS[Math.min(h2Index, TEACHER_H2_COLORS.length - 1)];
            h2Index++;
            return (
              <h2
                style={{
                  background: color.bg,
                  borderLeft: `4px solid ${color.border}`,
                  color: color.text,
                  padding: '10px 16px',
                  borderRadius: '0 8px 8px 0',
                  marginTop: '2rem',
                  marginBottom: '0.75rem',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  letterSpacing: '-0.01em',
                }}
                {...props}
              >
                {h2Children}
              </h2>
            );
          }
          // Student document: dark header bar
          h2Index++;
          return (
            <h2
              style={{
                background: '#0f172a',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '4px',
                marginTop: '2rem',
                marginBottom: '0.75rem',
                fontWeight: 800,
                fontSize: '0.95rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
              {...props}
            >
              {h2Children}
            </h2>
          );
        },
        h1: ({ children: h1Children, ...props }) => {
          if (docType === 'student') {
            return (
              <h1
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  borderBottom: '3px solid #0f172a',
                  paddingBottom: '0.5rem',
                  marginBottom: '1rem',
                }}
                {...props}
              >
                {h1Children}
              </h1>
            );
          }
          return <h1 {...props}>{h1Children}</h1>;
        },
        hr: ({ ...props }) => (
          <hr
            style={{
              border: 'none',
              borderTop: docType === 'student' ? '2px solid #0f172a' : '1px solid #e2e8f0',
              margin: '1.5rem 0',
            }}
            {...props}
          />
        ),
        table: ({ ...props }) => (
          <div className="overflow-x-auto my-6">
            <table
              className="min-w-full text-sm divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden"
              {...props}
            />
          </div>
        ),
        thead: ({ ...props }) => <thead className="bg-slate-50" {...props} />,
        th: ({ ...props }) => (
          <th
            className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider"
            {...props}
          />
        ),
        td: ({ ...props }) => (
          <td className="px-4 py-3 border-t border-slate-200" {...props} />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
};

const NavButton = ({ icon: Icon, label, active, onClick, collapsed, hasContent }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${active ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
    <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
    {!collapsed && <span className={`flex-1 text-left text-sm font-medium ${active ? 'font-bold' : ''}`}>{label}</span>}
    {!collapsed && hasContent && <Check className="w-3 h-3 text-green-500" />}
  </button>
);

export default LessonWorkspace;
