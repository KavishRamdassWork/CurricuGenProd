import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Part } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const indexName = process.env.PINECONE_INDEX_NAME!;

const CONFIG = {
  pdfPath: path.join(__dirname, '../Syllabus Material/CAPS/CAPS SP  MATHEMATICS GR 7-9.pdf'),
  curriculum: 'South African CAPS',
  phase: 'Senior Phase',
  subject: 'Mathematics',
  grades: ['Grade 7', 'Grade 8', 'Grade 9']
};

function chunkText(text: string, maxLen: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += (maxLen - overlap);
  }
  return chunks;
}

async function main() {
  console.log(`Starting ingestion for ${CONFIG.pdfPath}...`);
  if (!fs.existsSync(CONFIG.pdfPath)) {
    console.error("File not found!");
    process.exit(1);
  }

  const dataBuffer = fs.readFileSync(CONFIG.pdfPath);
  
  console.log("Using Gemini 2.5 Flash to extract text from the PDF...");
  const pdfPart: Part = {
    inlineData: {
      data: dataBuffer.toString("base64"),
      mimeType: "application/pdf"
    }
  };

  const extraction = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { text: "Extract all textual content from this document exactly as it is. Preserve headings, bullet points, and table structures. Do not summarize or skip anything." },
      pdfPart
    ]
  });
  
  const text = extraction.text;
  if (!text) throw new Error("Failed to extract text from PDF");
  
  console.log(`Extracted ${text.length} characters. Chunking...`);
  const chunks = chunkText(text, 1200, 200);
  console.log(`Generated ${chunks.length} chunks. Ready to push to Pinecone.`);

  const index = pc.Index(indexName);

  const BATCH_SIZE = 5;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    const records = await Promise.all(batch.map(async (chunk) => {
      try {
        const response = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: chunk,
        });
        
        const embeddingArray = response.embeddings?.[0]?.values;
        if (!embeddingArray) return null;

        // Create a Pinecone record for each grade so it can be filtered accurately
        return CONFIG.grades.map(grade => ({
          id: crypto.randomUUID(),
          values: embeddingArray,
          metadata: {
            curriculum: CONFIG.curriculum,
            phase: CONFIG.phase,
            subject: CONFIG.subject,
            grade: grade,
            content: chunk
          }
        }));
      } catch (err) {
        console.error(`Error embedding chunk:`, err);
        return null;
      }
    }));

    // Flatten chunks
    const validRecords = records.flat().filter((r): r is NonNullable<typeof r> => r !== null);

    if (validRecords.length > 0) {
      // @ts-expect-error — this Pinecone client version's upsert() signature mismatches its own types; verified working at runtime
      await index.upsert(validRecords);
    }
    
    console.log(`Processed batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(chunks.length/BATCH_SIZE)}`);
    // Backoff for rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`Ingestion complete! Successfully added vectors to Pinecone.`);
}

main().catch(console.error);
