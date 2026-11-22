import { test, expect } from '@playwright/test';
import {
  screenOutput,
  ContentBlockedError,
  MalformedOutputError,
  type GenKind,
} from '../../src/lib/outputScreen';
import { CANARY } from '../../src/lib/promptSafety';

const ALL_KINDS: GenKind[] = [
  'blueprint',
  'lesson-plan',
  'worksheet',
  'assignment',
  'assessment',
  'memo',
  'presentation',
  'game',
  'resources',
  'refine',
  'analyze',
];

const JSON_KINDS: GenKind[] = ['blueprint', 'analyze'];

const LESSON_HEADINGS = [
  'Objective & Success Criteria',
  'Key Concepts & Vocabulary',
  'Materials Needed',
  'Common Misconceptions',
  'Differentiation Strategies',
  'Lesson Flow',
  'Closure & Exit Ticket',
];
const GAME_HEADINGS = [
  'Game Overview',
  'Learning Objectives',
  'Materials Required',
  'Setup Instructions',
  'How to Play',
  'Differentiation Options',
  'Debrief Questions',
];
const RESOURCES_HEADINGS = [
  'Overview',
  'Recommended Readings',
  'Online Resources & Videos',
  'Extension Activities',
  'Teacher Notes',
];
const MEMO_HEADINGS = ['Marking Guidelines', 'Answers'];

const withHeadings = (headings: string[]) => headings.map((h) => `## ${h}\nBody text.`).join('\n\n');

/** Valid, structure-satisfying body for any kind, with extra content appended. */
function validFor(kind: GenKind, extra = ''): string {
  switch (kind) {
    case 'lesson-plan':
      return `${withHeadings(LESSON_HEADINGS)}\n${extra}`;
    case 'game':
      return `${withHeadings(GAME_HEADINGS)}\n${extra}`;
    case 'resources':
      return `${withHeadings(RESOURCES_HEADINGS)}\n${extra}`;
    case 'memo':
      return `${withHeadings(MEMO_HEADINGS)}\n${extra}`;
    case 'presentation':
      return `## Slide 1\nA\n\n## Slide 2\nB\n\n## Slide 3\nC\n${extra}`;
    default:
      return `Some content.\n${extra}`;
  }
}

function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

test.describe('screenOutput: provider block signals', () => {
  for (const finishReason of ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII']) {
    test(`finishReason ${finishReason} throws ContentBlockedError SAFETY`, () => {
      const err = catchError(() => screenOutput('worksheet', 'text', { finishReason }));
      expect(err).toBeInstanceOf(ContentBlockedError);
      expect((err as ContentBlockedError).reason).toBe('SAFETY');
    });
  }

  test('a block reason throws SAFETY even when text is present', () => {
    const err = catchError(() => screenOutput('worksheet', 'plenty of text', { blockReason: 'PROHIBITED_CONTENT' }));
    expect(err).toBeInstanceOf(ContentBlockedError);
    expect((err as ContentBlockedError).reason).toBe('SAFETY');
  });

  test('a block reason throws SAFETY when text is missing', () => {
    const err = catchError(() => screenOutput('worksheet', undefined, { blockReason: 'OTHER' }));
    expect(err).toBeInstanceOf(ContentBlockedError);
  });

  test('BLOCKED_REASON_UNSPECIFIED and a normal finishReason are not blocks', () => {
    expect(
      screenOutput('worksheet', 'fine', { blockReason: 'BLOCKED_REASON_UNSPECIFIED', finishReason: 'STOP' }),
    ).toBe('fine');
  });
});

test.describe('screenOutput: canary and empty output', () => {
  test('text containing the canary throws LEAK', () => {
    const err = catchError(() => screenOutput('worksheet', `Here you go ${CANARY} done`));
    expect(err).toBeInstanceOf(ContentBlockedError);
    expect((err as ContentBlockedError).reason).toBe('LEAK');
  });

  test('canary is caught for JSON kinds too', () => {
    const err = catchError(() => screenOutput('blueprint', `{"a":"${CANARY}"}`));
    expect(err).toBeInstanceOf(ContentBlockedError);
    expect((err as ContentBlockedError).reason).toBe('LEAK');
  });

  for (const empty of [undefined, '', '   \n\t ']) {
    test(`empty text ${JSON.stringify(empty)} throws MalformedOutputError`, () => {
      expect(catchError(() => screenOutput('worksheet', empty))).toBeInstanceOf(MalformedOutputError);
    });
  }

  test('empty text with finishReason SAFETY is a block, not malformed', () => {
    const err = catchError(() => screenOutput('worksheet', '', { finishReason: 'SAFETY' }));
    expect(err).toBeInstanceOf(ContentBlockedError);
  });
});

