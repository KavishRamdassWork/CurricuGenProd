import { GoogleGenAI, Type } from "@google/genai";
import { Blueprint, WeekUnit, UploadedFile, Student, ClassAnalysis, Classroom } from "@/lib/types";
import { Pinecone } from '@pinecone-database/pinecone';
import { getPhaseForGrade } from './curriculumHelper';

// Lazy initialization of Pinecone to avoid build-time errors if API key is missing
let pc: Pinecone | null = null;
const getPinecone = () => {
  if (!pc) {
    if (!process.env.PINECONE_API_KEY) {
      console.warn("PINECONE_API_KEY is not set.");
      return null;
    }
    pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return pc;
};
const indexName = process.env.PINECONE_INDEX_NAME || '';

const SYSTEM_INSTRUCTION = `
You are EDU-MASTER, a world-class educational content specialist.
Your goal is to provide structured, curriculum-aligned content.
`;

export function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");
  return new GoogleGenAI({ apiKey });
}

/** Sanitize user input to prevent prompt injection */
export function sanitizeInput(input: string, maxLength = 1000): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/```/g, '')
    .slice(0, maxLength)
    .trim();
}

export async function getCurriculumContext(classroom: Classroom, topic: string): Promise<string> {
  const ai = getAIClient();
  const phase = getPhaseForGrade(classroom.grade);
  
  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: topic,
    });
    
    const embedding = response.embeddings?.[0]?.values;
    if (!embedding) return "";

    const pinecone = getPinecone();
    if (!pinecone) return "";
    const index = pinecone.Index(indexName);
    const queryResponse = await index.query({
      vector: embedding,
      topK: 3,
      includeMetadata: true,
      filter: {
        curriculum: { "$eq": classroom.curriculum },
        subject: { "$eq": classroom.subject },
        phase: { "$eq": phase }
      }
    });

    if (queryResponse.matches && queryResponse.matches.length > 0) {
      return queryResponse.matches.map(m => m.metadata?.content).join("\\n\\n");
    }
  } catch (error) {
    console.warn("Vector DB error (or no pilot context found):", error);
  }
  return "";
}

export async function generateBlueprintServer(classroom: Classroom): Promise<Blueprint> {
  const ai = getAIClient();
  const prompt = `
    Create a detailed and REALISTIC curriculum blueprint specifically for this class profile:

    CLASS PROFILE:
    - Name: ${sanitizeInput(classroom.name)}
    - Subject: ${sanitizeInput(classroom.subject)}
    - Grade: ${sanitizeInput(classroom.grade)}
    - Standard: ${sanitizeInput(classroom.curriculum)}
    - Class Size: ${classroom.studentCount} students
    - Average Performance: ${classroom.averagePercentile}% (Adjust difficulty accordingly)
    - Teacher Notes/Context: "${sanitizeInput(classroom.teachingNotes, 500)}"
    ${classroom.learningStyles?.length ? `- Learning Styles: ${classroom.learningStyles.join(', ')}` : ""}
    ${classroom.accommodations ? `- Special Accommodations: ${sanitizeInput(classroom.accommodations, 300)}` : ""}
    ${classroom.studentInterests ? `- Student Interests: ${sanitizeInput(classroom.studentInterests, 300)}` : ""}

    CRITICAL INSTRUCTIONS:
    1. **OPTIMIZATION**: Since the class average is ${classroom.averagePercentile}%, adjust the pacing and complexity.
       - If < 50%: Include more revision weeks and foundational building blocks.
       - If > 80%: Include extension/enrichment weeks.
    2. **COMPLETENESS**: Cover all required topics for ${sanitizeInput(classroom.grade)} ${sanitizeInput(classroom.subject)}.
    3. **REALISM**: Assume students are learning this content for the first time.
    4. **STRUCTURE**: Include specific "Review & Consolidation" weeks where appropriate.
    
    I need a structured JSON list of the weekly topics for the FULL YEAR or TERM (based on standard).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          units: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                weekNumber: { type: Type.INTEGER },
                topicTitle: { type: Type.STRING },
                summary: { type: Type.STRING },
                learningOutcome: { type: Type.STRING }
              },
              required: ["weekNumber", "topicTitle", "summary", "learningOutcome"]
            }
          }
        },
        required: ["title", "description", "units"]
      }
    },
  });

  const text = response.text;
  if (!text) throw new Error("No data returned");
  return JSON.parse(text) as Blueprint;
}

