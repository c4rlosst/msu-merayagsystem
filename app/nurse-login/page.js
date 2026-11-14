import { redirect } from 'next/navigation';
import { identity } from '../../lib/session.js';
import { AuthScreen } from '../../lib/auth-screen.js';

export default async function NurseLogin() {
  if ((await identity())?.role === 'nurse') redirect('/clinic');
  return <AuthScreen nurse />;
}
