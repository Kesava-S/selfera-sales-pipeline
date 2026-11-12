import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getDynamicEmailConfig, getWhatsAppConfig } from '@/lib/integrations';
import crypto from 'crypto';

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

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

export function getBearerHeaders(): Record<string, string> {
  const secret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
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

// Webhook secrets: the same values the app uses (Integrations, with .env as fallback)
const [waConfig, emailConfig] = await Promise.all([
  getWhatsAppConfig().catch(() => null),
  getDynamicEmailConfig().catch(() => null),
]);
export const WEBHOOK_SECRETS = {
  whatsappAppSecret: waConfig?.app_secret || process.env.WHATSAPP_APP_SECRET || '',
  whatsappVerifyToken: waConfig?.verify_token || process.env.WHATSAPP_VERIFY_TOKEN || '',
  resendWebhookSecret: emailConfig?.resend_webhook_secret || process.env.RESEND_WEBHOOK_SECRET || '',
};

export function signWhatsAppPayload(bodyString: string): string {
  const secret = WEBHOOK_SECRETS.whatsappAppSecret;
  return 'sha256=' + crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
}

export function createSvixHeaders(rawBody: string, secret?: string) {
  const sec = secret || WEBHOOK_SECRETS.resendWebhookSecret;
  const id = `msg_${Date.now()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(sec.replace(/^whsec_/, ''), 'base64');
  const signature = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64');

  return {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
  };
}

