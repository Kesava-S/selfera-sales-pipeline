import { describe, it, expect, afterEach } from 'vitest';
import { BASE_URL, getAuthHeaders, getDbClient } from './apiHelper';

describe('API: Leads Endpoints Contract & Validation', () => {
  const db = getDbClient();
  const createdBusinessIds: string[] = [];

  afterEach(async () => {
    if (createdBusinessIds.length > 0) {
      for (const id of createdBusinessIds) {
        await db.from('opportunities').delete().eq('business_id', id);
        await db.from('businesses').delete().eq('id', id);
      }
      createdBusinessIds.length = 0;
    }
    // Safeguard teardown for any test-created businesses
    const { data } = await db.from('businesses').select('id').or('business_name.ilike.API Import Lead%,business_name.ilike.API Update Test%');
    if (data && data.length > 0) {
      for (const b of data) {
        await db.from('opportunities').delete().eq('business_id', b.id);
        await db.from('businesses').delete().eq('id', b.id);
      }
    }
  });

  describe('POST /api/leads/import', () => {
    it('rejects unauthenticated requests (redirects to /login or 401)', async () => {
      const res = await fetch(`${BASE_URL}/api/leads/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [] }),
        redirect: 'manual',
      });
      expect([307, 308, 401]).toContain(res.status);
    });

    it('returns 400 when empty business array is provided', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/leads/import`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ rows: [] }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No rows to import');
    });

    it('returns 200 and schema with imported count on valid batch', async () => {
      const authHeaders = await getAuthHeaders();
      const testName = `API Import Lead ${Date.now()}`;
      const testEmail = `api.import.${Date.now()}@example.com`;
      const res = await fetch(`${BASE_URL}/api/leads/import`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          rows: [
            {
              business_name: testName,
              business_type: 'Restaurant',
              service_pitched: 'Website',
              email: testEmail,
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toMatchObject({
        total: 1,
        ready: expect.any(Number),
        missing: expect.any(Number),
        skipped: expect.any(Number),
      });

      // Cleanup
      const { data } = await db.from('businesses').select('id').eq('business_name', testName);
      if (data) data.forEach((b) => createdBusinessIds.push(b.id));
    });
  });

  describe('POST /api/leads/update-field', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await fetch(`${BASE_URL}/api/leads/update-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        redirect: 'manual',
      });
      expect([307, 308, 401]).toContain(res.status);
    });

    it('returns 400 when businessId or field is missing', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/leads/update-field`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ value: 'Test' }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing businessId or field');
    });

    it('returns 200 on valid field update', async () => {
      const authHeaders = await getAuthHeaders();
      // Setup business via import
      const setupName = `API Update Test ${Date.now()}`;
      const importRes = await fetch(`${BASE_URL}/api/leads/import`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          rows: [{ business_name: setupName, business_type: 'Cafe' }],
        }),
      });
      expect(importRes.status).toBe(200);

      const { data: b } = await db.from('businesses').select('id').eq('business_name', setupName).single();
      expect(b).toBeTruthy();
      createdBusinessIds.push(b!.id);

      const res = await fetch(`${BASE_URL}/api/leads/update-field`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          businessId: b!.id,
          field: 'email',
          value: 'updated@example.co.uk',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });
  });

  describe('POST /api/leads/duplicates', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await fetch(`${BASE_URL}/api/leads/duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [] }),
        redirect: 'manual',
      });
      expect([307, 308, 401]).toContain(res.status);
    });

    it('returns 400 when rows is not an array', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/leads/duplicates`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ rows: 'invalid_type' }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid request');
    });

    it('returns 200 with matches array schema on valid input', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/leads/duplicates`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          rows: [{ idx: 0, business_name: 'Non Existent Lead Unique 99999', postcode: 'ZZ9 9ZZ' }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('matches');
      expect(Array.isArray(json.matches)).toBe(true);
    });
  });

  describe('POST /api/leads/create', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await fetch(`${BASE_URL}/api/leads/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: 'Test' }),
        redirect: 'manual',
      });
      expect([307, 308, 401]).toContain(res.status);
    });

    it('returns 400 when business_name is missing or whitespace', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/leads/create`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ business_name: '   ' }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Business name is required.');
    });

    it('returns 400 when whatsapp_number is invalid format', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/leads/create`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          business_name: 'Valid Name',
          whatsapp_number: 'invalid-not-a-phone',
        }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/country code/i);
    });
  });

  describe('GET /api/leads/export', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await fetch(`${BASE_URL}/api/leads/export`, {
        redirect: 'manual',
      });
      expect([307, 308, 401]).toContain(res.status);
    });

    it('returns 200 CSV stream with appropriate attachment headers for admin', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/leads/export`, {
        headers: authHeaders,
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const disposition = res.headers.get('content-disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('selfera-leads-');

      const csvContent = await res.text();
      expect(csvContent).toContain('business_name');
      expect(csvContent).toContain('business_type');
    });
  });
});
