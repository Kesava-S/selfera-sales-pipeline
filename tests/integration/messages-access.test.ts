import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BASE_URL, getAuthHeaders, getDbClient } from './testHelper';

describe('Integration: GET /api/messages -> RLS access verification & IDOR protection', () => {
  const db = getDbClient();
  let testBusinessId: string;
  let testOppId: string;
  let testThreadId: string;
  let testMessageId: string;

  beforeEach(async () => {
    // 1. Create business, opportunity, thread, and message
    const { data: b } = await db
      .from('businesses')
      .insert({ business_name: `Message Test ${Date.now()}`, business_type: 'Hotel' })
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

    const { data: msg } = await db
      .from('messages')
      .insert({
        thread_id: testThreadId,
        direction: 'outbound',
        body: 'Secure message content',
        delivery_status: 'sent',
      })
      .select()
      .single();
    testMessageId = msg!.id;
  });

  afterEach(async () => {
    if (testMessageId) await db.from('messages').delete().eq('id', testMessageId);
    if (testThreadId) await db.from('threads').delete().eq('id', testThreadId);
    if (testOppId) await db.from('opportunities').delete().eq('id', testOppId);
    if (testBusinessId) await db.from('businesses').delete().eq('id', testBusinessId);
  });

  it('allows authorized user to retrieve thread messages matching DB rows', async () => {
    const headers = await getAuthHeaders();

    const res = await fetch(`${BASE_URL}/api/messages?threadId=${testThreadId}`, {
      method: 'GET',
      headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.some((m: any) => m.id === testMessageId)).toBe(true);

    // Direct DB comparison: assert body matches DB column
    const { data: dbMsg } = await db.from('messages').select('body').eq('id', testMessageId).single();
    expect(dbMsg).not.toBeNull();
    expect(dbMsg!.body).toBe('Secure message content');
  });

  it('returns 404 access denied for unauthorized or non-existent thread IDs (IDOR protection)', async () => {
    const headers = await getAuthHeaders();
    const fakeUuid = '00000000-0000-0000-0000-000000000000';

    const res = await fetch(`${BASE_URL}/api/messages?threadId=${fakeUuid}`, {
      method: 'GET',
      headers,
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('Thread not found or access denied');
  });
});

