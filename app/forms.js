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

export function LoginForm({ signup = false }) {
  const [state, dispatch, pending] = useActionState(signIn, {});
  return <form action={dispatch} className="form-stack">
    <label>School email<input type="email" name="email" autoComplete="email" required
      key={state.email ?? 'email'} defaultValue={state.email} readOnly={Boolean(state.email)} /></label>
    {state.email && <label>Email code<input name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>}
    {state.message && <p role="status">{state.message}</p>}
    {state.error && <p role="alert" className="error">{state.error}</p>}
    <button disabled={pending}>{pending ? 'Please wait…' : state.email ? (signup ? 'Verify email and continue' : 'Log in') : (signup ? 'Create account' : 'Send sign-in code')}</button>
    {state.email && <a href={signup ? "/signup" : "/"}>Use a different email or request a new code</a>}
  </form>;
}

export function BookingForm({ groups, reasons, preview = false }) {
  const [state, dispatch, pending] = useActionState(preview ? async () => ({ message: 'Preview complete. This sample request has not been sent to the clinic.' }) : submitBooking, {});
  const [day, setDay] = useState(groups[0]?.key);
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState('');
  const active = groups.find((group) => group.key === day);
  return <form action={dispatch} className="booking-grid">
    <section className="paper">
      <h2>Clinic availability</h2>
      <label>Visit date<select value={day} onChange={(event) => { setDay(event.target.value); setSlot(''); }}>
        {groups.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}
      </select></label>
      <fieldset className="choice-grid"><legend>Available times</legend>
        {active?.slots.map((time) => <label className="choice" key={time.id}>
          <input type="radio" name="slot" value={time.id} checked={slot === time.id} onChange={() => setSlot(time.id)} required />
          <span><strong>{time.label}</strong><small>{time.remaining} {time.remaining === 1 ? 'place' : 'places'} left</small></span>
        </label>)}
      </fieldset>
    </section>
    <section className="paper form-stack">
      <h2>Visit details</h2>
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
