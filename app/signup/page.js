import { redirect } from 'next/navigation';
import { identity } from '../../lib/session.js';
import { AuthScreen } from '../../lib/auth-screen.js';

export default async function Signup() {
  if (await identity()) redirect('/clinic');
  return <AuthScreen signup />;
}
