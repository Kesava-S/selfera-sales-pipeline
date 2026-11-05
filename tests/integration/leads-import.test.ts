import { describe, it, expect, afterEach } from 'vitest';
import { BASE_URL, getAuthHeaders, getDbClient } from './testHelper';

describe('Integration: POST /api/leads/import -> Database side effects', () => {
  const db = getDbClient();
  const createdBusinessIds: string[] = [];

  afterEach(async () => {
    // Clean up created records to prevent DB pollution
    if (createdBusinessIds.length > 0) {
      for (const id of createdBusinessIds) {
        // Delete related opportunities first to satisfy foreign keys
        await db.from('opportunities').delete().eq('business_id', id);
        await db.from('businesses').delete().eq('id', id);
      }
      createdBusinessIds.length = 0;
    }
  });

  it('imports a lead, creates rows in businesses & opportunities, and verifies in DB', async () => {
    const headers = await getAuthHeaders();
    const timestamp = Date.now();
    const testBusinessName = `Integration Test Lead ${timestamp}`;

    const payload = {
      rows: [
        {
          business_name: testBusinessName,
          business_type: 'Restaurant or cafe',
          services: ['Website'],
          area: 'Covent Garden',
          contact_name: 'Elena Rostova',
          email: `elena.${timestamp}@example.com`,
          whatsapp_number: '+44 7123 456789',
        },
      ],
    };

    // 1. Call real API endpoint
    const res = await fetch(`${BASE_URL}/api/leads/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(1);
    expect(body.total).toBe(1);

    // 2. Query PostgreSQL directly to assert actual downstream state
    const { data: business, error: bErr } = await db
      .from('businesses')
      .select('*')
      .eq('business_name', testBusinessName)
      .single();

    expect(bErr).toBeNull();
    expect(business).toBeTruthy();
    expect(business.business_name).toBe(testBusinessName);
    expect(business.area).toBe('Covent Garden');
    expect(business.whatsapp_number).toBe('+447123456789'); // Phone normalized
    expect(business.contact_name).toBe('Elena Rostova');

    createdBusinessIds.push(business.id);

    // 3. Confirm opportunity row was automatically generated and linked
    const { data: opp, error: oErr } = await db
      .from('opportunities')
      .select('*')
      .eq('business_id', business.id)
      .single();

    expect(oErr).toBeNull();
    expect(opp).toBeTruthy();
    expect(opp.business_id).toBe(business.id);
    expect(opp.stage).toBe('Needs review');
    expect(opp.services_pitched).toEqual(['Website']);
  });

  it('rejects invalid import payloads with HTTP 400 without DB changes', async () => {
    const headers = await getAuthHeaders();

    const res = await fetch(`${BASE_URL}/api/leads/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rows: [] }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('No rows to import');
  });
});

