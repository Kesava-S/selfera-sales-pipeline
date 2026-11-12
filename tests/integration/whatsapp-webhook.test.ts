import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { BASE_URL, getDbClient } from './testHelper';
import { WEBHOOK_SECRETS } from '../api/apiHelper';

describe('Integration: POST /api/whatsapp/webhook -> Message status mutation in DB', () => {
  const db = getDbClient();
  let testBusinessId: string;
  let testOppId: string;
  let testThreadId: string;
  let testMessageId: string;
  let externalMessageId: string;

  beforeEach(async () => {
    // Set up test hierarchy: business -> opportunity -> thread -> message
    const { data: b } = await db
      .from('businesses')
      .insert({ business_name: `WA Int Test ${Date.now()}`, business_type: 'Pub' })
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
        platform: 'WhatsApp',
        status: 'Awaiting reply',
      })
      .select()
      .single();
    testThreadId = thread!.id;

    externalMessageId = `wamid.test.${Date.now()}`;
    const { data: msg } = await db
      .from('messages')
      .insert({
        thread_id: testThreadId,
        direction: 'outbound',
        body: 'Automated test outreach message',
        delivery_status: 'sent',
        external_message_id: externalMessageId,
      })
      .select()
      .single();
    testMessageId = msg!.id;
  });

  afterEach(async () => {
    // Teardown test hierarchy in reverse order
    if (testMessageId) await db.from('messages').delete().eq('id', testMessageId);
    if (testThreadId) await db.from('threads').delete().eq('id', testThreadId);
    if (testOppId) await db.from('opportunities').delete().eq('id', testOppId);
    if (testBusinessId) await db.from('businesses').delete().eq('id', testBusinessId);
  });

  function signPayload(bodyString: string) {
    const secret = WEBHOOK_SECRETS.whatsappAppSecret;
    return 'sha256=' + crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
  }

  it('processes valid Meta webhook delivery status, updates messages table in DB', async () => {
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'TEST_ACCOUNT',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '447000000000', phone_number_id: '12345' },
                statuses: [
                  {
                    id: externalMessageId,
                    status: 'delivered',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const signature = signPayload(payload);

    const res = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: payload,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');

    // Direct DB verification: confirm delivery_status and delivered_at were updated
    const { data: updatedMsg, error } = await db
      .from('messages')
      .select('delivery_status, delivered_at')
      .eq('id', testMessageId)
      .single();

    expect(error).toBeNull();
    expect(updatedMsg).not.toBeNull();
    expect(updatedMsg!.delivery_status).toBe('delivered');
    expect(updatedMsg!.delivered_at).toBeTruthy();
  });

  it('rejects webhooks with invalid HMAC signatures and does not mutate DB', async () => {
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });

    const res = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=invalid_forged_signature',
      },
      body: payload,
    });

    expect(res.status).toBe(401);

    // Confirm message status remains unchanged in DB
    const { data: untouchedMsg } = await db
      .from('messages')
      .select('delivery_status')
      .eq('id', testMessageId)
      .single();

    expect(untouchedMsg).not.toBeNull();
    expect(untouchedMsg!.delivery_status).toBe('sent');
  });
});

