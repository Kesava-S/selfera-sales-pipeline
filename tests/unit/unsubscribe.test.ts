import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  appBaseUrl,
  exactLike,
  unsubscribeUrl,
  verifyUnsubscribe,
} from '@/lib/unsubscribe';

describe('unsubscribe & opt-out crypto logic (src/lib/unsubscribe.ts)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.UNSUBSCRIBE_SECRET = 'test-secret-salt-32-chars-long-1234';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sales.selfera.co.uk';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('appBaseUrl', () => {
    it('returns normalized base url without trailing slash', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://app.selfera.com///';
      expect(appBaseUrl()).toBe('https://app.selfera.com');
    });

    it('falls back to localhost when no env is configured', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      delete process.env.VERCEL_URL;
      expect(appBaseUrl()).toBe('http://localhost:3000');
    });
  });

  describe('exactLike', () => {
    it('escapes SQL LIKE special characters %, _, and \\', () => {
      expect(exactLike('user_name%100\\test')).toBe('user\\_name\\%100\\\\test');
    });
  });

  describe('unsubscribeUrl & verifyUnsubscribe round-trip', () => {
    it('generates a signed opt-out URL and verifies it successfully', () => {
      const email = 'Lead.Person@Company.co.uk';
      const url = unsubscribeUrl(email);

      expect(url).toBeTruthy();
      expect(url).toContain('https://sales.selfera.co.uk/opt-out?');

      const parsed = new URL(url!);
      const e = parsed.searchParams.get('e');
      const s = parsed.searchParams.get('s');

      expect(e).toBeTruthy();
      expect(s).toBeTruthy();

      const verified = verifyUnsubscribe(e, s);
      expect(verified).toBe('lead.person@company.co.uk');
    });

    it('supports customer-scoped opt-out tokens', () => {
      const email = 'client.lead@customer.com';
      const customerId = '12345678-1234-1234-1234-123456789abc';
      const url = unsubscribeUrl(email, customerId);

      expect(url).toContain(`&c=${customerId}`);

      const parsed = new URL(url!);
      const e = parsed.searchParams.get('e');
      const s = parsed.searchParams.get('s');
      const c = parsed.searchParams.get('c');

      // Valid with correct customerId
      expect(verifyUnsubscribe(e, s, c)).toBe('client.lead@customer.com');

      // Invalid if customerId is altered
      expect(verifyUnsubscribe(e, s, '99999999-9999-9999-9999-999999999999')).toBeNull();
    });

    it('rejects tampered signatures or tampered email payload', () => {
      const url = unsubscribeUrl('target@domain.com')!;
      const parsed = new URL(url);
      const e = parsed.searchParams.get('e');
      const s = parsed.searchParams.get('s');

      // Tampered signature
      expect(verifyUnsubscribe(e, 'tampered-signature-value')).toBeNull();

      // Tampered base64url email
      const fakeEmail = Buffer.from('other@domain.com').toString('base64url');
      expect(verifyUnsubscribe(fakeEmail, s)).toBeNull();
    });

    it('returns null when secret is not configured or email is invalid', () => {
      delete process.env.UNSUBSCRIBE_SECRET;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(unsubscribeUrl('valid@email.com')).toBeNull();
      expect(verifyUnsubscribe('val', 'sig')).toBeNull();
    });
  });
});

