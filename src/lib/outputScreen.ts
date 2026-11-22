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

/**
 * Reduce a heading's text to a comparable form, tolerating normal model formatting: markdown emphasis
 * (`*`, `_`) and backticks, leading numbering (`1.`, `1)`), leading emoji or other symbols, trailing
 * colons, repeated whitespace, `&` versus `and`, and letter case.
 */
function normaliseHeading(text: string): string {
  return text
    .replace(/[*_`]/g, '')
    .replace(/^[^\p{L}\p{N}]+/u, '') // leading emoji, symbols, punctuation
    .replace(/^\d+\s*[.)]\s*/, '') // leading "1." or "1)"
    .replace(/^[^\p{L}\p{N}]+/u, '') // anything left between the number and the words
    .replace(/[\s:]+$/, '')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Normalised text of every level-2 (`## `) heading line. `###` and `#` lines are not included. */
function levelTwoHeadings(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/^##(?!#)[ \t]+(.*)$/gm)) out.push(normaliseHeading(m[1]));
  return out;
}

function hasHeading(headings: string[], heading: string): boolean {
  const wanted = normaliseHeading(heading);
  // Text may follow the heading (e.g. "Lesson Flow (45 min)"), as before, but only after a word boundary.
  return headings.some((h) => h.startsWith(wanted) && !/[\p{L}\p{N}]/u.test(h.charAt(wanted.length)));
}

function checkStructure(kind: GenKind, text: string): void {
  if (kind === 'presentation') {
    const slides = text.match(/^##\s+Slide\s+\d+/gim) ?? [];
    if (slides.length < MIN_SLIDES) throw new MalformedOutputError('Presentation has too few slides');
    return;
  }
  const required = REQUIRED_HEADINGS[kind];
  if (!required) return;
  const headings = levelTwoHeadings(text);
  for (const heading of required) {
    if (!hasHeading(headings, heading)) throw new MalformedOutputError(`Missing section: ${heading}`);
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

type Edit = { from: number; to: number; text: string };

/** For each `(` index, the index of its matching `)` (or -1). One linear pass. */
function matchParens(text: string): Int32Array {
  const match = new Int32Array(text.length).fill(-1);
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 40) stack.push(i);
    else if (c === 41 && stack.length > 0) match[stack.pop() as number] = i;
  }
  return match;
}

/**
 * Neutralise markdown links and images in one linear pass.
 * `[` positions are kept on a stack; a `]` pops the nearest one, and when it is directly followed
 * by `(` with a balanced `)` it forms a link (or an image when the `[` is preceded by `!`). Labels
 * may contain newlines and nested brackets; targets may contain anything, including newlines, `[`
 * and balanced parentheses. The markers and target are removed and the label text stays in place,
 * so images become their alt text, links become their label, and in `resources` links gain
 * ` (url)`. A `[` that never closes into a link is left as plain text (so `[a [b](c)` becomes
 * `[a b`, with no live link). Parenthesis matching is precomputed, so no step rescans the input.
 */
function rewriteMarkdownLinks(text: string, keepUrls: boolean): string {
  if (!text.includes('](')) return text;
  const match = matchParens(text);
  const opens: number[] = [];
  const edits: Edit[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 91) {
      opens.push(i);
    } else if (c === 93 && opens.length > 0) {
      const s = opens.pop() as number;
      const end = text.charCodeAt(i + 1) === 40 ? match[i + 1] : -1;
      if (end === -1) continue;
      const image = s > 0 && text.charCodeAt(s - 1) === 33;
      edits.push({ from: image ? s - 1 : s, to: s + 1, text: '' });
      let suffix = '';
      if (keepUrls && !image) {
        const url = text.slice(i + 2, end).trim().split(/\s+/)[0] ?? '';
        const labelLength = i - s - 1;
        const duplicate =
          labelLength >= url.length && labelLength <= url.length + 100 && text.slice(s + 1, i).trim() === url;
        if (url && !duplicate) suffix = ` (${url})`;
      }
      edits.push({ from: i, to: end + 1, text: suffix });
      i = end;
    }
  }
  if (edits.length === 0) return text;
  edits.sort((a, b) => a.from - b.from);
  const out: string[] = [];
  let last = 0;
  for (const e of edits) {
    out.push(text.slice(last, e.from), e.text);
    last = e.to;
  }
  out.push(text.slice(last));
  return out.join('');
}

function sanitiseMarkdown(kind: GenKind, text: string): string {
  return stripListedTags(rewriteMarkdownLinks(text, kind === 'resources'));
}

/**
 * Screen raw model output before it is stored or returned.
 * Order: provider block signals, empty output, canary leak, truncation, required structure, markdown
 * hygiene. JSON kinds are returned unchanged once they pass the block, empty, canary and truncation
 * checks.
 *
 * Truncation (`finishReason` MAX_TOKENS) is malformed output for every kind: a cut-off worksheet or
 * refine has no structure check that would notice, and cut-off JSON is not valid. It is checked after
 * the canary so that a truncated leak is still reported (and kept, unrefunded) as a LEAK.
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

  // Fixed message: never include model text.
  if (meta.finishReason === 'MAX_TOKENS') throw new MalformedOutputError('Model output was truncated');

  if (JSON_KINDS.has(kind)) return text;

  checkStructure(kind, text);
  return sanitiseMarkdown(kind, text);
}
