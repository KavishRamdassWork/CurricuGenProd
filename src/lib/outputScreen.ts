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
// Every pattern below is linear-time: no scan runs to the end of the input from each candidate.
const BLOCK_TAG_NAMES = 'script|iframe|object|embed|style|link|meta|form|input|button|svg|img|base';
const LISTED_TAG = new RegExp(`</?(?:${BLOCK_TAG_NAMES})(?![A-Za-z0-9_-])[^<>]*>`, 'gi');
const SCRIPT_STYLE_OPEN = /<(script|style)(?![\w-])[^<>]*>/gi;
const CLOSING_TAGS: Record<string, RegExp> = {
  script: /<\/script\s*>/gi,
  style: /<\/style\s*>/gi,
};
// <a> is a one-letter name that collides with maths such as "x<a and y>b", so an opening <a ...>
// is removed only when it is bare or carries an attribute (any "=") or an href.
const ANCHOR_OPEN = /<a(?:>|[\s/][^<>]*>)/gi;
const ANCHOR_CLOSE = /<\/a\s*>/gi;

/** Remove script/style elements together with their contents, in a single forward pass. */
function stripScriptStyleBlocks(text: string): string {
  const closeFound: Record<string, boolean> = { script: true, style: true };
  const out: string[] = [];
  let last = 0;
  const open = new RegExp(SCRIPT_STYLE_OPEN.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = open.exec(text)) !== null) {
    const name = m[1].toLowerCase();
    // Once a search for this closing tag has failed, no later opening tag can have one either.
    if (!closeFound[name]) continue;
    const close = CLOSING_TAGS[name];
    close.lastIndex = open.lastIndex;
    const c = close.exec(text);
    if (!c) {
      closeFound[name] = false;
      continue;
    }
    out.push(text.slice(last, m.index));
    last = close.lastIndex;
    open.lastIndex = last;
  }
  out.push(text.slice(last));
  return out.join('');
}

function stripListedTags(text: string): string {
  let current = text;
  // Repeat so that removing one tag cannot assemble another (e.g. "<scr<b>ipt>").
  for (let i = 0; i < 5; i++) {
    const next = stripScriptStyleBlocks(current)
      .replace(LISTED_TAG, '')
      .replace(ANCHOR_OPEN, (tag) => (/^<a\s*\/?>$/i.test(tag) || /=|\bhref\b/i.test(tag) ? '' : tag))
      .replace(ANCHOR_CLOSE, '');
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Rewrite `[label](target)` (or `![alt](target)` when `image`) with a single forward scan.
 * The label may not contain `[`, `]` or a newline and the target may not contain `[` or a newline
 * (one level of nested parentheses is allowed), so each character is scanned a bounded number of
 * times and pathological input cannot cause quadratic work.
 */
function rewriteMarkdownLinks(
  text: string,
  image: boolean,
  replace: (label: string, target: string) => string,
): string {
  const out: string[] = [];
  let last = 0;
  let i = text.indexOf('[');
  while (i !== -1) {
    if (image && (i === 0 || text[i - 1] !== '!')) {
      i = text.indexOf('[', i + 1);
      continue;
    }
    let j = i + 1;
    while (j < text.length && text[j] !== ']' && text[j] !== '[' && text[j] !== '\n') j++;
    let end = -1;
    if (text[j] === ']' && text[j + 1] === '(') {
      let depth = 0;
      for (let k = j + 2; k < text.length; k++) {
        const c = text[k];
        if (c === '[' || c === '\n') break;
        if (c === '(') depth++;
        else if (c === ')') {
          if (depth === 0) {
            end = k;
            break;
          }
          depth--;
        }
      }
    }
    if (end === -1) {
      i = text.indexOf('[', i + 1);
      continue;
    }
    out.push(text.slice(last, image ? i - 1 : i), replace(text.slice(i + 1, j), text.slice(j + 2, end)));
    last = end + 1;
    i = text.indexOf('[', last);
  }
  out.push(text.slice(last));
  return out.join('');
}

function sanitiseMarkdown(kind: GenKind, text: string): string {
  const keepUrls = kind === 'resources';
  const noImages = rewriteMarkdownLinks(text, true, (alt) => alt);
  const noLinks = rewriteMarkdownLinks(noImages, false, (label, target) => {
    if (!keepUrls) return label;
    const url = target.trim().split(/\s+/)[0] ?? '';
    if (!url || label.trim() === url) return label || url;
    return `${label} (${url})`;
  });
  return stripListedTags(noLinks);
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
