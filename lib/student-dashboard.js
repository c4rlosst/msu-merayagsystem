import Link from 'next/link';
import { clinicDate, statuses } from './clinic.js';

export function StudentDashboard({ appointments, name = 'Student', released = 0, preview = false }) {
  const base = preview ? '/preview' : '/clinic';
  const url = (page) => preview ? base + '?page=' + page : base + '/' + page;
  const next = appointments.filter((visit) => ['confirmed', 'pending'].includes(visit.status) &&
    Date.parse(visit.requested_start) > Date.now()).sort((a,b) => Date.parse(a.requested_start)-Date.parse(b.requested_start))[0];
  const metrics = [
    ['Open requests', appointments.filter((a) => a.status === 'pending').length, 'Awaiting nurse approval'],
    ['Confirmed visits', appointments.filter((a) => a.status === 'confirmed').length, 'Approved by the nurse'],
    ['Completed visits', appointments.filter((a) => a.status === 'completed').length, 'Visit completed'],
    ['Certificates released', released, 'Ready to print']
  ];
  return <div className="student-dashboard">
    <header className="page-heading"><h1>Welcome, {name}!</h1><p>{clinicDate(Date.now(), {dateStyle:'full'})}</p></header>
    <div className="home-columns">
      <section className="paper clinic-intro">
        <p className="infirmary-label">University Infirmary</p>
        <h2>Vital signs, consultation, or medical certification — one scheduled visit.</h2>
        <p>Choose a time published by the infirmary. Track your request, nurse confirmation, and certificate release in one place.</p>
        <div className="button-row"><Link className="button plum" href={url('book')}>Request appointment</Link><Link className="button secondary" href={url('appointments')}>My appointments</Link></div>
      </section>
      <section className="paper next-visit"><h2>Next visit</h2>
        {next ? <><h3>{next.reason}</h3><p>{clinicDate(next.requested_start)}</p><Status status={next.status}/></> :
          <><h3>No upcoming appointment</h3><p>Choose an available time for your next clinic visit.</p></>}
        <Link href={url('book')}>Book a slot</Link>
      </section>
    </div>
    <div className="metric-grid">{metrics.map(([label,count,description]) => <section className="paper metric" key={label}><h2>{label}</h2><strong>{count}</strong><small>{description}</small></section>)}</div>
    <div className="home-columns">
      <section className="paper"><div className="section-heading"><h2>My history</h2><Link href={url('appointments')}>View all</Link></div>
        <VisitList appointments={appointments.slice(0,3)} preview={preview} bookUrl={url('book')}/>
      </section>
      <section className="paper quick-actions"><h2>Quick actions</h2>
        <Link href={url('book')}><strong>Book a visit</strong><small>Choose a published clinic time</small></Link>
        <Link href={url('profile')}><strong>Student details</strong><small>ID, course, and contact details</small></Link>
        <Link href={url('appointments')}><strong>Certificate status</strong><small>Track your request and release</small></Link>
      </section>
    </div>
  </div>;
}

export function VisitList({ appointments, preview = false, bookUrl = '/clinic/book' }) {
  if (!appointments.length) return <div className="appointment-empty"><h3>No appointments here yet</h3><p>Request a visit for a health check, consultation, or medical certificate.</p><Link className="button" href={bookUrl}>Request an appointment</Link></div>;
  return appointments.map((appointment) => {
    const details = <><time dateTime={appointment.requested_start}>{clinicDate(appointment.requested_start)}</time>
      <span><strong>{appointment.reason}</strong><small>{appointment.reference_number}</small></span><Status status={appointment.status}/></>;
    return preview ? <div className="visit-row" key={appointment.id}>{details}</div> :
      <Link className="visit-row" href={'/clinic/appointment/'+appointment.id} key={appointment.id}>{details}</Link>;
  });
}
function Status({ status }) { return <span className={'badge '+status}>{statuses[status]}</span>; }
