import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BASE_URL, getAuthHeaders, getDbClient } from './testHelper';

describe('Integration: POST /api/leads/update-field -> Database side effects', () => {
  const db = getDbClient();
  let testBusinessId: string;
  let testOppId: string;

  beforeEach(async () => {
    // Set up dedicated test business and opportunity
    const { data: b, error: bErr } = await db
      .from('businesses')
      .insert({
        business_name: `Update Test ${Date.now()}`,
        business_type: 'Restaurant or cafe',
      })
      .select()
      .single();

    if (bErr || !b) throw new Error(`Setup failed: ${bErr?.message}`);
    testBusinessId = b.id;

    const { data: opp, error: oErr } = await db
      .from('opportunities')
      .insert({
        business_id: testBusinessId,
        stage: 'Needs review',
        services_pitched: ['Website'],
      })
      .select()
      .single();

    if (oErr || !opp) throw new Error(`Opp setup failed: ${oErr?.message}`);
    testOppId = opp.id;
  });

  afterEach(async () => {
    // Teardown created records
    if (testOppId) await db.from('opportunities').delete().eq('id', testOppId);
    if (testBusinessId) await db.from('businesses').delete().eq('id', testBusinessId);
  });

  it('updates compound address and postcode via RPC and asserts DB mutation', async () => {
    const headers = await getAuthHeaders();

    const res = await fetch(`${BASE_URL}/api/leads/update-field`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        businessId: testBusinessId,
        field: 'address_and_postcode',
        value: '10 Downing Street',
        secondaryValue: 'SW1A 2AA',
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Direct DB verification
    const { data: updated, error } = await db
      .from('businesses')
      .select('address, postcode')
      .eq('id', testBusinessId)
      .single();

    expect(error).toBeNull();
    expect(updated).not.toBeNull();
    expect(updated!.address).toBe('10 Downing Street');
    expect(updated!.postcode).toBe('SW1A 2AA');
  });

  it('updates contact details and recalculates lead problems column in DB', async () => {
    const headers = await getAuthHeaders();

    const res = await fetch(`${BASE_URL}/api/leads/update-field`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        businessId: testBusinessId,
        field: 'email',
        value: 'contact@verified-downstream.co.uk',
      }),
    });

    expect(res.status).toBe(200);

    // Direct DB query verifying email and problem column recomputation
    const { data: updated, error } = await db
      .from('businesses')
      .select('email, problems')
      .eq('id', testBusinessId)
      .single();

    expect(error).toBeNull();
    expect(updated).not.toBeNull();
    expect(updated!.email).toBe('contact@verified-downstream.co.uk');
    expect(Array.isArray(updated!.problems)).toBe(true);
  });
});

