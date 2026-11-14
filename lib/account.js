import { Heading } from './clinic-ui.js';
import { ActionForm, PasswordField } from '../app/forms.js';
import { changePassword } from '../app/actions.js';

/** Account page for nurses, physicians and administrators: who is signed in, and a way to change the password. */
export function AccountView({ name, account, roleLabel }) {
  return <>
    <Heading title="Account">Signed in as {name}{account !== name ? ' (' + account + ')' : ''} · {roleLabel}</Heading>
    <div className="split">
      <ActionForm action={changePassword} label="Change password" className="panel panel-form">
        <h2>Change password</h2>
        <p>Enter your current password, then choose a new one. You will be signed out and log in again with it.</p>
        <PasswordField label="Current password" name="current" autoComplete="current-password" maxLength={1024} />
        <PasswordField label="New password" name="password" autoComplete="new-password" minLength={6} maxLength={72}
          hint={<small>Use at least 6 characters.</small>} />
        <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" minLength={6} maxLength={72} />
      </ActionForm>
    </div>
  </>;
}