export async function generateLessonPlanServer(classroom: Classroom, units: WeekUnit[], file?: UploadedFile): Promise<string> {
  const ai = getAIClient();
  const contextText = await getCurriculumContext(classroom, units[0].topicTitle);
  const basePrompt = `
    Generate a HIGH-QUALITY TEACHER'S GUIDE (LESSON PLAN) for:
    Class: ${sanitizeInput(classroom.name)}
    Subject: ${sanitizeInput(classroom.subject)}
    Grade: ${sanitizeInput(classroom.grade)}
    Topic: ${sanitizeInput(units[0].topicTitle)}
    Outcome: ${sanitizeInput(units[0].learningOutcome)}
    Context: ${sanitizeInput(units[0].summary)}

    CLASS SPECIFICS:
    - Size: ${classroom.studentCount} students
    - Performance Level: ${classroom.averagePercentile}% (adjust difficulty accordingly)
    - Notes: ${sanitizeInput(classroom.teachingNotes, 500)}
    ${classroom.learningStyles?.length ? `- Learning Styles: ${classroom.learningStyles.join(', ')}` : ""}
    ${classroom.accommodations ? `- Accommodations Needed (CRITICAL): ${sanitizeInput(classroom.accommodations, 300)}` : ""}
    ${classroom.studentInterests ? `- Student Interests: ${sanitizeInput(classroom.studentInterests, 300)}` : ""}
    (Tailor every activity, example, and timing to this specific group.)

    ${file ? "CRITICAL: A reference document has been provided. YOU MUST use its terminology, methods, and worked examples to ensure alignment." : ""}

    ──────────────────────────────────────────
    ${contextText ? `OFFICIAL CURRICULUM CONTEXT — YOU MUST ADHERE TO THIS:\n${contextText}\n──────────────────────────────────────────` : ""}

    OUTPUT FORMAT — CRITICAL: Use EXACTLY these ## headings in EXACTLY this order. Do not add, rename, reorder, or remove any heading. Write freely within each section.

    ## Objective & Success Criteria
    [Lesson objective and 2–3 measurable success criteria]

    ## Key Concepts & Vocabulary
    [Key terms with brief definitions]

    ## Materials Needed
    [All required materials, resources, and handouts]

    ## Common Misconceptions
    [2–3 typical student errors or misconceptions for this topic with how to address them]

    ## Differentiation Strategies
    [Support strategies for struggling learners AND extension activities for advanced learners]

    ## Lesson Flow
    [Full lesson activities with time allocations — Hook/Introduction, Direct Instruction with step-by-step worked examples, Guided Practice, Independent Practice]

    ## Closure & Exit Ticket
    [How to close the lesson and the exit ticket activity]
  `;

  const parts: any[] = [{ text: basePrompt }];
  if (file) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: { parts },
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.4 }
  });
  return response.text || "Failed to generate lesson plan.";
}

