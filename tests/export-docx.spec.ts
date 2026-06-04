import { test, expect } from '@playwright/test';

const SAMPLE_MARKDOWN = `
## Objective & Success Criteria
Students will solve quadratic equations.

## Key Concepts & Vocabulary
- Quadratic: an equation of degree 2
- Discriminant: b² - 4ac

## Materials Needed
Whiteboard, calculators.

## Common Misconceptions
Forgetting the ± in the quadratic formula.

## Differentiation Strategies
Support: provide formula sheet. Extension: derive the formula.

## Lesson Flow
10 min hook, 20 min instruction, 15 min practice.

## Closure & Exit Ticket
Solve x² - 5x + 6 = 0 independently.
`.trim();

test('POST /api/export/docx returns 401 when unauthenticated', async ({ request }) => {
  const res = await request.post('/api/export/docx', {
    data: {
      content: SAMPLE_MARKDOWN,
      title: 'Test Document',
      docType: 'teacher',
      metadata: { subject: 'Mathematics', grade: 'Grade 9', className: 'Test Class' },
    },
  });
  expect(res.status()).toBe(401);
});

test('POST /api/export/docx returns 400 or 401 when content is missing', async ({ request }) => {
  const res = await request.post('/api/export/docx', {
    data: { title: 'No Content', docType: 'teacher', metadata: {} },
  });
  expect([400, 401]).toContain(res.status());
});
