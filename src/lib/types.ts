
export interface WeekUnit {
  weekNumber: number;
  topicTitle: string;
  summary: string;
  learningOutcome: string;
}

export interface Blueprint {
  title: string;
  description: string;
  units: WeekUnit[];
}

export interface GenerationRequest {
  subject: string;
  grade: string;
  curriculum: string;
  focus?: string;
  notes?: string;
}

export interface EducationalResource {
  id: string;
  type: 'worksheet' | 'assignment' | 'test';
  title: string;
  content: string;
  memo: string | null;
}

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

export enum AppState {
  CLASS_LIST = 'class_list',
  DASHBOARD = 'dashboard',
  LESSON_VIEW = 'lesson_view',
}

export interface Section {
  id: string;
  title: string;
  content: string;
}

export interface UploadedFile {
  name: string;
  mimeType: string;
  data: string; // Base64 string
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export interface TemplateConfig {
  schoolName: string;
  logo: string | null; // Base64
  font: 'modern' | 'classic' | 'playful';
  layout: 'standard' | 'formal' | 'vibrant';
}

// --- Class Management Types ---

export interface Student {
  id: string;
  name: string;
  marks?: Record<string, number>; // key is Assessment Name, value is mark
  average?: number;
  riskLevel?: 'High' | 'Medium' | 'Low';
  aiNotes?: string;
}

export interface ClassAnalysis {
  summary: string;
  atRiskStudents: { name: string; reason: string; intervention: string }[];
  generalTrends: string;
}

export interface Classroom {
  id: string;
  name: string;

  // Configuration / Profile
  subject: string;
  grade: string;
  curriculum: string;
  studentCount: number;
  averagePercentile: number; // 0-100
  teachingNotes: string;

  // Advanced Student Customization
  learningStyles?: string[];
  accommodations?: string;
  studentInterests?: string;

  // Data
  students: Student[];
  assessmentColumns: string[];
  analysis?: ClassAnalysis;
  blueprint?: Blueprint;
  savedLessons?: Record<string, LessonContent>;
}
