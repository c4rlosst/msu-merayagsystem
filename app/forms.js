'use client';

import { useActionState, useId, useState } from 'react';
import { signIn, submitBooking } from './actions.js';
import { FileDrop } from './file-drop.js';

// A password input with an eye button that shows or hides what was typed.
export function PasswordField({ label, hint, ...inputProps }) {
  const [shown, setShown] = useState(false);
  const labelId = useId();
  return <label>
    <span id={labelId}>{label}</span>
    <span className="password-group">
      <input {...inputProps} type={shown ? 'text' : 'password'} aria-labelledby={labelId}
        autoCapitalize="none" spellCheck={false} required />
      <button type="button" className="password-toggle" aria-pressed={shown}
        aria-label={shown ? 'Hide password' : 'Show password'} title={shown ? 'Hide password' : 'Show password'}
        onMouseDown={(event) => event.preventDefault()} /* keep the cursor in the field */
        onClick={() => setShown((value) => !value)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {shown
            ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="m1 1 22 22" /></>
            : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </span>
    {hint}
  </label>;
}

export function ActionForm({ action, children, label, className }) {
  const [state, dispatch, pending] = useActionState(action, {});
  return <form action={dispatch} className={className}>
    {children}
    {state?.error && <p role="alert" className="error">{state.error}</p>}
    {state?.message && <p role="status" className="success">{state.message}</p>}
    <button disabled={pending}>{pending ? 'Saving…' : label}</button>
  </form>;
}

export function LoginForm({ signup = false, password = false, nurse = false, emailDomain }) {
  const [state, dispatch, pending] = useActionState(signIn.bind(null, nurse ? 'staff' : false), {});
  const staff = nurse; // nurses and administrators sign in with an ID
  // With a single school domain, people only type the part before the @. The domain appears in the field
  // once they press @ (or paste a full address); the full address is always sent as `email`.
  const [username, setUsername] = useState('');
  const [domainShown, setDomainShown] = useState(false);
  const [matched, setMatched] = useState(null); // chars of the domain typed by hand since "@" (null: not typing it)
  const presetEmail = !staff && emailDomain && !state.email;
  function changeUsername(event) {
    const raw = event.target.value, kind = event.nativeEvent.inputType ?? '';
    const clean = (text) => text.replace(/\s/g, '');
    if (raw.includes('@')) { // typed "@": just reveal the domain; pasted/autofilled address: keep the username only
      const single = kind === 'insertText' && raw.length === username.length + 1;
      setUsername(clean(single ? raw.replace('@', '') : raw.split('@')[0]));
      setDomainShown(true);
      setMatched(0);
      return;
    }
    if (matched !== null && kind === 'insertText' && raw.startsWith(username)) {
      const added = raw.slice(username.length).toLowerCase(); // they may be typing the domain out by hand
      if (added && added === emailDomain.slice(matched, matched + added.length)) { // it's already shown: swallow it
        const total = matched + added.length;
        setMatched(total < emailDomain.length ? total : null);
        return;
      }
    }
    setUsername(clean(raw));
    setMatched(null);
  }
  return <form action={dispatch} className="form-stack">
    {staff ? <label>Staff ID<input name="nurse_id" autoComplete="username" placeholder="N-01 or A-01" maxLength={10} required /></label> :
      presetEmail ? <label>School email
        <span className="email-group" data-domain={domainShown}>
          <span className="email-sizer" data-value={username}>
            <input value={username} onChange={changeUsername} onBlur={() => setMatched(null)}
              onKeyDown={(event) => { if (event.key === 'Backspace' && !username && domainShown) { setDomainShown(false); setMatched(null); } }}
              type="text" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              maxLength={64} required />
          </span>
          {domainShown && <span className="email-domain">@{emailDomain}</span>}
        </span>
        <input type="hidden" name="email" value={username + '@' + emailDomain} />
      </label> :
      <label>School email<input type="email" name="email" autoComplete="email" required
        key={state.email ?? 'email'} defaultValue={state.email} readOnly={Boolean(state.email)} /></label>}
    {password && <PasswordField label="Clinic account password" name="password" autoComplete="current-password" maxLength={1024} />}
    {signup && !state.email && <>
      <input type="hidden" name="create_account" value="yes" />
      <PasswordField label="Create a clinic password" name="password" autoComplete="new-password" minLength={6} maxLength={72}
        hint={<small>Use at least 6 characters.</small>} />
    </>}
    {state.email && <label>Email code<input name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>}
    {state.message && <p role="status">{state.message}</p>}
    {state.error && <p role="alert" className="error">{state.error}</p>}
    <button disabled={pending}>{pending ? 'Please wait…' : password ? 'Log in' : state.email ? (signup ? 'Verify email and continue' : 'Log in') : (signup ? 'Create account' : 'Send sign-in code')}</button>
    {state.email && <a href={signup ? "/signup" : "/"}>Use a different email or request a new code</a>}
  </form>;
}

const urgencies = [['urgent', 'As soon as possible'], ['soon', 'In the next few days'], ['flexible', 'I can wait']];

export function BookingForm({ reasons, preview = false }) {
  const [state, dispatch, pending] = useActionState(preview ? async () => ({ message: 'Preview complete. This sample request has not been sent to the clinic.' }) : submitBooking, {});
  const [reason, setReason] = useState('');
  return <form action={dispatch} className="booking-layout">
    <section className="paper form-stack">
      <fieldset className="chip-field"><legend>How soon do you need a visit?</legend>
        <div className="chips">{urgencies.map(([value, label]) => <label key={value} className="chip">
          <input type="radio" name="urgency" value={value} required /><span>{label}</span></label>)}</div>
      </fieldset>
      <fieldset className="chip-field"><legend>Reason for visit</legend>
        <div className="chips">{reasons.map((item) => <label key={item} className="chip"><input type="radio" name="reason" value={item}
          checked={reason === item} onChange={() => setReason(item)} required /><span>{item}</span></label>)}</div>
      </fieldset>
      <label>Describe your concern<textarea name="concern" required maxLength={4000} rows={4} /></label>
      <FileDrop name="letter" accept="image/jpeg,image/png,application/pdf" required={reason === 'Medical certificate'}
        label={'Referral or excuse letter ' + (reason === 'Medical certificate' ? '(required)' : '(optional)')} hint="JPG, PNG or PDF (max. 5 MB)" />
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="submit" disabled={pending}>{pending ? 'Booking…' : preview ? 'Preview request' : 'Request appointment'}</button>
      {state.message && <p role="status">{state.message}</p>}
    </section>
    <aside className="paper next-steps" aria-label="What happens next">
      <h2>What happens next</h2>
      <ol>
        <li>You send this request.</li>
        <li>A nurse picks a date and time.</li>
        <li>Your visit appears on Home and in My appointments.</li>
      </ol>
      <p className="alert-note">For emergencies, seek immediate help.</p>
    </aside>
  </form>;
}

export function PrintButton() {
  return <button className="no-print" onClick={() => window.print()}>Print certificate</button>;
}
