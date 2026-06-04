/**
 * Client-side service layer.
 * All functions call our own secure Next.js API routes.
 * The Gemini API key is NEVER exposed to the browser.
 */
import { Blueprint, WeekUnit, UploadedFile, Student, ClassAnalysis, Classroom } from './types';

async function apiPost<T>(endpoint: string, body: object): Promise<T> {
  const res = await fetch(`/api/generate/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed', code: 'UNKNOWN' }));
    const error: any = new Error(err.error || `Request failed with status ${res.status}`);
    error.code = err.code || 'UNKNOWN';
    throw error;
  }
  return res.json();
}

export const generateBlueprint = async (classroom: Classroom): Promise<Blueprint> => {
  const data = await apiPost<{ blueprint: Blueprint }>('blueprint', { classroom });
  return data.blueprint;
};

export const generateLessonPlan = async (classroom: Classroom, units: WeekUnit[], file?: UploadedFile): Promise<string> => {
  const data = await apiPost<{ content: string }>('lesson-plan', { classroom, units, file });
  return data.content;
};

export const generateWorksheet = async (classroom: Classroom, unit: WeekUnit, type?: string, file?: UploadedFile, userInstruction?: string): Promise<string> => {
  const data = await apiPost<{ content: string }>('worksheet', { classroom, unit, type, file, userInstruction });
  return data.content;
};

export const generateAssignment = async (classroom: Classroom, unit: WeekUnit, file?: UploadedFile, userInstruction?: string): Promise<string> => {
  const data = await apiPost<{ content: string }>('assignment', { classroom, unit, file, userInstruction });
  return data.content;
};

export const generateAssessment = async (classroom: Classroom, unit: WeekUnit, file?: UploadedFile, userInstruction?: string, scopeUnits?: WeekUnit[]): Promise<string> => {
  const data = await apiPost<{ content: string }>('assessment', { classroom, unit, file, userInstruction, scopeUnits });
  return data.content;
};

export const generateMemo = async (contentToGrade: string, classroom: Classroom): Promise<string> => {
  const data = await apiPost<{ content: string }>('memo', { contentToGrade, classroom });
  return data.content;
};

export const generatePresentation = async (classroom: Classroom, units: WeekUnit[]): Promise<string> => {
  const data = await apiPost<{ content: string }>('presentation', { classroom, units });
  return data.content;
};

export const generateGame = async (classroom: Classroom, unit: WeekUnit, file?: UploadedFile): Promise<string> => {
  const data = await apiPost<{ content: string }>('game', { classroom, unit, file });
  return data.content;
};

export const generateResources = async (classroom: Classroom, unit: WeekUnit, file?: UploadedFile): Promise<string> => {
  const data = await apiPost<{ content: string }>('resources', { classroom, unit, file });
  return data.content;
};

export const refineContent = async (currentContent: string, instruction: string, contextType: string, file?: UploadedFile): Promise<string> => {
  const data = await apiPost<{ content: string }>('refine', { currentContent, instruction, contextType, file });
  return data.content;
};

export const analyzeClassPerformance = async (students: Student[]): Promise<ClassAnalysis> => {
  const data = await apiPost<{ analysis: ClassAnalysis }>('analyze', { students });
  return data.analysis;
};

export const generateEducationalImage = async (unit: WeekUnit, description?: string): Promise<string> => {
  const data = await apiPost<{ imageUrl: string }>('image', { unit, description });
  return data.imageUrl;
};
