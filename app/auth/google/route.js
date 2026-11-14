import { NextResponse } from 'next/server';
import { googleAuthClient, googleAuthOrigin, schoolDomains } from '../../../lib/google-auth.js';

// Until the Google provider is switched on in Supabase, send people back with a friendly
// "being configured" message instead of Supabase's raw error page.
async function googleEnabled() {
  try {
    const response = await fetch(process.env.SUPABASE_URL + '/auth/v1/settings', {
      headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY }, cache: 'no-store'
    });
    return (await response.json())?.external?.google === true;
  } catch {
    return true; // if the check itself fails, let Supabase decide
  }
}

export async function GET(request) {
  const origin = googleAuthOrigin();
  if (!origin || !(await googleEnabled())) return NextResponse.redirect(new URL('/?google=setup', request.url));
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
