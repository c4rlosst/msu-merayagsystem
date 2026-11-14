import { redirect } from 'next/navigation';
import { identity } from '../../lib/session.js';
import { AuthScreen } from '../../lib/auth-screen.js';

export default async function AdminLogin() {
  if ((await identity())?.role === 'admin') redirect('/clinic');
  return <AuthScreen admin />;
}
