import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BASE_URL, getAuthHeaders, getBearerHeaders, getDbClient } from './apiHelper';

describe('API: Campaigns & Audience Endpoints', () => {
  const db = getDbClient();
  let testBusinessId: string;

  beforeEach(async () => {
    // Insert a test client business for audience export
    const { data: b } = await db
      .from('businesses')
      .insert({
        business_name: `Audience Client ${Date.now()}`,
        business_type: 'Cafe',
      })
      .select()
      .single();
    if (b) testBusinessId = b.id;
  });

  afterEach(async () => {
    if (testBusinessId) {
      await db.from('customer_leads').delete().eq('business_id', testBusinessId);
      await db.from('audience_exports').delete().eq('business_id', testBusinessId);
      await db.from('businesses').delete().eq('id', testBusinessId);
    }
  });

  describe('GET /api/audience/export', () => {
    it('rejects unauthenticated requests (redirects to /login or 401)', async () => {
      const res = await fetch(`${BASE_URL}/api/audience/export?business=${testBusinessId}`, {
        redirect: 'manual',
      });
      expect([307, 308, 401]).toContain(res.status);
    });

    it('returns 400 when business query param is missing or not a valid UUID', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/audience/export?business=not-a-uuid`, {
        headers: authHeaders,
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Pick a client');
    });

    it('returns 404 when client business does not exist in DB', async () => {
      const authHeaders = await getAuthHeaders();
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${BASE_URL}/api/audience/export?business=${nonExistentUuid}`, {
        headers: authHeaders,
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Client not found');
    });

    it('returns 200 CSV stream for existing client business', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/audience/export?business=${testBusinessId}`, {
        headers: authHeaders,
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const disposition = res.headers.get('content-disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('audience-');

      const csv = await res.text();
      expect(csv).toContain('first_name,last_name,email');
    });
  });

  describe('POST /api/campaigns/process', () => {
    it('returns 401 when called without Bearer secret or staff session', async () => {
      const res = await fetch(`${BASE_URL}/api/campaigns/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 401 when an invalid Bearer token is passed', async () => {
      const res = await fetch(`${BASE_URL}/api/campaigns/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid_forged_secret_token_12345',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('accepts valid cron Bearer token and returns queue processing result', async () => {
      const bearerHeaders = getBearerHeaders();
      const res = await fetch(`${BASE_URL}/api/campaigns/process`, {
        method: 'POST',
        headers: bearerHeaders,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('sent');
      expect(json).toHaveProperty('failed');
      expect(typeof json.sent).toBe('number');
      expect(typeof json.failed).toBe('number');
    });

    it('accepts authenticated staff session and returns queue progress', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/campaigns/process`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('sent');
      expect(json).toHaveProperty('failed');
    });
  });
});
