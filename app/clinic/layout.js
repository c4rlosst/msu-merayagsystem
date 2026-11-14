import { requireRole } from '../../lib/session.js';
import { ClinicShell } from './clinic-shell.js';

// Signed-in frame for every clinic page. Pages still check their own role; this keeps the sidebar
// in place between pages so only the content area reloads.
export default async function ClinicLayout({ children }) {
  const { user, role } = await requireRole();
  return <ClinicShell role={role} email={user.email}>{children}</ClinicShell>;
}