export async function generateWorksheetServer(classroom: Classroom, unit: WeekUnit, type: string = "Standard", file?: UploadedFile, userInstruction?: string): Promise<string> {
  const ai = getAIClient();
  const basePrompt = `
    Create a ${sanitizeInput(type).toUpperCase()} STUDENT WORKSHEET for:
    Class: ${sanitizeInput(classroom.name)} (${sanitizeInput(classroom.grade)} ${sanitizeInput(classroom.subject)})
    Topic: ${sanitizeInput(unit.topicTitle)}
    
    Class Average: ${classroom.averagePercentile}% (Adjust difficulty).
    ${classroom.accommodations ? `Accommodations: ${sanitizeInput(classroom.accommodations, 300)}` : ""}
    ${classroom.studentInterests ? `Incorporate these interests if possible: ${sanitizeInput(classroom.studentInterests, 300)}` : ""}
    ${userInstruction ? `IMPORTANT USER INSTRUCTION: "${sanitizeInput(userInstruction, 300)}"` : ""}
    ${file ? "Reference the attached document for question styles and terminology." : ""}

    Requirements:
    - Title: ${sanitizeInput(unit.topicTitle)} - ${sanitizeInput(type)} Worksheet
    - Instructions for students
    - **Section A**: Basic Understanding (Recall)
    - **Section B**: Application (Problem Solving)
    - **Section C**: Challenge (Critical Thinking)
    
    Format: Print-ready Markdown. DO NOT INCLUDE ANSWERS.
  `;

  const parts: any[] = [{ text: basePrompt }];
  if (file) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: { parts },
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.4 }
  });
  return response.text || "Failed to generate worksheet.";
}

export async function generateAssignmentServer(classroom: Classroom, unit: WeekUnit, file?: UploadedFile, userInstruction?: string): Promise<string> {
  const ai = getAIClient();
  const basePrompt = `
    Create a RELEVANT HOMEWORK ASSIGNMENT for:
    Class: ${sanitizeInput(classroom.name)} (${sanitizeInput(classroom.grade)})
    Topic: ${sanitizeInput(unit.topicTitle)}
    
    Class Notes: ${sanitizeInput(classroom.teachingNotes, 300)}
    ${classroom.accommodations ? `Accommodations: ${sanitizeInput(classroom.accommodations, 300)}` : ""}
    ${classroom.learningStyles?.length ? `Learning Styles: ${classroom.learningStyles.join(', ')}` : ""}
    ${classroom.studentInterests ? `Student Interests: ${sanitizeInput(classroom.studentInterests, 300)}` : ""}
    ${userInstruction ? `IMPORTANT USER INSTRUCTION: "${sanitizeInput(userInstruction, 300)}"` : ""}
    
    Requirements:
    - Step-by-step instructions.
    - Tasks that specifically reinforce: ${sanitizeInput(unit.learningOutcome)}.
    - Due Date Placeholder.
    - Assessment Rubric.
    
    Format: Print-ready Markdown.
  `;
  const parts: any[] = [{ text: basePrompt }];
  if (file) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: { parts },
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.5 }
  });
  return response.text || "Failed to generate assignment.";
}

export async function generateAssessmentServer(classroom: Classroom, unit: WeekUnit, file?: UploadedFile, userInstruction?: string, scopeUnits?: WeekUnit[]): Promise<string> {
  const ai = getAIClient();
  let scopeText = `Topic: ${sanitizeInput(unit.topicTitle)}`;
  if (scopeUnits && scopeUnits.length > 0) {
    scopeText = `COVERING THE FOLLOWING TOPICS:\n` + scopeUnits.map(u => `- Week ${u.weekNumber}: ${sanitizeInput(u.topicTitle)} (${sanitizeInput(u.summary, 200)})`).join('\n');
  }

  const basePrompt = `
    Create a FORMAL TEST / EXAM for:
    Class: ${sanitizeInput(classroom.name)} (${sanitizeInput(classroom.grade)} ${sanitizeInput(classroom.subject)})
    
    SCOPE:
    ${scopeText}
    
    Class Average: ${classroom.averagePercentile}% (Ensure appropriate difficulty curve).
    ${classroom.accommodations ? `MUST INCLUDE Accommodations for: ${sanitizeInput(classroom.accommodations, 300)}` : ""}
    ${userInstruction ? `IMPORTANT USER INSTRUCTION: "${sanitizeInput(userInstruction, 300)}"` : ""}

    Requirements:
    - Total Marks (e.g., 50)
    - Time Allowance
    - Variety of Question Types (MCQ, Short Answer, Essay).
    - Professional layout.
    
    Format: Print-ready Markdown. DO NOT INCLUDE ANSWERS here.
  `;
  const parts: any[] = [{ text: basePrompt }];
  if (file) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: { parts },
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
  });
  return response.text || "Failed to generate assessment.";
}

