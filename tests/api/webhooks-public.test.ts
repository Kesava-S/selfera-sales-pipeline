import { describe, it, expect, afterEach } from 'vitest';
import { BASE_URL, getBearerHeaders, getDbClient, signWhatsAppPayload, createSvixHeaders, WEBHOOK_SECRETS } from './apiHelper';
import { unsubscribeUrl } from '@/lib/unsubscribe';

describe('API: Webhooks & Public Inbound Endpoints', () => {
  const db = getDbClient();
  const createdOptOutEmails: string[] = [];

  afterEach(async () => {
    if (createdOptOutEmails.length > 0) {
      for (const email of createdOptOutEmails) {
        await db.from('opt_outs').delete().ilike('identifier', email);
      }
      createdOptOutEmails.length = 0;
    }
  });

  describe('POST /api/opt-out and POST /api/unsubscribe', () => {
    it('returns 400 when email or signature parameter is missing', async () => {
      const res = await fetch(`${BASE_URL}/api/opt-out`, { method: 'POST' });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid opt-out link');
    });

    it('returns 400 when opt-out signature is invalid or tampered', async () => {
      const testEmail = `tampered.${Date.now()}@example.co.uk`;
      const res = await fetch(`${BASE_URL}/api/opt-out?e=${encodeURIComponent(testEmail)}&s=invalid_sig_123`, {
        method: 'POST',
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid opt-out link');
    });

    it('returns 200 with opted_out status on valid cryptographically signed URL', async () => {
      const testEmail = `api.optout.${Date.now()}@example.co.uk`;
      createdOptOutEmails.push(testEmail);
      const fullUrl = unsubscribeUrl(testEmail)!;
      const parsed = new URL(fullUrl);

      const res = await fetch(`${BASE_URL}/api/opt-out?${parsed.searchParams.toString()}`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('opted_out');
    });

    it('legacy alias /api/unsubscribe processes valid signed unsubscribe requests', async () => {
      const testEmail = `api.legacy.optout.${Date.now()}@example.co.uk`;
      createdOptOutEmails.push(testEmail);
      const fullUrl = unsubscribeUrl(testEmail)!;
      const parsed = new URL(fullUrl);

      const res = await fetch(`${BASE_URL}/api/unsubscribe?${parsed.searchParams.toString()}`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('opted_out');
    });
  });

  describe('WhatsApp Cloud API Webhook: GET & POST /api/whatsapp/webhook', () => {
    it('GET returns 403 Forbidden when hub.verify_token does not match', async () => {
      const res = await fetch(
        `${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_challenge_123`
      );
      expect(res.status).toBe(403);
    });

    it('GET returns 200 echoing hub.challenge when hub.verify_token matches configured secret', async () => {
      const verifyToken = WEBHOOK_SECRETS.whatsappVerifyToken;
      expect(verifyToken).toBeTruthy();
      const challengeCode = `challenge_${Date.now()}`;
      const res = await fetch(
        `${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challengeCode}`
      );
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe(challengeCode);
    });

    it('POST returns 401 when X-Hub-Signature-256 is missing', async () => {
      const res = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object: 'whatsapp_business_account' }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.status).toBe('forbidden');
    });

    it('POST returns 401 when X-Hub-Signature-256 is forged/invalid', async () => {
      const res = await fetch(`${BASE_URL}/api/whatsapp/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=invalid_forged_hash_1234567890abcdef',
        },
        body: JSON.stringify({ object: 'whatsapp_business_account' }),
      });
      expect(res.status).toBe(401);
    });

    it('POST returns 200 { status: "ignored" } for valid signed payload with non-whatsapp object', async () => {
      const payload = JSON.stringify({ object: 'other_object', entry: [] });
      const signature = signWhatsAppPayload(payload);

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
      expect(json.status).toBe('ignored');
    });

    it('POST returns 200 { status: "ok" } for valid signed Meta delivery status update', async () => {
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
                  statuses: [],
                },
              },
            ],
          },
        ],
      });
      const signature = signWhatsAppPayload(payload);

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
    });
  });

  describe('Resend Email Webhook: POST /api/email/webhook', () => {
    it('returns 401 when Svix signature headers are missing', async () => {
      const res = await fetch(`${BASE_URL}/api/email/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email.delivered' }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Invalid signature');
    });

    it('returns 401 when Svix signature is forged or invalid', async () => {
      const res = await fetch(`${BASE_URL}/api/email/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_test_123',
          'svix-timestamp': String(Math.floor(Date.now() / 1000)),
          'svix-signature': 'v1,invalid_forged_base64_signature',
        },
        body: JSON.stringify({ type: 'email.delivered' }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Invalid signature');
    });

    it('returns 200 { status: "ignored" } for valid signed payload with non-email events', async () => {
      const body = JSON.stringify({ type: 'other.unknown_event' });
      const svixHeaders = createSvixHeaders(body);

      const res = await fetch(`${BASE_URL}/api/email/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...svixHeaders,
        },
        body,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ignored');
    });
  });

  describe('Email Reply Sync: GET & POST /api/email/sync', () => {
    it('GET returns 401 when called unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/email/sync`, { method: 'GET' });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('POST returns 401 when called unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/email/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('accepts Bearer cron secret on GET and executes sync or reports IMAP configuration status', async () => {
      const bearerHeaders = getBearerHeaders();
      const res = await fetch(`${BASE_URL}/api/email/sync?sinceDays=0&maxMessages=1`, {
        method: 'GET',
        headers: bearerHeaders,
      });
      // Returns 200 if IMAP is configured in environment, or 503 Service Unavailable if IMAP credentials not set
      expect([200, 503]).toContain(res.status);
    });

    it('accepts Bearer cron secret on POST and executes sync or reports IMAP configuration status', async () => {
      const bearerHeaders = getBearerHeaders();
      const res = await fetch(`${BASE_URL}/api/email/sync`, {
        method: 'POST',
        headers: bearerHeaders,
        body: JSON.stringify({ sinceDays: 0, maxMessages: 1 }),
      });
      expect([200, 503]).toContain(res.status);
    });
  });
});
