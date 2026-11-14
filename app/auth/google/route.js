import { NextResponse } from 'next/server';
import { googleAuthClient, googleAuthOrigin, schoolDomains } from '../../../lib/google-auth.js';

export async function GET(request) {
  const origin = googleAuthOrigin();
  if (!origin) return NextResponse.redirect(new URL('/?google=setup', request.url));
  const client = await googleAuthClient();
  const domains = schoolDomains();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin + '/auth/callback',
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account', ...(domains.length === 1 ? { hd: domains[0] } : {}) }
    }
  });
  return NextResponse.redirect(error || !data?.url ? origin + '/?google=failed' : data.url);
}
