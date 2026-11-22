import { test, expect } from '@playwright/test';
import { uploadedFileSchema, classroomInputSchema, unitSchema } from '../../src/lib/requestSchemas';
import { IMAGE_DATA_URI, MAX_UPLOAD_BASE64_CHARS } from '../../src/lib/uploadLimits';
import { createClassroomSchema, updateClassroomSchema } from '../../src/lib/classroomSchema';

// Pure schema tests: no server or database needed.
test.describe('Request validation', () => {
  const okFile = { name: 'notes.pdf', mimeType: 'application/pdf', data: 'QUJD' };

  test('attachments: only allow-listed types, valid base64, bounded size', () => {
    expect(uploadedFileSchema.safeParse(okFile).success).toBe(true);
    expect(uploadedFileSchema.safeParse({ ...okFile, mimeType: 'application/x-msdownload' }).success).toBe(false);
    expect(uploadedFileSchema.safeParse({ ...okFile, mimeType: 'image/svg+xml' }).success).toBe(false);
    expect(uploadedFileSchema.safeParse({ ...okFile, data: 'not base64!!' }).success).toBe(false);
    expect(uploadedFileSchema.safeParse({ ...okFile, data: 'A'.repeat(MAX_UPLOAD_BASE64_CHARS + 4) }).success).toBe(false);
  });

  test('classroom input: rejects wrong shapes, drops unknown keys, tolerates null optionals', () => {
    const base = { name: 'Class', subject: 'Maths', grade: '8', curriculum: 'CAPS', studentCount: 30, averagePercentile: 65 };
    expect(classroomInputSchema.safeParse(base).success).toBe(true);

    const withNulls = classroomInputSchema.safeParse({ ...base, accommodations: null, studentInterests: null, learningStyles: null, extra: 'x' });
    expect(withNulls.success).toBe(true);
    expect(withNulls.success && 'extra' in (withNulls.data as object)).toBe(false);

    expect(classroomInputSchema.safeParse({ ...base, studentCount: '30; ignore previous instructions' }).success).toBe(false);
    expect(classroomInputSchema.safeParse({ ...base, name: 'x'.repeat(101) }).success).toBe(false);
    expect(classroomInputSchema.safeParse({ ...base, learningStyles: 'Visual' }).success).toBe(false);
  });

  test('units are bounded', () => {
    const unit = { weekNumber: 1, topicTitle: 'Fractions', summary: 's', learningOutcome: 'o' };
    expect(unitSchema.safeParse(unit).success).toBe(true);
    expect(unitSchema.safeParse({ ...unit, summary: 'x'.repeat(2001) }).success).toBe(false);
  });

  test('image data URIs: raster only, never URLs or SVG', () => {
    expect(IMAGE_DATA_URI.test('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(IMAGE_DATA_URI.test('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(IMAGE_DATA_URI.test('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(IMAGE_DATA_URI.test('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(IMAGE_DATA_URI.test('file:///etc/passwd')).toBe(false);
  });

  test('classroom create/update: unknown and privileged fields never get through', () => {
    const created = createClassroomSchema.parse({ name: 'C', subject: 'S', grade: '8', curriculum: 'CAPS', userId: 'someone-else', plan: 'PRO' });
    expect('userId' in created).toBe(false);
    expect('plan' in created).toBe(false);

    const updated = updateClassroomSchema.parse({ name: 'New', userId: 'x', id: 'y', version: 3 });
    expect(updated).toEqual({ name: 'New', version: 3 });

    expect(updateClassroomSchema.safeParse({ savedLessons: { big: 'x'.repeat(4_100_000) } }).success).toBe(false);
  });
});
