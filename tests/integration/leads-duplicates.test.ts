import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BASE_URL, getAuthHeaders, getDbClient } from './testHelper';

describe('Integration: POST /api/leads/duplicates -> DB duplicate matching RPC', () => {
  const db = getDbClient();
  let testBusinessId: string;
  let testPhone: string;
  let testEmail: string;

  beforeEach(async () => {
    const timestamp = Date.now();
    testPhone = `+447999${String(timestamp).slice(-6)}`;
    testEmail = `dup.${timestamp}@company.co.uk`;

    const { data: b, error } = await db
      .from('businesses')
      .insert({
        business_name: `Duplicate Baseline ${timestamp}`,
        business_type: 'Hotel',
        whatsapp_number: testPhone,
        email: testEmail,
      })
      .select()
      .single();

    if (error || !b) throw new Error(`Setup failed: ${error?.message}`);
    testBusinessId = b.id;
  });

  afterEach(async () => {
    if (testBusinessId) {
      await db.from('businesses').delete().eq('id', testBusinessId);
    }
  });

  it('detects existing duplicate leads from database via find_duplicates RPC', async () => {
    const headers = await getAuthHeaders();

    const res = await fetch(`${BASE_URL}/api/leads/duplicates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rows: [
          {
            idx: 0,
            business_name: 'Brand New Unique Lead Ltd',
            whatsapp_number: '+447000111222',
            email: 'unique@example.com',
          },
          {
            idx: 1,
            business_name: 'Duplicate By Phone And Email',
            whatsapp_number: testPhone,
            email: testEmail,
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.matches)).toBe(true);

    // Verify row 1 was matched as duplicate pointing to testBusinessId
    const duplicateMatch = body.matches.find((m: any) => m.idx === 1);
    expect(duplicateMatch).toBeTruthy();
    expect(duplicateMatch.business_id).toBe(testBusinessId);
  });
});

