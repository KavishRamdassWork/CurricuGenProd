/**
 * Upload limits shared by the browser (to fail fast with a clear message) and the API routes (which
 * enforce them - the client check is a convenience, never the security boundary).
 */

/** Attachment limit in bytes (~3 MB). Hosting platforms cap request bodies near 4.5 MB, and base64 adds a third. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
/** The same limit as base64 characters. */
export const MAX_UPLOAD_BASE64_CHARS = 4_000_000;

/** Types Gemini can read inline and that make sense as teaching context. */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
  'text/csv',
] as const;
export const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv';

/** School logo: small raster images only (no SVG, which can carry script). */
export const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_LOGO_BYTES = 1024 * 1024;
export const LOGO_ACCEPT = '.png,.jpg,.jpeg,.webp';
/** Pattern a logo / slide image data URI must match. */
export const IMAGE_DATA_URI = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Marks spreadsheet limit in bytes. */
export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024;
