import { test, expect } from '@playwright/test';

test.describe('Classroom Management API (CRUD)', () => {
  // We test the boundaries and unauthenticated paths primarily.
  // Full E2E tests with Clerk require an injected session cookie or bypassed auth middleware.

  test('GET /api/classrooms should reject unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/classrooms');
    expect(response.status()).toBe(404);
  });

  test('POST /api/classrooms should reject missing auth', async ({ request }) => {
    const response = await request.post('/api/classrooms', {
      data: {
        name: 'Test Classroom',
        subject: 'Math',
        grade: '10',
        curriculum: 'CAPS',
        studentCount: 30,
        averagePercentile: 50
      }
    });
    expect(response.status()).toBe(404);
  });

  test('PATCH /api/classrooms/[id] should protect against mass assignment (IDOR setup)', async ({ request }) => {
    // Testing the endpoint format without auth first.
    // In a fully authenticated test block, we would verify that passing `userId: "malicious_id"` 
    // is dropped by the `allowedFields` filter in the route.ts file.
    const response = await request.patch('/api/classrooms/clerk_12345', {
      data: {
        userId: 'hacked_id_123',
        name: 'Hacked Name'
      }
    });

    // Should block unconditionally if no auth token is provided
    expect(response.status()).toBe(404);
  });

  test('DELETE /api/classrooms/[id] should require auth', async ({ request }) => {
    const response = await request.delete('/api/classrooms/mock_id_123');
    expect(response.status()).toBe(404);
  });
});
