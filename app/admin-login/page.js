import { redirect } from 'next/navigation';

// Administrators use the same staff sign-in as nurses.
export default function AdminLogin() {
  redirect('/nurse-login');
}
