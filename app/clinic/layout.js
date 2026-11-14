import { requireRole } from '../../lib/session.js';
import { accountLabel } from '../../lib/staff-id.js';
import { ClinicShell } from './clinic-shell.js';

// Signed-in frame for every clinic page. Pages still check their own role; this keeps the sidebar
// in place between pages so only the content area reloads.
export default async function ClinicLayout({ children }) {
  const { user, role } = await requireRole();
  // Google sign-in supplies the name and photo. Only a Google-hosted photo is ever shown.
  const meta = user.user_metadata ?? {};
  if (role !== 'student') {
    // Staff: a nurse signs in with an ID kept as a private email address, so show the name and the ID.
    const account = accountLabel(user.email);
    const named = meta.full_name || meta.name;
    return <ClinicShell role={role} email={user.email} name={named || account} detail={named ? account : ''}>{children}</ClinicShell>;
  }
  const photo = meta.avatar_url ?? meta.picture;
  const avatar = typeof photo === 'string' && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//i.test(photo) ? photo : null;
  const name = meta.family_name || meta.full_name || meta.name || user.email.split('@')[0];
  const detail = meta.family_name ? meta.given_name : user.email;
  return <ClinicShell role={role} email={user.email} name={name} detail={detail} avatar={avatar}>{children}</ClinicShell>;
}
