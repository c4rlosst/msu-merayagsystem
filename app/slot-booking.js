'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { submitSlotBooking } from './actions.js';
import { WEEKDAYS, addMonths, dayLabel, daysInMonth, manilaDate, manilaMinutes, monthLabel, monthStart, timeLabel, weekday } from '../lib/manila.js';

/**
 * Student booking: pick a day that has open times, pick a time, then say why you are coming.
 * `slots` are the open times the nurses published: { id, start, end, left } with millisecond times.
 */
export function SlotBooking({ slots, reasons, requestHref, preview = false }) {
  const byDay = useMemo(() => {
    const days = new Map();
    for (const slot of slots) {
      const key = manilaDate(slot.start);
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(slot);
    }
    for (const list of days.values()) list.sort((a, b) => a.start - b.start);
    return days;
  }, [slots]);
  const openDays = useMemo(() => [...byDay.keys()].sort(), [byDay]);

  const [day, setDay] = useState(openDays[0] ?? '');
  const [month, setMonth] = useState(monthStart(openDays[0] ?? manilaDate(Date.now())));
  const [slotId, setSlotId] = useState('');
  const [reason, setReason] = useState('');
  const [state, dispatch, pending] = useActionState(
    preview ? async () => ({ message: 'Preview only: nothing was booked.' }) : submitSlotBooking, {});

  const times = byDay.get(day) ?? [];
  const chosen = times.find((slot) => slot.id === slotId);
  const monthDays = Array.from({ length: daysInMonth(month) }, (_, index) => month.slice(0, 8) + String(index + 1).padStart(2, '0'));

  if (!slots.length) {
    return <div className="paper no-slots">
      <h2>No open times right now</h2>
      <p>The nurses haven’t opened any times yet. Check back soon, or send a request and a nurse will pick a time for you.</p>
      <Link className="button" href={requestHref}>Send a request</Link>
    </div>;
  }

  return <form action={dispatch} className="slot-booking">
    <section className="paper slot-picker" aria-label="Choose a day and time">
      <div className="cal-head">
        <button type="button" className="quiet" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
        <h2 aria-live="polite">{monthLabel(month)}</h2>
        <button type="button" className="quiet" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>
      <div className="cal-grid" role="group" aria-label="Days with open times">
        {WEEKDAYS.map((name) => <span key={name} className="cal-dow">{name}</span>)}
        {Array.from({ length: weekday(month) }, (_, index) => <span key={'blank-' + index} />)}
        {monthDays.map((key) => {
          const open = byDay.has(key);
          return <button type="button" key={key} disabled={!open} className={'cal-day' + (open ? ' has-slots' : '')}
            aria-pressed={key === day} aria-label={dayLabel(key) + (open ? ', ' + byDay.get(key).length + ' open times' : ', no open times')}
            onClick={() => { setDay(key); setSlotId(''); }}>{Number(key.slice(8))}</button>;
        })}
      </div>
      <fieldset className="slot-field">
        <legend>{day ? 'Open times on ' + dayLabel(day) : 'Pick a day to see open times'}</legend>
        <div className="slot-times">{times.map((slot) => <label className="slot" key={slot.id}>
          <input type="radio" name="slot" value={slot.id} checked={slotId === slot.id} onChange={() => setSlotId(slot.id)} required />
          <b>{timeLabel(manilaMinutes(slot.start))}</b><small>{slot.left} {slot.left === 1 ? 'place' : 'places'} left</small>
        </label>)}</div>
      </fieldset>
    </section>

    <section className="paper form-stack">
      <fieldset className="chip-field"><legend>Reason for visit</legend>
        <div className="chips">{reasons.map((item) => <label key={item} className="chip"><input type="radio" name="reason" value={item}
          checked={reason === item} onChange={() => setReason(item)} required /><span>{item}</span></label>)}</div>
      </fieldset>
      <label>Describe your concern<textarea name="concern" required maxLength={4000} rows={4} /></label>
      <label>Referral or excuse letter {reason === 'Medical certificate' ? '(required)' : '(optional)'}
        <input type="file" name="letter" accept="image/jpeg,image/png,application/pdf" required={reason === 'Medical certificate'} />
        <small>JPG, PNG, or PDF. Up to 5 MB.</small>
      </label>
      <p className="slot-summary" role="status">{chosen
        ? dayLabel(day) + ' · ' + timeLabel(manilaMinutes(chosen.start)) + ' – ' + timeLabel(manilaMinutes(chosen.end))
        : 'Choose a day and time on the left.'}</p>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
      <button disabled={pending || !chosen}>{pending ? 'Booking…' : 'Book this time'}</button>
      <p className="slot-fallback">No time that works? <Link href={requestHref}>Send a request instead</Link>. For emergencies, seek immediate help.</p>
    </section>
  </form>;
}