test.describe('screenOutput: required structure', () => {
  const cases: Array<[GenKind, string[]]> = [
    ['lesson-plan', LESSON_HEADINGS],
    ['game', GAME_HEADINGS],
    ['resources', RESOURCES_HEADINGS],
    ['memo', MEMO_HEADINGS],
  ];

  for (const [kind, headings] of cases) {
    test(`${kind} with all required headings passes`, () => {
      const text = withHeadings(headings);
      expect(screenOutput(kind, text)).toBe(text);
    });

    test(`${kind} matching is case-insensitive`, () => {
      const text = withHeadings(headings.map((h) => h.toUpperCase()));
      expect(screenOutput(kind, text)).toBe(text);
    });

    for (const missing of headings) {
      test(`${kind} missing "${missing}" throws MalformedOutputError`, () => {
        const text = withHeadings(headings.filter((h) => h !== missing));
        expect(catchError(() => screenOutput(kind, text))).toBeInstanceOf(MalformedOutputError);
      });
    }
  }

  test('lesson-plan heading must be a ## heading at line start', () => {
    const text = withHeadings(LESSON_HEADINGS.filter((h) => h !== 'Lesson Flow')) + '\nThe Lesson Flow is below.';
    expect(catchError(() => screenOutput('lesson-plan', text))).toBeInstanceOf(MalformedOutputError);
  });

  test('presentation needs at least 3 slide headings', () => {
    const two = '## Slide 1\nA\n\n## Slide 2\nB';
    expect(catchError(() => screenOutput('presentation', two))).toBeInstanceOf(MalformedOutputError);
    const three = `${two}\n\n## Slide 3\nC`;
    expect(screenOutput('presentation', three)).toBe(three);
  });

  test('worksheet, assignment, assessment and refine have no structure requirement', () => {
    for (const kind of ['worksheet', 'assignment', 'assessment', 'refine'] as GenKind[]) {
      expect(screenOutput(kind, 'Just text.')).toBe('Just text.');
    }
  });
});

test.describe('screenOutput: markdown hygiene', () => {
  const dirty =
    'See [site](https://evil.example/x) and ![p](https://evil.example/i.png) <script>alert(1)</script> <iframe src=x></iframe>';

  test('worksheet drops link urls, images, script and iframe', () => {
    const out = screenOutput('worksheet', dirty);
    expect(out).toContain('site');
    expect(out).not.toContain('evil.example');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('</script');
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('</iframe');
    expect(out).not.toContain('alert(1)');
  });

  test('images become their alt text', () => {
    expect(screenOutput('worksheet', 'A ![a red cat](https://x.example/c.png) here')).toBe('A a red cat here');
  });

  test('linked image keeps only its alt text', () => {
    expect(screenOutput('worksheet', '[![logo](https://x.example/l.png)](https://y.example)')).toBe('logo');
  });

  test('other listed tags are removed, case-insensitively, with attributes', () => {
    const tags = ['object', 'embed', 'style', 'link', 'meta', 'form', 'input', 'button', 'svg', 'img', 'base'];
    for (const t of tags) {
      const out = screenOutput('worksheet', `x <${t.toUpperCase()} onload="bad()" src=y> y </${t}> z`);
      expect(out).not.toContain(`<${t}`);
      expect(out.toLowerCase()).not.toContain(`</${t}`);
      expect(out).not.toContain('onload');
    }
  });

  test('anchor tags are removed but their text is kept', () => {
    expect(screenOutput('worksheet', 'go <a href="https://evil.example">here</a> now')).toBe('go here now');
  });

  test('resources keeps links as visible text', () => {
    const text = validFor('resources', 'Try [Khan](https://khanacademy.org) today.');
    expect(screenOutput('resources', text)).toContain('Khan (https://khanacademy.org)');
  });

  test('resources link whose text is the url is not duplicated', () => {
    const text = validFor('resources', '[https://khanacademy.org](https://khanacademy.org)');
    const out = screenOutput('resources', text);
    expect(out).toContain('https://khanacademy.org');
    expect(out).not.toContain('https://khanacademy.org (https://khanacademy.org)');
  });

  test('resources still drops images and script tags', () => {
    const out = screenOutput('resources', validFor('resources', '![pic](https://e.example/i.png) <script>x</script>'));
    expect(out).toContain('pic');
    expect(out).not.toContain('e.example');
    expect(out).not.toContain('<script');
  });
});

test.describe('screenOutput: legitimate content survives', () => {
  const survivors = ['x < 5 and y > 2', 'a<b and c>d', '&nbsp;&nbsp; **Grade:** 8', 'x<a and y>b'];

  for (const kind of ALL_KINDS) {
    for (const s of survivors) {
      test(`${kind} keeps "${s}"`, () => {
        const text = validFor(kind, s);
        expect(screenOutput(kind, text)).toContain(s);
      });
    }
  }
});

test.describe('screenOutput: JSON kinds', () => {
  for (const kind of JSON_KINDS) {
    test(`${kind} is returned byte-for-byte`, () => {
      const json = ' {"title":"[a](https://e.example) <script>x</script> ![i](https://e.example/i.png)"}\n ';
      expect(screenOutput(kind, json)).toBe(json);
    });

    test(`${kind} still throws on empty output`, () => {
      expect(catchError(() => screenOutput(kind, ''))).toBeInstanceOf(MalformedOutputError);
    });

    test(`${kind} still throws on a block signal`, () => {
      const err = catchError(() => screenOutput(kind, '{}', { finishReason: 'SAFETY' }));
      expect(err).toBeInstanceOf(ContentBlockedError);
    });
  }
});
