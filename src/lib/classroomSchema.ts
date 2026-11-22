/**
 * Request validation for the /api/classrooms routes.
 *
 * Text fields are length-capped and the JSON blobs are size-capped, so a single request cannot
 * write megabytes into one row (every classroom GET returns the whole row).
 */
import { z } from 'zod';

/**
 * Largest JSON document accepted for any one blob column, measured as serialised text. Sized to the
 * hosting platform's request-body limit (~4.5 MB): lessons embed generated images as base64, so a
 * lower cap would reject legitimate saves. (Moving images to object storage would remove the need.)
 */
export const MAX_JSON_BYTES = 4_000_000;

const jsonBlob = z.unknown().refine(
  (value) => {
    try {
      return JSON.stringify(value ?? null).length <= MAX_JSON_BYTES;
    } catch {
      return false;
    }
  },
  { message: `Data too large (max ${MAX_JSON_BYTES} bytes)` }
);

const profileFields = {
  name: z.string().trim().min(1).max(100),
  subject: z.string().trim().min(1).max(100),
  grade: z.string().trim().min(1).max(50),
  curriculum: z.string().trim().min(1).max(100),
  studentCount: z.coerce.number().int().min(1).max(500),
  averagePercentile: z.coerce.number().int().min(0).max(100),
  teachingNotes: z.string().max(1000),
  learningStyles: z.array(z.string().max(50)).max(20),
  accommodations: z.string().max(500).nullable(),
  studentInterests: z.string().max(500).nullable(),
};

const blobFields = {
  blueprint: jsonBlob,
  students: jsonBlob,
  assessmentColumns: jsonBlob,
  savedLessons: jsonBlob,
  analysis: jsonBlob,
};

/** POST body: the profile. Missing optional fields fall back to the same defaults as before. */
export const createClassroomSchema = z.object({
  name: profileFields.name,
  subject: profileFields.subject,
  grade: profileFields.grade,
  curriculum: profileFields.curriculum,
  studentCount: profileFields.studentCount.catch(30),
  averagePercentile: profileFields.averagePercentile.catch(65),
  teachingNotes: profileFields.teachingNotes.nullish().transform((v) => v ?? ''),
  learningStyles: profileFields.learningStyles.catch([]),
  accommodations: profileFields.accommodations.optional().transform((v) => v || null),
  studentInterests: profileFields.studentInterests.optional().transform((v) => v || null),
});

/** PATCH body: any subset of the writable fields; unknown keys are dropped. */
export const updateClassroomSchema = z
  .object({
    ...profileFields,
    ...blobFields,
    /** The version the client last saw. When present the write only succeeds if it is still current. */
    version: z.number().int().min(0),
  })
  .partial();
