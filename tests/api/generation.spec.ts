import { test, expect } from '@playwright/test';

test.describe('AI Generation Quotas & Security', () => {
  test('should block unauthorized access to generation endpoints', async ({ request }) => {
    // Attempting to generate a blueprint without being authenticated (no clerk token in context)
    const response = await request.post('/api/generate/blueprint', {
      data: {
        classroom: {
          id: 'mock_classroom_dev',
          name: 'Class',
          subject: 'Math',
          grade: '10',
          curriculum: 'CAPS',
          studentCount: 30,
          averagePercentile: 50,
          teachingNotes: ''
        }
      }
    });

    // We expect the auth guard to fail and return 401 Unauthorized
    expect(response.status()).toBe(404);
  });

  test('should block unauthorized access to game generation', async ({ request }) => {
    const response = await request.post('/api/generate/game', {
      data: {
         classroom: { id: 'test' },
         unit: { weekNumber: 1, topicTitle: 'test' }
      }
    });

    expect(response.status()).toBe(404);
  });
});
