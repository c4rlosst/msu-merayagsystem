import Link from 'next/link';
import { Icon } from '../app/icons.js';
import { clinicDate, statuses } from './clinic.js';
import { ActionGrid, Panel, StatTiles, timeOf } from './clinic-ui.js';

// The date block at the start of a visit row: a big day number over the month, or a gold "open"
// block when the nurse hasn't picked a time yet.
export function VisitDate({ value, fallback = 'Open' }) {
  if (!value) return <span className="visit-date is-open"><b>–</b><small>{fallback}</small></span>;
  return <time className="visit-date" dateTime={value}>
    <b>{clinicDate(value, { day: 'numeric' })}</b><small>{clinicDate(value, { month: 'short' })}</small>
  </time>;
}

export function StudentDashboard({ appointments, name = 'Student', released = 0, announcements = [], preview = false }) {
  const url = (page) => preview ? '/preview?page=' + page : '/clinic/' + page;
  const next = appointments.filter((visit) => visit.status === 'confirmed' &&
    Date.parse(visit.requested_start) > Date.now()).sort((a,b) => Date.parse(a.requested_start)-Date.parse(b.requested_start))[0];
  const count = (status) => appointments.filter((a) => a.status === status).length;
  const stats = [
    ['Open requests', count('pending'), 'history'],
    ['Confirmed visits', count('confirmed'), 'check'],
    ['Completed visits', count('completed'), 'clipboard'],
    ['Certificates', released, 'file']
  ];
  const quick = [['book', 'Book a visit', url('book')], ['card', 'My details', url('profile')], ['award', 'Certificates', url('appointments')]];
  return <div className="student-dashboard">
    <section className="hero" aria-labelledby="welcome">
      <div className="hero-copy">
        <h1 id="welcome">Welcome back, {name.split(' ')[0]}</h1>
        <p>Pick an open slot from the infirmary nurses for vital signs, a consultation or a medical certificate. Your reference number follows the visit all the way to the certificate.</p>
        <Link className="button gold" href={url('book')}><Icon name="book" /> Book a visit</Link>
      </div>
      <div className="hero-next" aria-labelledby="next-visit">
        <p className="kicker" id="next-visit">Next visit</p>
        {next ? <>
          <p className="hero-when">{clinicDate(next.requested_start, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <p className="hero-time">{timeOf(next.requested_start)}</p>
          <p className="hero-reason">{next.reason}</p>
          <p className="hero-meta"><span>{next.reference_number}</span>
            {!preview && <Link href={'/clinic/appointment/' + next.id}>View details</Link>}</p>
        </> : <>
          <p className="hero-when">Nothing booked yet</p>
          <p className="hero-reason">Your confirmed visit will show up here with its date and time.</p>
        </>}
      </div>
    </section>
    <StatTiles items={stats} />
    <div className="desk">
      <div className="desk-rail">
        <Panel title="Quick actions"><ActionGrid items={quick} columns={3} /></Panel>
        <Panel title="Announcements">
          {announcements.length ? <div className="notices">{announcements.map((notice) => <article className="notice" key={notice.id}>
            <span className="tile-icon"><Icon name="megaphone" size={18} /></span>
            <div><strong>{notice.title}</strong><p>{notice.body}</p></div>
          </article>)}</div> : <p className="panel-empty">Nothing new from the clinic.</p>}
        </Panel>
      </div>
      <Panel title="My history" action={<Link href={url('appointments')}>View all</Link>} className="desk-main">
        <div className="rows"><VisitList appointments={appointments.slice(0,4)} preview={preview} bookUrl={url('book')} /></div>
      </Panel>
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
