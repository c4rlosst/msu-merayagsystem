import { NextResponse } from 'next/server';
import { googleAuthClient, googleAuthOrigin, schoolDomains } from '../../../lib/google-auth.js';
import { saveSession } from '../../../lib/session.js';

export async function GET(request) {
  const origin = googleAuthOrigin();
  if (!origin) return NextResponse.redirect(new URL('/?google=setup', request.url));
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(origin + '/?google=failed');

  const client = await googleAuthClient();
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data.session) return NextResponse.redirect(origin + '/?google=failed');

  const user = data.user;
  const email = user?.email?.toLowerCase();
  const googleIdentity = user?.identities?.find((identity) => identity.provider === 'google' &&
    identity.identity_data?.email?.toLowerCase() === email && identity.identity_data?.email_verified === true);
  if (!user?.email_confirmed_at || !googleIdentity || !schoolDomains().includes(email?.split('@')[1])) {
    return NextResponse.redirect(origin + '/?google=school');
  }

  await saveSession(data.session);
  return NextResponse.redirect(origin + '/clinic');
}
