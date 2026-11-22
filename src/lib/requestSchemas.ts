/**
 * Shared request validation for the /api/generate/* routes.
 *
 * These replace `z.custom<T>()`, which type-checks nothing at runtime: an attacker (or a buggy
 * client) could send any shape, unbounded strings, or multi-megabyte blobs and have them flow into
 * prompts and Gemini requests.
 */
import { z } from 'zod';
import type { Classroom, UploadedFile } from '@/lib/types';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BASE64_CHARS } from '@/lib/uploadLimits';

export const uploadedFileSchema = z.object({
  name: z.string().max(200),
  mimeType: z.enum(ALLOWED_UPLOAD_MIME_TYPES),
  data: z
    .string()
    .max(MAX_UPLOAD_BASE64_CHARS)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Attachment must be base64'),
}) as z.ZodType<UploadedFile>;

export const unitSchema = z.object({
  weekNumber: z.number().int().min(0).max(200),
  topicTitle: z.string().max(300),
  summary: z.string().max(2000),
  learningOutcome: z.string().max(2000),
});

/** The classroom fields prompts actually use. Anything else the client sends is dropped. */
export const classroomInputSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().max(100),
  subject: z.string().max(100),
  grade: z.string().max(50),
  curriculum: z.string().max(100),
  studentCount: z.number().int().min(0).max(5000),
  averagePercentile: z.number().min(0).max(100),
  teachingNotes: z.string().max(5000).nullish().transform((v) => v ?? ''),
  learningStyles: z.array(z.string().max(50)).max(20).nullish().transform((v) => v ?? undefined),
  accommodations: z.string().max(5000).nullish().transform((v) => v ?? undefined),
  studentInterests: z.string().max(5000).nullish().transform((v) => v ?? undefined),
}) as unknown as z.ZodType<Classroom>;
