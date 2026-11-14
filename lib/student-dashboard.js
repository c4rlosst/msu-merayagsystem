import Link from 'next/link';
import { Icon } from '../app/icons.js';
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

export function StudentDashboard({ appointments, name = 'Student', released = 0, announcements = [], preview = false }) {
  const base = preview ? '/preview' : '/clinic';
  const url = (page) => preview ? base + '?page=' + page : base + '/' + page;
  const next = appointments.filter((visit) => visit.status === 'confirmed' &&
    Date.parse(visit.requested_start) > Date.now()).sort((a,b) => Date.parse(a.requested_start)-Date.parse(b.requested_start))[0];
  const count = (status) => appointments.filter((a) => a.status === status).length;
  const stats = [
    ['Open requests', count('pending'), 'Awaiting approval', 'history'],
    ['Confirmed visits', count('confirmed'), 'Approved by the nurse', 'check'],
    ['Completed visits', count('completed'), 'Consultation recorded', 'clipboard'],
    ['Certificates released', released, 'Ready to print', 'file']
  ];
  const quick = [['book', 'Book a visit', url('book')], ['card', 'Student details', url('profile')], ['award', 'Certificate status', url('appointments')]];
  return <div className="student-dashboard dash">
    <div className="dash-main">
      <h1>Welcome back, {name.split(' ')[0]}!</h1>
      <section className="dash-hero">
        <h2>Vital signs, consultation, or medical certification - one scheduled visit.</h2>
        <p>Book an open slot released by the infirmary nurses. Your reference number confirms the booking and your certificate moves through assessment and physician authorization.</p>
        <Link className="button plum" href={url('book')}><Icon name="book" /> Request appointment</Link>
      </section>
      <dl className="stat-grid">{stats.map(([label, total, hint, icon]) => <div key={label}>
        <dt>{label}</dt><dd>{total}</dd><small>{hint}</small><Icon name={icon} size={22} className="stat-icon" />
      </div>)}</dl>
      <section className="history">
        <div className="section-heading"><h2>My History</h2><Link href={url('appointments')}>View all</Link></div>
        {appointments.length
          ? <div className="paper list"><VisitList appointments={appointments.slice(0,3)} preview={preview} bookUrl={url('book')} showAction={false} /></div>
          : <VisitList appointments={[]} preview={preview} bookUrl={url('book')} showAction={false} />}
      </section>
    </div>
    <div className="dash-side">
      <section className="next-card" aria-labelledby="next-visit">
        <p className="kicker" id="next-visit">Next visit</p>
        {next ? <>
          <h3>{clinicDate(next.requested_start, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          <p className="next-time">{timeOf(next.requested_start)}</p>
          <p>{next.reason}</p>
          <p className="next-meta"><Status status={next.status} /><span>{next.reference_number}</span>
            {!preview && <Link href={'/clinic/appointment/' + next.id}>View details</Link>}</p>
        </> : <>
          <h3>No upcoming appointment</h3>
          <p>Choose an available date to get your vital signs checked, dental health checked, see the physician, or request a certificate.</p>
        </>}
      </section>
      <section className="quick">
        <h2>Quick Actions</h2>
        <div className="quick-grid">{quick.map(([icon, label, href]) =>
          <Link key={label} href={href}><Icon name={icon} size={30} />{label}</Link>)}</div>
      </section>
      <section className="announce">
        <h2>Announcements</h2>
        {announcements.length ? announcements.map((notice) => <article className="notice" key={notice.id}>
          <Icon name="megaphone" size={28} />
          <div><strong>{notice.title}</strong><p>{notice.body}</p></div>
        </article>) : <p className="announce-empty">No announcements right now.</p>}
      </section>
    </div>
  </div>;
}

// `showAction` is off where the page already offers a "Request a visit" button right above.
export function VisitList({ appointments, preview = false, bookUrl = '/clinic/book', showAction = true }) {
  if (!appointments.length) return <div className="appointment-empty"><h3>No appointment yet.</h3><p>Book now to see your visits here.</p>{showAction && <Link className="button" href={bookUrl}>Request a visit</Link>}</div>;
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
