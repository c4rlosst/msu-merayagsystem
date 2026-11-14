import Link from 'next/link';
import { clinicDate, statuses } from './clinic.js';

const timeOf = (value) => clinicDate(value, { hour: 'numeric', minute: '2-digit' }).toUpperCase();

// The date block at the start of a visit row: a big day number over the month, or a gold "open"
// block when the nurse hasn't picked a time yet.
export function VisitDate({ value, fallback = 'Open' }) {
  if (!value) return <span className="visit-date is-open"><b>–</b><small>{fallback}</small></span>;
  return <time className="visit-date" dateTime={value}>
    <b>{clinicDate(value, { day: 'numeric' })}</b><small>{clinicDate(value, { month: 'short' })}</small>
  </time>;
}

export function StudentDashboard({ appointments, name = 'Student', released = 0, preview = false }) {
  const base = preview ? '/preview' : '/clinic';
  const url = (page) => preview ? base + '?page=' + page : base + '/' + page;
  const next = appointments.filter((visit) => visit.status === 'confirmed' &&
    Date.parse(visit.requested_start) > Date.now()).sort((a,b) => Date.parse(a.requested_start)-Date.parse(b.requested_start))[0];
  const count = (status) => appointments.filter((a) => a.status === status).length;
  const waiting = count('pending');
  const tally = [['Waiting for approval', waiting], ['Confirmed', count('confirmed')],
    ['Completed', count('completed')], ['Certificates ready', released]];
  const [clock, meridiem] = next ? timeOf(next.requested_start).split(' ') : [];
  return <div className="student-dashboard">
    <header className="page-heading"><h1>Welcome, {name.split(' ')[0]}</h1><p>{clinicDate(Date.now(), {dateStyle:'full'})}</p></header>
    {next ? <section className="ticket" aria-labelledby="next-visit">
      <div className="ticket-main">
        <h2 id="next-visit">Next visit</h2>
        <p className="ticket-day">{clinicDate(next.requested_start, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <p className="ticket-reason">{next.reason}</p>
        <p className="ticket-meta"><Status status={next.status}/><span>{next.reference_number}</span>
          {!preview && <Link href={'/clinic/appointment/' + next.id}>View details</Link>}</p>
      </div>
      <div className="ticket-stub" aria-label={'At ' + clock + ' ' + meridiem}><strong>{clock}</strong><span>{meridiem}</span></div>
    </section> : <section className="ticket is-empty" aria-labelledby="next-visit">
      <div className="ticket-main">
        <h2 id="next-visit">{waiting ? 'Waiting for a time' : 'No visit scheduled'}</h2>
        <p className="ticket-day">{waiting ? 'A nurse is choosing a time for your request.' : 'Need to see a nurse?'}</p>
        <p className="ticket-reason">{waiting ? 'Your confirmed time will appear here.' : 'Tell us why and how soon. A nurse will pick a time.'}</p>
        <Link className="button" href={url(waiting ? 'appointments' : 'book')}>{waiting ? 'View my requests' : 'Request a visit'}</Link>
      </div>
    </section>}
    <dl className="tally">{tally.map(([label, total]) => <div key={label} className={total ? undefined : 'is-zero'}><dt>{label}</dt><dd>{total}</dd></div>)}</dl>
    <section className="paper">
      <div className="section-heading"><h2>Recent visits</h2><Link href={url('appointments')}>View all</Link></div>
      <VisitList appointments={appointments.slice(0,3)} preview={preview} bookUrl={url('book')} showAction={false}/>
    </section>
  </div>;
}

// `showAction` is off where the page already offers a "Request a visit" button right above.
export function VisitList({ appointments, preview = false, bookUrl = '/clinic/book', showAction = true }) {
  if (!appointments.length) return <div className="appointment-empty"><h3>No appointments yet</h3><p>Request a visit for a health check, consultation, or medical certificate.</p>{showAction && <Link className="button" href={bookUrl}>Request a visit</Link>}</div>;
  return appointments.map((appointment) => {
    const when = appointment.requested_start;
    const waiting = appointment.status === 'pending';
    const details = <><VisitDate value={when} fallback={waiting ? 'Soon' : 'None'} />
      <span className="visit-what"><strong>{appointment.reason}</strong>
        <span className="visit-sub"><span>{when ? timeOf(when) : waiting ? 'Waiting for a time' : 'No time set'}</span><span>{appointment.reference_number}</span></span></span>
      <Status status={appointment.status}/></>;
    return preview ? <div className="visit-row" key={appointment.id}>{details}</div> :
      <Link className="visit-row" href={'/clinic/appointment/'+appointment.id} key={appointment.id}>{details}</Link>;
  });
}
function Status({ status }) { return <span className={'badge '+status}>{statuses[status]}</span>; }
