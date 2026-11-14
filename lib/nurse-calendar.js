import Link from 'next/link';
import { clinicDate } from './clinic.js';
import { ActionForm } from '../app/forms.js';
import { clinicAction } from '../app/actions.js';

const localDay = (date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila' }).format(new Date(date));
const dayKey = (date) => date.toISOString().slice(0, 10);
const shiftMonth = (date, offset) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));

export async function NurseCalendar({ db, filters, appointmentId }) {
  const today = localDay(Date.now());
  const requested = typeof filters.date === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(filters.date) ? filters.date : today;
  const parsed = new Date(requested + 'T00:00:00Z');
  const selected = Number.isFinite(+parsed) && dayKey(parsed) === requested ? requested : today;
  const first = new Date(selected.slice(0, 7) + '-01T00:00:00Z');
  const end = shiftMonth(first, 1);
  const path = appointmentId ? '/clinic/appointment/' + appointmentId : '/clinic/calendar';
  const dateLink = (date) => path + '?date=' + date + '#calendar';
  const bookings = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from('appointments')
      .select('id, reference_number, reason, requested_start, requested_end, status')
      .in('status', ['confirmed', 'checked_in', 'completed', 'no_show'])
      .lt('requested_start', dayKey(end) + 'T00:00:00+08:00')
      .gt('requested_end', dayKey(first) + 'T00:00:00+08:00')
      .order('requested_start').order('id').range(offset, offset + pageSize - 1);
    if (error) throw new Error('Could not load the appointment calendar.');
    bookings.push(...data);
    if (data.length < pageSize) break;
  }

  const onDay = (day) => bookings.filter((visit) =>
    localDay(visit.requested_start) <= day && localDay(Date.parse(visit.requested_end) - 1) >= day);
  const days = Array.from({ length: new Date(+end - 86400000).getUTCDate() }, (_, index) =>
    dayKey(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), index + 1))));
  const time = (value) => clinicDate(value, { timeStyle: 'short' });

  return <section className="paper form-stack" id="calendar" aria-label="Appointment calendar">
    <div className="section-heading">
      <Link aria-label="Previous month" href={dateLink(dayKey(shiftMonth(first, -1)))}>← Previous</Link>
      <h2>{clinicDate(first, { month: 'long', year: 'numeric' })}</h2>
      <Link aria-label="Next month" href={dateLink(dayKey(end))}>Next →</Link>
    </div>
    <div className="calendar-grid" aria-label="Choose a calendar date">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
      {Array.from({ length: first.getUTCDay() }, (_, index) => <span key={'blank-' + index} />)}
      {days.map((day) => {
        const count = onDay(day).length;
        return <Link key={day} href={dateLink(day)} aria-current={day === selected ? 'date' : undefined}
          aria-label={clinicDate(day + 'T00:00:00+08:00', { dateStyle: 'full' }) + ', ' + count + ' bookings'}>
          {Number(day.slice(-2))}{count > 0 && <small>{count}</small>}
        </Link>;
      })}
    </div>
    <div>
      <h3>{clinicDate(selected + 'T00:00:00+08:00', { dateStyle: 'full' })}</h3>
      {onDay(selected).length ? <ul>{onDay(selected).map((visit) => <li key={visit.id}>
        <Link href={'/clinic/appointment/' + visit.id}>{time(visit.requested_start)}–{time(visit.requested_end)} · {visit.reason} · {visit.reference_number}</Link>
      </li>)}</ul> : <p>No bookings on this date.</p>}
    </div>
    {appointmentId && selected >= today && <ActionForm key={selected} action={clinicAction.bind(null, 'assign_time')} label="Confirm appointment" className="form-stack">
      <input type="hidden" name="id" value={appointmentId} />
      <input type="hidden" name="date" value={selected} />
      <div className="field-grid">
        <label>Start time (Manila)<input type="time" name="start" required /></label>
        <label>End time (Manila)<input type="time" name="end" required /></label>
      </div>
    </ActionForm>}
  </section>;
}
