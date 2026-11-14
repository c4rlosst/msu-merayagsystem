import { redirect } from 'next/navigation';
import { identity } from '../../lib/session.js';
import { AuthScreen } from '../../lib/auth-screen.js';

export default async function NurseLogin() {
  if (['nurse', 'admin'].includes((await identity())?.role)) redirect('/clinic');
  return <AuthScreen nurse />;
}
