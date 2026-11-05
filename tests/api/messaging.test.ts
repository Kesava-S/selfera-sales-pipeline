import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BASE_URL, getAuthHeaders, getDbClient } from './apiHelper';

describe('API: Messaging Endpoints Contract & Validation', () => {
  const db = getDbClient();
  let testBusinessId: string;
  let testOppId: string;
  let testThreadId: string;

  beforeEach(async () => {
    // Setup test hierarchy: business -> opportunity -> thread
    const { data: b } = await db
      .from('businesses')
      .insert({
        business_name: `API Msg Test ${Date.now()}`,
        business_type: 'Cafe',
        email: `msg.${Date.now()}@example.co.uk`,
      })
      .select()
      .single();
    testBusinessId = b!.id;

    const { data: opp } = await db
      .from('opportunities')
      .insert({
        business_id: testBusinessId,
        stage: 'Needs review',
        services_pitched: ['Website'],
      })
      .select()
      .single();
    testOppId = opp!.id;

    const { data: thread } = await db
      .from('threads')
      .insert({
        opportunity_id: testOppId,
        platform: 'Email',
        status: 'Not contacted',
      })
      .select()
      .single();
    testThreadId = thread!.id;
  });

  afterEach(async () => {
    if (testThreadId) await db.from('messages').delete().eq('thread_id', testThreadId);
    if (testThreadId) await db.from('threads').delete().eq('id', testThreadId);
    if (testOppId) await db.from('opportunities').delete().eq('id', testOppId);
    if (testBusinessId) await db.from('businesses').delete().eq('id', testBusinessId);
  });

  describe('GET /api/messages', () => {
    it('rejects unauthenticated requests (redirects to /login or 401)', async () => {
      const res = await fetch(`${BASE_URL}/api/messages?threadId=${testThreadId}`, {
        redirect: 'manual',
      });
      expect([307, 308, 401]).toContain(res.status);
    });

    it('returns 400 when threadId is missing from query parameters', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/messages`, {
        headers: authHeaders,
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid or missing threadId');
    });

    it('returns 404 when querying a non-existent or unauthorized threadId', async () => {
      const authHeaders = await getAuthHeaders();
      const randomUuid = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${BASE_URL}/api/messages?threadId=${randomUuid}`, {
        headers: authHeaders,
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Thread not found or access denied');
    });

    it('returns 200 and messages array for authorized existing threadId', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/messages?threadId=${testThreadId}`, {
        headers: authHeaders,
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('messages');
      expect(Array.isArray(json.messages)).toBe(true);
    });
  });

  describe('POST /api/send', () => {
    it('rejects unauthenticated send requests', async () => {
      const res = await fetch(`${BASE_URL}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: testThreadId, body: 'Hello' }),
        redirect: 'manual',
      });
      expect([307, 308, 401]).toContain(res.status);
    });

    it('returns 400 when body or threadId is empty', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ threadId: testThreadId, body: '   ' }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('The message is empty');
    });

    it('returns 422 when message contains unpopulated template placeholders', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          threadId: testThreadId,
          body: 'Hello {first_name}, hope you are well.',
        }),
      });
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toMatch(/placeholder/i);
    });

    it('returns 404 when target threadId does not exist', async () => {
      const authHeaders = await getAuthHeaders();
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${BASE_URL}/api/send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          threadId: fakeUuid,
          body: 'Hello without placeholders',
        }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Conversation not found');
    });

    it('returns 422 when opportunity stage is "Needs review" before approval', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          threadId: testThreadId,
          body: 'Hello, please review our website design proposal.',
        }),
      });
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toMatch(/approve this lead first/i);
    });
  });
});