export async function generateMemoServer(contentToGrade: string, classroom: Classroom): Promise<string> {
  const ai = getAIClient();
  const prompt = `
    Create a COMPREHENSIVE MEMORANDUM (ANSWER KEY) for the following assessment/worksheet.
    Subject: ${sanitizeInput(classroom.subject)}
    Grade: ${sanitizeInput(classroom.grade)}

    CONTENT TO GRADE:
    ${contentToGrade.slice(0, 8000)}

    INSTRUCTIONS:
    - Provide clear, accurate answers.
    - Include mark allocations.
    - Show working out for math/science.
    - Format as a clear table or list.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.2 }
  });
  return response.text || "Failed to generate memo.";
}

export async function generatePresentationServer(classroom: Classroom, units: WeekUnit[]): Promise<string> {
  const ai = getAIClient();
  const prompt = `
    Create a SLIDE DECK OUTLINE for:
    Topic: ${sanitizeInput(units[0].topicTitle)}
    Class: ${sanitizeInput(classroom.name)} (${sanitizeInput(classroom.grade)})
    Student Level: ${classroom.averagePercentile}% average.
    ${classroom.learningStyles?.length ? `- Learning Styles: ${classroom.learningStyles.join(', ')}` : ""}

    OUTPUT FORMAT — CRITICAL: Repeat this EXACT pattern for every slide. Do not vary the structure.

    ## Slide 1: [Title Slide]
    ### Content
    - [Title of topic]
    - [Subtitle or hook question]
    ### Speaker Notes
    [What the teacher says to open, timing for this slide]
    ### Suggested Visual
    [Description of image, diagram, or visual to display]

    ## Slide 2: [Learning Objectives]
    ### Content
    - [Objective 1]
    - [Objective 2]
    - [Objective 3]
    ### Speaker Notes
    [Talking points]
    ### Suggested Visual
    [Visual description]

    [Continue for as many slides as needed to cover the topic thoroughly — minimum 6 slides]

    ## Slide [N]: Summary & Exit Ticket
    ### Content
    - [3 key takeaways]
    - Exit ticket question: [question]
    ### Speaker Notes
    [Closing remarks and how to run the exit ticket]
    ### Suggested Visual
    [Summary graphic or mind map description]
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.4 }
  });
  return response.text || "Failed to generate slides.";
}

export async function generateGameServer(classroom: Classroom, unit: WeekUnit, file?: UploadedFile): Promise<string> {
  const ai = getAIClient();
  const basePrompt = `
    Design an engaging CLASSROOM GAME or ACTIVE LEARNING ACTIVITY for:
    Class: ${sanitizeInput(classroom.name)} (${sanitizeInput(classroom.grade)})
    Topic: ${sanitizeInput(unit.topicTitle)}
    Class Size: ${classroom.studentCount} students.
    ${classroom.learningStyles?.length ? `Learning Styles to target: ${classroom.learningStyles.join(', ')}.` : ""}
    ${classroom.studentInterests ? `Theme the game around: ${sanitizeInput(classroom.studentInterests, 300)} if possible.` : ""}
    ${classroom.accommodations ? `Ensure the game accommodates: ${sanitizeInput(classroom.accommodations, 300)}.` : ""}
    ${file ? "Reference the attached document for curriculum alignment." : ""}

    OUTPUT FORMAT — CRITICAL: Use EXACTLY these ## headings in EXACTLY this order.

    ## Game Overview
    [Name of game, type (competitive/collaborative/individual), and 1-sentence description]

    ## Learning Objectives
    [What students will practise or consolidate through this game]

    ## Materials Required
    [Everything the teacher needs to prepare]

    ## Setup Instructions
    [Step-by-step setup before the game begins]

    ## How to Play
    [Clear step-by-step rules a student could read and follow]

    ## Differentiation Options
    [How to make it easier for struggling learners and harder for advanced learners]

    ## Debrief Questions
    [3–5 discussion questions to run after the game to consolidate learning]
  `;
  const parts: any[] = [{ text: basePrompt }];
  if (file) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: { parts },
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.7 }
  });
  return response.text || "Failed to generate game.";
}

