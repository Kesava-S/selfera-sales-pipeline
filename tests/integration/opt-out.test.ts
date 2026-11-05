import { describe, it, expect, afterEach } from 'vitest';
import { BASE_URL, getDbClient } from './testHelper';
import { unsubscribeUrl } from '@/lib/unsubscribe';

describe('Integration: POST /api/opt-out -> Database side effects', () => {
  const db = getDbClient();
  const testEmails: string[] = [];

  afterEach(async () => {
    // Clean up created opt_outs records
    if (testEmails.length > 0) {
      for (const email of testEmails) {
        await db.from('opt_outs').delete().ilike('identifier', email);
      }
      testEmails.length = 0;
    }
  });

  it('verifies signed token, creates record in opt_outs table, and asserts in DB', async () => {
    const testEmail = `optout.integration.${Date.now()}@example.co.uk`;
    testEmails.push(testEmail);

    const generatedUrl = unsubscribeUrl(testEmail);
    expect(generatedUrl).toBeTruthy();

    const parsed = new URL(generatedUrl!);

    // Call real public opt-out endpoint (RFC 8058 one-click unsubscribe)
    const res = await fetch(`${BASE_URL}/api/opt-out?${parsed.searchParams.toString()}`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('opted_out');

    // Direct DB verification: confirm row in opt_outs exists with correct channel
    const { data: rows, error } = await db
      .from('opt_outs')
      .select('*')
      .ilike('identifier', testEmail);

    expect(error).toBeNull();
    expect(rows).toBeTruthy();
    expect(rows!).toHaveLength(1);
    expect(rows![0].identifier).toBe(testEmail);
    expect(rows![0].channel).toBe('Email');
    expect(rows![0].source).toBe('unsubscribe');
  });

  it('rejects tampered opt-out signatures and does NOT write to DB', async () => {
    const testEmail = `tampered.${Date.now()}@example.co.uk`;
    testEmails.push(testEmail);

    const generatedUrl = unsubscribeUrl(testEmail)!;
    const parsed = new URL(generatedUrl);
    parsed.searchParams.set('s', 'invalid_tampered_signature_1234');

    const res = await fetch(`${BASE_URL}/api/opt-out?${parsed.searchParams.toString()}`, {
      method: 'POST',
    });

    expect(res.status).toBe(400);

    // Confirm nothing was written to DB
    const { data: rows } = await db.from('opt_outs').select('*').ilike('identifier', testEmail);
    expect(rows).toHaveLength(0);
  });
});

