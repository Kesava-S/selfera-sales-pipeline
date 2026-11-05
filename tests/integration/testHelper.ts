import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3005';

let cachedCookieHeader: string | null = null;

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (cachedCookieHeader) {
    return {
      'Content-Type': 'application/json',
      Cookie: cachedCookieHeader,
    };
  }

  // 1. Try reading saved session from playwright auth if available
  const authFilePath = path.resolve(process.cwd(), 'playwright/.auth/user.json');
  if (fs.existsSync(authFilePath)) {
    try {
      const auth = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
      if (Array.isArray(auth.cookies) && auth.cookies.length > 0) {
        cachedCookieHeader = auth.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
        return {
          'Content-Type': 'application/json',
          Cookie: cachedCookieHeader!,
        };
      }
    } catch {
      // Fallback to fresh login
    }
  }

  // 2. Perform direct Supabase signInWithPassword to get session
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be configured in environment');
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Failed to authenticate test user: ${error?.message}`);
  }

  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
  const tokenCookie = `sb-${projectRef}-auth-token=${encodeURIComponent(
    JSON.stringify([data.session.access_token, data.session.refresh_token])
  )}`;
  const refreshCookie = `refreshToken=${data.session.refresh_token}`;
  cachedCookieHeader = `${tokenCookie}; ${refreshCookie}`;

  return {
    'Content-Type': 'application/json',
    Cookie: cachedCookieHeader,
  };
}

export function getDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    db: { schema: 'sales-pipe' },
    auth: { persistSession: false },
  });
}

