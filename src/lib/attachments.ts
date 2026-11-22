import type { Part } from '@google/genai';
import type { UploadedFile } from '@/lib/types';
import { ATTACHMENT_PREAMBLE, decodeTextUpload, fence } from '@/lib/promptSafety';

/** Longest decoded text upload (code points) that is placed in the prompt. */
const TEXT_ATTACHMENT_MAX = 20000;

/**
 * Build the content parts for a prompt plus an optional uploaded file.
 * - No file: the prompt alone.
 * - Text upload: decoded and cleaned server-side, appended inside a fence; never sent as inlineData.
 * - Anything else (PDF, image): cannot be inspected, so it is sent as inlineData after a fixed preamble
 *   telling the model to treat it as reference material only.
 */
export function attachmentParts(basePrompt: string, file?: UploadedFile): Part[] {
  if (!file) return [{ text: basePrompt }];

  const decoded = decodeTextUpload(file);
  if (decoded !== null) {
    return [
      {
        text: `${basePrompt}\n\n${ATTACHMENT_PREAMBLE}\n${fence('attachment', decoded, TEXT_ATTACHMENT_MAX)}`,
      },
    ];
  }

  return [
    { text: basePrompt },
    { text: ATTACHMENT_PREAMBLE },
    { inlineData: { mimeType: file.mimeType, data: file.data } },
  ];
}
