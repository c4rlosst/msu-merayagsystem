import Link from 'next/link';
import { clinicDate } from './clinic.js';
import { Heading, Panel, StatTiles } from './clinic-ui.js';
import { accountLabel } from './staff-id.js';
import { ActionForm, PasswordField } from '../app/forms.js';
import { createNurseAccount, manageStaffAccess } from '../app/actions.js';

const roleNames = { nurse: 'Nurse', physician: 'Physician', admin: 'Administrator' };

/** Admin: add nurses and manage who can work in the clinic portals. `staff` comes from list_clinic_staff(). */
export function AdminDeskView({ staff }) {
  const active = staff.filter((member) => member.active);
  const tiles = [
    ['Active nurses', active.filter((member) => member.role === 'nurse').length, 'users'],
    ['Active physicians', active.filter((member) => member.role === 'physician').length, 'user'],
    ['Access revoked', staff.length - active.length, 'lock']
  ];
  return <>
    <Heading title="Staff access">Add nurses and manage who can work in the clinic portals.</Heading>
    <StatTiles items={tiles} />
    <div className="split">
        <ActionForm action={createNurseAccount} label="Add nurse" className="panel panel-form">
          <h2>Add a nurse</h2>
          <p>The nurse signs in at the Nurse Portal with this ID and password. Give them the password in person.</p>
          <label>Full name<input name="full_name" autoComplete="off" maxLength={80} required /></label>
          <label>Nurse ID<input name="nurse_id" placeholder="N-01" maxLength={10} required /></label>
          <PasswordField label="Temporary password" name="password" autoComplete="new-password" minLength={6} maxLength={72}
            hint={<small>Use at least 6 characters.</small>} />
        </ActionForm>
        <ActionForm action={manageStaffAccess} label="Give access" className="panel panel-form">
          <h2>Add by email</h2>
          <p>For someone who already has a verified clinic account, such as a physician.</p>
          <input type="hidden" name="access" value="grant" />
          <label>Staff email<input type="email" name="email" required maxLength={254} /></label>
          <label>Role<select name="role"><option value="nurse">Nurse</option><option value="physician">Physician</option></select></label>
        </ActionForm>
    </div>
      <Panel title="Staff directory" count={staff.length} action={<Link href="/clinic/audit">View audit log</Link>}>
        <div className="table-scroll"><table className="admin-table">
          <thead><tr><th scope="col">Staff</th><th scope="col">Role</th><th scope="col">Access</th><th scope="col">Last sign-in</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{staff.map((member) => <tr key={member.email}>
            <td><strong>{member.full_name || accountLabel(member.email)}</strong>{member.full_name && <small>{accountLabel(member.email)}</small>}</td>
            <td>{roleNames[member.role]}</td>
            <td><span className={member.active ? 'badge confirmed' : 'badge cancelled'}>{member.active ? 'Active' : 'Revoked'}</span></td>
            <td>{member.last_sign_in_at ? clinicDate(member.last_sign_in_at, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}</td>
            <td>{member.role !== 'admin' && <ActionForm action={manageStaffAccess} label={member.active ? 'Revoke' : 'Restore'}>
              <input type="hidden" name="email" value={member.email} />
              <input type="hidden" name="role" value={member.role} />
              <input type="hidden" name="access" value={member.active ? 'revoke' : 'grant'} />
            </ActionForm>}</td>
          </tr>)}</tbody>
        </table></div>
      </Panel>
  </>;
}
