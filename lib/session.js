import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const cookieName = '__Host-merayag';
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };

export function database(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    ...options, global: token ? { headers: { Authorization: 'Bearer ' + token } } : {}
  });
}

export function storageAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
}

function sessionKey() {
  const key = Buffer.from(process.env.CLINIC_SESSION_KEY ?? '', 'base64');
  if (key.length !== 32) throw new Error('Configure a 32-byte session key');
  return key;
}

export async function saveSession(session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(session.access_token, 'utf8'), cipher.final()]);
  (await cookies()).set(cookieName, Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: Math.min(session.expires_in ?? 3600, 3600)
  });
}

export async function clearSession() {
  (await cookies()).set(cookieName, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

// Wrapped in cache(): the clinic layout and the page both ask who is signed in during one request,
// and this makes that a single lookup instead of two.
export const identity = cache(async () => {
  const cookie = (await cookies()).get(cookieName)?.value;
  if (!cookie) return null;
  let token;
  try {
    const packed = Buffer.from(cookie, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', sessionKey(), packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    token = Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
  const db = database(token);
  // The two checks don't depend on each other, so run them together: one round trip to the
  // database instead of two in a row on every page.
  const [{ data: { user } }, { data: role, error }] = await Promise.all([
    db.auth.getUser(token), db.rpc('current_clinic_role')
  ]);
  if (!user?.email_confirmed_at) return null;
  if (error || !role) return null;
  return { db, user, role };
});

export async function requireRole(...roles) {
  const session = await identity();
  if (!session) redirect('/');
  if (roles.length && !roles.includes(session.role)) redirect('/clinic');
  return session;
}
