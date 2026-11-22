import { CANARY } from '@/lib/promptSafety';

export type GenKind =
  | 'blueprint'
  | 'lesson-plan'
  | 'worksheet'
  | 'assignment'
  | 'assessment'
  | 'memo'
  | 'presentation'
  | 'game'
  | 'resources'
  | 'refine'
  | 'analyze';

/** The model refused or the provider blocked the response. */
export class ContentBlockedError extends Error {
  constructor(public reason: 'SAFETY' | 'LEAK') {
    super(`Model output blocked: ${reason}`);
    this.name = 'ContentBlockedError';
  }
}

/** The model returned nothing usable or missed the required structure. */
export class MalformedOutputError extends Error {
  constructor(message = 'Model output was empty or malformed') {
    super(message);
    this.name = 'MalformedOutputError';
  }
}

export type ModelMeta = { finishReason?: string; blockReason?: string };

const BLOCKING_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII']);

/** Kinds whose output is JSON and must not be rewritten. */
const JSON_KINDS: ReadonlySet<GenKind> = new Set<GenKind>(['blueprint', 'analyze']);

const REQUIRED_HEADINGS: Partial<Record<GenKind, string[]>> = {
  'lesson-plan': [
    'Objective & Success Criteria',
    'Key Concepts & Vocabulary',
    'Materials Needed',
    'Common Misconceptions',
    'Differentiation Strategies',
    'Lesson Flow',
    'Closure & Exit Ticket',
  ],
  game: [
    'Game Overview',
    'Learning Objectives',
    'Materials Required',
    'Setup Instructions',
    'How to Play',
    'Differentiation Options',
    'Debrief Questions',
  ],
  resources: [
    'Overview',
    'Recommended Readings',
    'Online Resources & Videos',
    'Extension Activities',
    'Teacher Notes',
  ],
  memo: ['Marking Guidelines', 'Answers'],
};

const MIN_SLIDES = 3;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hasHeading(text: string, heading: string): boolean {
  return new RegExp(`^##\\s+${escapeRegExp(heading)}`, 'im').test(text);
}

function checkStructure(kind: GenKind, text: string): void {
  if (kind === 'presentation') {
    const slides = text.match(/^##\s+Slide\s+\d+/gim) ?? [];
    if (slides.length < MIN_SLIDES) throw new MalformedOutputError('Presentation has too few slides');
    return;
  }
  const required = REQUIRED_HEADINGS[kind];
  if (!required) return;
  for (const heading of required) {
    if (!hasHeading(text, heading)) throw new MalformedOutputError(`Missing section: ${heading}`);
  }
}

// Only these tag names are ever removed. Everything else (including bare < and >) is left alone.
const BLOCK_TAG_NAMES = 'script|iframe|object|embed|style|link|meta|form|input|button|svg|img|base';
// script/style are removed together with their contents.
const SCRIPT_STYLE_BLOCK = /<(script|style)(?![\w-])[^<>]*>[\s\S]*?<\/\1\s*>/gi;
const LISTED_TAG = new RegExp(`</?(?:${BLOCK_TAG_NAMES})(?![\\w-])[^<>]*>`, 'gi');
// <a> is a one-letter name that collides with maths such as "x<a and y>b", so it only matches
// when it has no attributes or only name=value attributes.
const ANCHOR_TAG = /<a(?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))*\s*\/?>|<\/a\s*>/gi;

const MD_IMAGE = /!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/g;
const MD_LINK = /\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/g;

function stripListedTags(text: string): string {
  let current = text;
  // Repeat so that removing one tag cannot assemble another (e.g. "<scr<b>ipt>").
  for (let i = 0; i < 5; i++) {
    const next = current
      .replace(SCRIPT_STYLE_BLOCK, '')
      .replace(LISTED_TAG, '')
      .replace(ANCHOR_TAG, '');
    if (next === current) break;
    current = next;
  }
  return current;
}

function sanitiseMarkdown(kind: GenKind, text: string): string {
  const keepUrls = kind === 'resources';
  return stripListedTags(
    text
      .replace(MD_IMAGE, (_m, alt: string) => alt)
      .replace(MD_LINK, (_m, label: string, target: string) => {
        if (!keepUrls) return label;
        const url = target.trim().split(/\s+/)[0] ?? '';
        if (!url || label.trim() === url) return label || url;
        return `${label} (${url})`;
      }),
  );
}

/**
 * Screen raw model output before it is stored or returned.
 * Order: provider block signals, empty output, canary leak, required structure, markdown hygiene.
 * JSON kinds are returned unchanged once they pass the block, empty and canary checks.
 */
export function screenOutput(kind: GenKind, text: string | undefined, meta: ModelMeta = {}): string {
  if (meta.finishReason && BLOCKING_FINISH_REASONS.has(meta.finishReason)) {
    throw new ContentBlockedError('SAFETY');
  }
  if (meta.blockReason && meta.blockReason !== 'BLOCKED_REASON_UNSPECIFIED') {
    throw new ContentBlockedError('SAFETY');
  }

  if (typeof text !== 'string' || text.trim() === '') throw new MalformedOutputError();

  if (text.includes(CANARY)) throw new ContentBlockedError('LEAK');

  if (JSON_KINDS.has(kind)) return text;

  checkStructure(kind, text);
  return sanitiseMarkdown(kind, text);
}
