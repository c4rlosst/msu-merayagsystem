import { redirect } from 'next/navigation';
import { identity } from '../../lib/session.js';
import { AuthScreen } from '../../lib/auth-screen.js';

export default async function NurseLogin({ searchParams }) {
  if (['nurse', 'admin'].includes((await identity())?.role)) redirect('/clinic');
  return <AuthScreen nurse notice={(await searchParams).changed ? 'Password changed. Log in with your new password.' : undefined} />;
}
