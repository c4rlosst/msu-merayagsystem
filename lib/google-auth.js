import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const verifierCookie = '__Host-merayag-oauth';

export function schoolDomains() {
  return (process.env.CLINIC_SCHOOL_DOMAINS ?? 'msugensan.edu.ph')
    .split(',').map((domain) => domain.trim().toLowerCase()).filter(Boolean);
}

export function googleAuthOrigin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY ||
      Buffer.from(process.env.CLINIC_SESSION_KEY ?? '', 'base64').length !== 32) return null;
  try {
    const url = new URL(process.env.CLINIC_APP_ORIGIN);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) return url.origin;
  } catch {
    return null;
  }
  return null;
}

export async function googleAuthClient() {
  const jar = await cookies();
  const storage = {
    getItem: (key) => key.endsWith('-code-verifier') ? jar.get(verifierCookie)?.value ?? null : null,
    setItem(key, value) {
      if (key.endsWith('-code-verifier')) {
        jar.set(verifierCookie, value, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 });
      }
    },
    removeItem(key) {
      if (key.endsWith('-code-verifier')) {
        jar.set(verifierCookie, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
      }
    }
  };
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: 'pkce', storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
