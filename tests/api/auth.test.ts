import { describe, it, expect } from 'vitest';
import { BASE_URL, getAuthHeaders } from './apiHelper';

describe('API: Authentication & SSO Endpoints', () => {
  describe('GET /sso and SSO Aliases', () => {
    it('GET /sso with missing code and token redirects to /login?error=MissingSSOToken', async () => {
      const res = await fetch(`${BASE_URL}/sso`, { redirect: 'manual' });
      expect([307, 308]).toContain(res.status);
      const location = res.headers.get('location');
      expect(location).toContain('/login?error=MissingSSOToken');
    });

    it('GET /sso with invalid JWT token redirects to /login?error=InvalidSSOToken', async () => {
      const res = await fetch(`${BASE_URL}/sso?token=invalid.jwt.token`, { redirect: 'manual' });
      expect([307, 308]).toContain(res.status);
      const location = res.headers.get('location');
      expect(location).toContain('/login?error=InvalidSSOToken');
    });

    it('GET /api/auth/callback/selfera redirects to /login with error on missing parameters', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/callback/selfera`, { redirect: 'manual' });
      expect([307, 308]).toContain(res.status);
      const location = res.headers.get('location');
      expect(location).toContain('/login?error=MissingSSOToken');
    });

    it('GET /sso/callback redirects to /login with error on missing parameters', async () => {
      const res = await fetch(`${BASE_URL}/sso/callback`, { redirect: 'manual' });
      expect([307, 308]).toContain(res.status);
      const location = res.headers.get('location');
      expect(location).toContain('/login?error=MissingSSOToken');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns 401 when no refresh token cookie is provided', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'No refresh token provided.' });
    });

    it('returns 401 when an invalid refresh token is provided', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Cookie: 'refreshToken=non_existent_token_hex_1234567890abcdef',
        },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/Invalid refresh token/i);
    });
  });

  describe('POST /api/attendance/heartbeat', () => {
    it('redirects unauthenticated heartbeat calls to /login (enforced by proxy middleware)', async () => {
      const res = await fetch(`${BASE_URL}/api/attendance/heartbeat`, {
        method: 'POST',
        redirect: 'manual',
      });
      expect([307, 308]).toContain(res.status);
      const location = res.headers.get('location');
      expect(location).toContain('/login');
    });

    it('processes heartbeat when called with valid user session', async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/attendance/heartbeat`, {
        method: 'POST',
        headers: authHeaders,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body).toBe('object');
    });
  });
});
