'use client';

import { useActionState, useState } from 'react';
import { signIn, submitBooking } from './actions.js';

export function ActionForm({ action, children, label, className }) {
  const [state, dispatch, pending] = useActionState(action, {});
  return <form action={dispatch} className={className}>
    {children}
    {state?.error && <p role="alert" className="error">{state.error}</p>}
    <button disabled={pending}>{pending ? 'Saving…' : label}</button>
  </form>;
}

export function LoginForm({ signup = false, password = false, nurse = false, emailDomain }) {
  const [state, dispatch, pending] = useActionState(signIn.bind(null, nurse), {});
  // With a single school domain, people only type the part before the @. The domain appears in the field
  // once they press @ (or paste a full address); the full address is always sent as `email`.
  const [username, setUsername] = useState('');
  const [domainShown, setDomainShown] = useState(false);
  const [matched, setMatched] = useState(null); // chars of the domain typed by hand since "@" (null: not typing it)
  const presetEmail = !nurse && emailDomain && !state.email;
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
    {nurse ? <label>Nurse ID<input name="nurse_id" autoComplete="username" placeholder="N-01" maxLength={10} required /></label> :
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
    {password && <label>Clinic account password<input type="password" name="password" autoComplete="current-password" maxLength={1024} required /></label>}
    {signup && !state.email && <>
      <input type="hidden" name="create_account" value="yes" />
      <label>Create a clinic password<input type="password" name="password" autoComplete="new-password" minLength={6} maxLength={72} required />
        <small>Use at least 6 characters.</small>
      </label>
    </>}
    {state.email && <label>Email code<input name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>}
    {state.message && <p role="status">{state.message}</p>}
    {state.error && <p role="alert" className="error">{state.error}</p>}
    <button disabled={pending}>{pending ? 'Please wait…' : password ? 'Log in' : state.email ? (signup ? 'Verify email and continue' : 'Log in') : (signup ? 'Create account' : 'Send sign-in code')}</button>
    {state.email && <a href={signup ? "/signup" : "/"}>Use a different email or request a new code</a>}
  </form>;
}

export function BookingForm({ reasons, preview = false }) {
  const [state, dispatch, pending] = useActionState(preview ? async () => ({ message: 'Preview complete. This sample request has not been sent to the clinic.' }) : submitBooking, {});
  const [reason, setReason] = useState('');
  return <form action={dispatch}>
    <section className="paper form-stack">
      <h2>Visit details</h2>
      <label>How soon do you need a visit?
        <select name="urgency" defaultValue="" required>
          <option value="" disabled>Choose an urgency level</option>
          <option value="urgent">As soon as possible</option>
          <option value="soon">In the next few days</option>
          <option value="flexible">I can wait</option>
        </select>
      </label>
      <small>For emergencies, seek immediate help.</small>
      <fieldset className="choice-grid"><legend>Reason for visit</legend>
        {reasons.map((item) => <label key={item} className="choice"><input type="radio" name="reason" value={item}
          checked={reason === item} onChange={() => setReason(item)} required />{item}</label>)}
      </fieldset>
      <label>Describe your concern<textarea name="concern" required maxLength={4000} rows={4} /></label>
      <label>Referral or excuse letter {reason === 'Medical certificate' ? '(required)' : '(optional)'}
        <input type="file" name="letter" accept="image/jpeg,image/png,application/pdf" required={reason === 'Medical certificate'} />
        <small>JPG, PNG, or PDF. Up to 5 MB.</small>
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button disabled={pending}>{pending ? 'Booking…' : preview ? 'Preview request' : 'Request appointment'}</button>
      {state.message && <p role="status">{state.message}</p>}
    </section>
  </form>;
}

export function PrintButton() {
  return <button className="no-print" onClick={() => window.print()}>Print certificate</button>;
}