export async function generateResourcesServer(classroom: Classroom, unit: WeekUnit, file?: UploadedFile): Promise<string> {
  const ai = getAIClient();
  const basePrompt = `
    Curate a list of EXTRA RESOURCES and ENRICHMENT MATERIAL for:
    Class: ${sanitizeInput(classroom.name)} (${sanitizeInput(classroom.grade)})
    Topic: ${sanitizeInput(unit.topicTitle)}
    ${file ? "Reference the attached document for context." : ""}

    OUTPUT FORMAT — CRITICAL: Use EXACTLY these ## headings in EXACTLY this order.

    ## Overview
    [1-paragraph summary of why these resources support this topic]

    ## Recommended Readings
    [Textbook chapters, articles, or books with brief annotations]

    ## Online Resources & Videos
    [URLs or platform names with titles and brief descriptions — include YouTube, Khan Academy, etc. where relevant]

    ## Extension Activities
    [2–3 enrichment tasks for students who want to go deeper]

    ## Teacher Notes
    [Tips for how to use these resources in class or assign them as homework]
  `;
  const parts: any[] = [{ text: basePrompt }];
  if (file) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: { parts },
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.5 }
  });
  return response.text || "Failed to generate resources.";
}

export async function refineContentServer(currentContent: string, instruction: string, contextType: string, file?: UploadedFile): Promise<string> {
  const ai = getAIClient();
  const basePrompt = `
    You are an expert educational editor. 
    User Instruction: "${sanitizeInput(instruction, 300)}"

    Current Content:
    ${currentContent.slice(0, 30000)}

    Task: Rewrite the content to satisfy the instruction. Return ONLY the updated Markdown.
  `;

  const parts: any[] = [{ text: basePrompt }];
  if (file) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: { parts },
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
  });
  return response.text || currentContent;
}

export async function analyzeClassPerformanceServer(students: Student[]): Promise<ClassAnalysis> {
  const ai = getAIClient();
  const studentsData = students.map(s => ({
    name: s.name,
    average: s.average,
    marks: s.marks
  }));

  const prompt = `
    Analyze the following student performance data.
    DATA: ${JSON.stringify(studentsData, null, 2).slice(0, 5000)}

    Return JSON:
    {
      "summary": "Summary string",
      "atRiskStudents": [ { "name": "", "reason": "", "intervention": "" } ],
      "generalTrends": "String"
    }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: { responseMimeType: "application/json", temperature: 0.2 }
  });

  const text = response.text;
  if (!text) throw new Error("Analysis failed");
  return JSON.parse(text) as ClassAnalysis;
}

export async function generateEducationalImageServer(unit: WeekUnit): Promise<string> {
  const ai = getAIClient();
  const prompt = `
    Create an educational illustration suitable for a slide or worksheet.
    Topic: ${sanitizeInput(unit.topicTitle)}
    Concept: ${sanitizeInput(unit.summary, 300)}
    Style: Clear, textbook-style illustration, suitable for K-12 education. High contrast, clean lines.
  `;

  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '16:9'
      }
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const img = response.generatedImages[0];
      if (img.image) return `data:${img.image.mimeType};base64,${img.image.imageBytes}`;
    }
    return "";
  } catch (error: any) {
    console.error("Image generation failed", error);
    throw error;
  }
}
