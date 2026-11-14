import Link from 'next/link';
import { clinicDate, urgencyLabels } from './clinic.js';
import { ActionGrid, Badge, Heading, Panel, RowEnd, StatTiles, statusTone, timeOf, urgencyShort } from './clinic-ui.js';
import { VisitDate } from './student-dashboard.js';

const appointmentLink = (id) => '/clinic/appointment/' + id;

// One request or visit. With the student's details it leads with who they are; without them
// (for example before the latest database update) it falls back to the reason for the visit.
export function AppointmentRow({ appointment, student, plain = false }) {
  const time = appointment.requested_start ? timeOf(appointment.requested_start) : urgencyLabels[appointment.urgency];
  const row = <>
    <VisitDate value={appointment.requested_start} fallback={urgencyShort[appointment.urgency]} tone={statusTone[appointment.status]} />
    <span className="visit-what"><strong>{student?.full_name ?? appointment.reason}</strong>
      <span className="visit-sub">
        {student && <span>{appointment.reason}</span>}
        <span>{time}</span>
        {student && <span>{student.course}, year {student.year_level}</span>}
        <span>{appointment.reference_number}</span>
      </span></span>
    <RowEnd link={!plain}><Badge status={appointment.status} /></RowEnd></>;
  return plain ? <div className="visit-row">{row}</div> : <Link className="visit-row" href={appointmentLink(appointment.id)}>{row}</Link>;
}

/**
 * The nurse's home screen. `students` maps an appointment id to the student's details,
 * `counts` has the certificates waiting for release and the upcoming open clinic days.
 */
export function NurseDeskView({ pending, upcoming, students, counts, plain = false }) {
  const today = clinicDate(Date.now(), { dateStyle: 'short' });
  const todays = upcoming.filter((visit) => clinicDate(visit.requested_start, { dateStyle: 'short' }) === today);
  const earlier = upcoming.filter((visit) => Date.parse(visit.requested_start) < Date.now() && !todays.includes(visit));
  const next = upcoming.find((visit) => Date.parse(visit.requested_start) >= Date.now());
  const nextStudent = next && students.get(next.id);
  const urgent = pending.filter((request) => request.urgency === 'urgent').length;
  const tiles = [
    ['Pending requests', pending.length, 'history', { tone: 'gold' }], ['Urgent', urgent, 'alert', { alert: true, tone: 'red' }],
    ['Visits today', todays.length, 'calendar'], ['Certificates to release', counts.releases, 'certificate', { tone: 'green' }],
    ['Open days ahead', counts.openDays, 'slots', { tone: 'blue' }]
  ];
  const actions = [['slots', 'Open slots', '/clinic/slots'], ['calendar', 'Calendar', '/clinic/calendar'],
    ['megaphone', 'Announcements', '/clinic/announcements'], ['certificate', 'Certificate releases', '/clinic/releases']];
  const row = (appointment) => <AppointmentRow key={appointment.id} appointment={appointment} student={students.get(appointment.id)} plain={plain} />;
  return <>
    <Heading title="Clinic desk">Review pending requests and keep an eye on today’s visits.</Heading>
    <StatTiles items={tiles} />
    <div className="split">
      <section className="next-card" aria-label="Next visit">
        <p className="kicker">Next visit</p>
        {next ? <>
          <h2>{nextStudent?.full_name ?? next.reason}</h2>
          <p className="next-when">{clinicDate(next.requested_start, { weekday: 'long', month: 'long', day: 'numeric' })} · {timeOf(next.requested_start)}</p>
          {nextStudent && <p>{next.reason}</p>}
          {!plain && <Link className="button gold" href={appointmentLink(next.id)}>Open visit</Link>}
        </> : <><h2>Nothing scheduled</h2><p>Confirmed visits appear here with the student’s name and time.</p></>}
      </section>
      <Panel title="Go to"><ActionGrid items={actions} columns={4} /></Panel>
    </div>
    <div className="split">
      <Panel title="Pending requests" count={pending.length}>
        {pending.length ? <div className="rows">{pending.map(row)}</div> : <p className="panel-empty">New student requests will appear here.</p>}
      </Panel>
      <Panel title="Today’s visits" count={todays.length}>
        {todays.length ? <div className="rows">{todays.map(row)}</div> : <p className="panel-empty">No confirmed or checked-in visits today.</p>}
      </Panel>
    </div>
    {earlier.length > 0 && <Panel title="Earlier visits to close" count={earlier.length}><div className="rows">{earlier.map(row)}</div></Panel>}
  </>;
}
