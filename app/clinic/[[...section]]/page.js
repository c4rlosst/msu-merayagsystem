import { NurseCalendar } from '../../../lib/nurse-calendar.js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { requireRole } from '../../../lib/session.js';
import { clinicDate, reasons, statuses, urgencyLabels } from '../../../lib/clinic.js';
import { AppointmentList } from '../../../lib/appointment-list.js';
import { StudentDashboard } from '../../../lib/student-dashboard.js';
import { clinicAction, createNurseAccount, manageStaffAccess, signOut } from '../../actions.js';
import { ActionForm, BookingForm, PrintButton } from '../../forms.js';

const roleNames = { student: 'Student', nurse: 'Nurse', physician: 'Physician', admin: 'Administrator' };
const links = {
  student: [['/clinic', 'Home'], ['/clinic/book', 'Book'], ['/clinic/appointments', 'My appointments'], ['/clinic/profile', 'My profile']],
  nurse: [['/clinic', 'Clinic desk'], ['/clinic/calendar', 'Calendar'], ['/clinic/audit', 'Audit log']],
  physician: [['/clinic', 'Certificates']],
  admin: [['/clinic/admin', 'Staff access'], ['/clinic/audit', 'Audit log']]
};

function Heading({ title, children }) {
  return <header className="page-heading"><h1>{title}</h1>{children && <p>{children}</p>}</header>;
}
function Badge({ status }) {
  return <span className={'badge ' + status}>{statuses[status] ?? status}</span>;
}
function Empty({ children }) {
  return <p className="paper empty">{children}</p>;
}
function checked(result) {
  if (result.error) throw new Error('The clinic database could not load this view.');
  return result.data;
}
const appointmentLink = (id) => '/clinic/appointment/' + id;

export default async function Clinic({ params, searchParams }) {
  const { db, user, role } = await requireRole();
  const { section = [] } = await params;
  const [screen, id] = section;
  const validId = z.uuid().safeParse(id).success;
  let content;
  if (!screen) {
    if (role === 'student') content = await StudentHome({ db, user });
    if (role === 'nurse') content = await NurseDesk({ db });
    if (role === 'physician') content = await PhysicianQueue({ db });
    if (role === 'admin') content = await AdminDesk({ db });
  } else if (section.length === 1 && screen === 'admin' && role === 'admin') {
    content = await AdminDesk({ db });
  } else if (section.length === 1 && screen === 'appointments' && role === 'student') {
    content = await Appointments({ db });
  } else if (section.length === 1 && screen === 'book' && role === 'student') {
    content = await Book({ db, user });
  } else if (section.length === 1 && screen === 'profile' && role === 'student') {
    content = await Profile({ db, user });
  } else if (section.length === 1 && screen === 'calendar' && role === 'nurse') {
    content = await NurseCalendar({ db, filters: await searchParams });
  } else if (section.length === 1 && screen === 'releases' && role === 'nurse') {
    content = await ReleaseQueue({ db });
  } else if (section.length === 1 && screen === 'audit' && ['nurse', 'admin'].includes(role)) {
    content = await Audit({ db, filters: await searchParams });
  } else if (section.length === 2 && screen === 'appointment' && validId && ['student', 'nurse', 'physician'].includes(role)) {
    content = await Appointment({ db, role, id, filters: await searchParams });
  } else if (section.length === 2 && screen === 'certificate' && validId && role === 'student') {
    content = await Certificate({ db, id });
  }
  if (!content) notFound();

  return <div className="clinic-shell">
    <a href="#clinic-content" className="skip-link">Skip to content</a>
    <aside className="sidebar no-print">
      <Link href="/clinic" className="brand"><span aria-hidden="true">✚</span> MERAYAG</Link>
      <p className="role-label">{roleNames[role]} portal</p>
      <nav aria-label="Clinic">{links[role].map(([href, label]) =>
        <Link key={href} href={href} aria-current={href === (screen ? '/clinic/' + screen : role === 'admin' ? '/clinic/admin' : '/clinic') ? 'page' : undefined}>{label}</Link>
      )}</nav>
      <form action={signOut}><button className="quiet">Sign out</button></form>
    </aside>
    <main id="clinic-content" className="workspace">
      <div className="account no-print">{user.email}</div>
      <div key={section.join('/') || 'home'} className="menu-content">{content}</div>
    </main>
  </div>;
}

async function AdminDesk({ db }) {
  const staff = checked(await db.rpc('list_clinic_staff'));
  return <>
    <Heading title="Staff access">Manage who can work in the nurse and physician portals.</Heading>
    <ActionForm action={createNurseAccount} label="Add nurse" className="paper form-stack">
      <h2>Create a nurse account</h2>
      <div className="field-grid">
        <label>Nurse ID<input name="nurse_id" placeholder="N-01" maxLength={10} required /></label>
        <label>Password<input type="password" name="password" autoComplete="new-password" minLength={6} maxLength={72} required />
          <small>Use at least 6 characters.</small>
        </label>
      </div>
    </ActionForm>
    <ActionForm action={manageStaffAccess} label="Grant staff access" className="paper form-stack">
      <h2>Assign a role</h2>
      <p>Use the email of an existing, verified clinic account.</p>
      <input type="hidden" name="access" value="grant" />
      <div className="field-grid">
        <label>Staff email<input type="email" name="email" required maxLength={254} /></label>
        <label>Role<select name="role"><option value="nurse">Nurse</option><option value="physician">Physician</option></select></label>
      </div>
    </ActionForm>
    <section className="paper">
      <div className="section-heading"><h2>Staff directory</h2><Link href="/clinic/audit">View audit log</Link></div>
      <div className="table-scroll"><table>
        <thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Access</th><th scope="col">Action</th></tr></thead>
        <tbody>{staff.map((member) => <tr key={member.email}>
          <td>{member.email?.endsWith('@nurses.merayag.invalid') ? member.email.split('@')[0].toUpperCase().replace(/^N-?/, 'N-') : member.email}</td><td>{roleNames[member.role]}</td>
          <td><span className={member.active ? 'badge confirmed' : 'badge cancelled'}>{member.active ? 'Active' : 'Revoked'}</span></td>
          <td>{member.role !== 'admin' && <ActionForm action={manageStaffAccess} label={member.active ? 'Revoke access' : 'Restore access'}>
            <input type="hidden" name="email" value={member.email} />
            <input type="hidden" name="role" value={member.role} />
            <input type="hidden" name="access" value={member.active ? 'revoke' : 'grant'} />
          </ActionForm>}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </>;
}

async function Profile({ db, user }) {
  const profile = checked(await db.from('profiles').select('*').eq('user_id', user.id).maybeSingle());
  return <><Heading title="Student details">Enter the details the clinic uses for your visits and medical certificates.</Heading>
    <ActionForm action={clinicAction.bind(null, 'profile')} label="Save profile" className="paper form-stack">
      <h2>Personal information</h2>
      <div className="field-grid">
        <label>Student ID<input name="student_id" defaultValue={profile?.student_id} maxLength={50} required /></label>
        <label>Full name<input name="full_name" autoComplete="name" defaultValue={profile?.full_name} maxLength={200} required /></label>
        <label>Course<input name="course" defaultValue={profile?.course} maxLength={120} required /></label>
        <label>Year level<input name="year_level" type="number" min="1" max="20" defaultValue={profile?.year_level} required /></label>
        <label>Contact number<input name="contact_number" type="tel" autoComplete="tel" defaultValue={profile?.contact_number} required /></label>
        <label>Verified school email<input value={user.email} readOnly /></label>
      </div>
    </ActionForm></>;
}

async function Book({ db, user }) {
  const profile = checked(await db.from('profiles').select('user_id').eq('user_id', user.id).maybeSingle());
  if (!profile) return <><Heading title="Book an appointment">Complete your student details before requesting a visit.</Heading><section className="profile-prompt"><h2>Complete your student details first</h2><p>The clinic uses your student ID to match your visit to your record.</p>{await Profile({ db, user })}</section></>;
  return <><Heading title="Request an appointment">Tell us what brings you in and how soon you need a visit. The nurse will choose your date and time.</Heading>
    <BookingForm reasons={reasons} /></>;
}

async function Appointments({ db }) {
  const appointments = checked(await db.from('appointments').select('id, reference_number, reason, status, requested_start').order('created_at', { ascending: false }).limit(100));
  return <AppointmentList appointments={appointments} />;
}

function AppointmentRow({ appointment }) {
  return <Link className="visit-row" href={appointmentLink(appointment.id)}>
    <time dateTime={appointment.requested_start}>{appointment.requested_start ? clinicDate(appointment.requested_start) : urgencyLabels[appointment.urgency]}</time>
    <span><strong>{appointment.reason}</strong><small>{appointment.reference_number}</small></span>
    <Badge status={appointment.status} />
  </Link>;
}

async function NurseDesk({ db }) {
  const columns = 'id, reference_number, reason, status, urgency, requested_start';
  const [requests, visits] = (await Promise.all([
    db.from('appointments').select(columns).eq('status', 'pending').order('urgency').order('created_at'),
    db.from('appointments').select(columns).in('status', ['confirmed', 'checked_in']).order('requested_start')
  ])).map(checked);
  const today = clinicDate(Date.now(), { dateStyle: 'short' });
  const todaysVisits = visits.filter((visit) => clinicDate(visit.requested_start, { dateStyle: 'short' }) === today);
  const earlierVisits = visits.filter((visit) => Date.parse(visit.requested_start) < Date.now() && !todaysVisits.includes(visit));
  return <><Heading title="Clinic desk">Review pending requests and schedule visits on the clinic calendar.</Heading>
    <nav className="section-nav" aria-label="Clinic desk"><Link href="/clinic/calendar">Appointment calendar</Link><Link href="/clinic/releases">Certificate releases</Link></nav>
    <section><h2>Pending requests</h2>{requests.length ? requests.map((a) => <AppointmentRow key={a.id} appointment={a} />) : <Empty>New student requests will appear here.</Empty>}</section>
    <section><h2>Today’s visits</h2>{todaysVisits.length ? todaysVisits.map((a) => <AppointmentRow key={a.id} appointment={a} />) : <Empty>No confirmed or checked-in visits today.</Empty>}</section>
    {earlierVisits.length > 0 && <section><h2>Earlier visits to close</h2>{earlierVisits.map((a) => <AppointmentRow key={a.id} appointment={a} />)}</section>}
  </>;
}

function StatusForm({ id, status, label, denial = false }) {
  return <ActionForm action={clinicAction.bind(null, 'status')} label={label} className="form-stack">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} />
    {denial && <label>Reason shown to the student<textarea name="explanation" required maxLength={1000} /></label>}
  </ActionForm>;
}

const measurements = [
  ['temperature_c', 'Temperature (°C)', '.1'], ['systolic', 'Systolic (mmHg)', '1'],
  ['diastolic', 'Diastolic (mmHg)', '1'], ['pulse', 'Pulse (bpm)', '1'],
  ['respiratory_rate', 'Respiratory rate', '1'], ['spo2', 'SpO₂ (%)', '1'],
  ['height_cm', 'Height (cm)', '.01'], ['weight_kg', 'Weight (kg)', '.01']
];

function VisitForm({ id, clinical }) {
  return <section className="paper"><h2>Vitals and consultation</h2>
    <ActionForm action={clinicAction.bind(null, 'visit')} label="Save visit record" className="form-stack">
      <input type="hidden" name="id" value={id} />
      <h2>Personal information</h2>
      <div className="field-grid">{measurements.map(([field, label, step]) =>
        <label key={field}>{label}<input type="number" name={field} step={step} defaultValue={clinical?.[field] ?? ''} /></label>)}</div>
      {['findings', 'assessment', 'notes'].map((field) => <label key={field} className="capitalize">{field}
        <textarea name={field} defaultValue={clinical?.[field] ?? ''} maxLength={8000} />
      </label>)}
    </ActionForm>
  </section>;
}

function ClinicalSummary({ record }) {
  return <section className="paper"><h2>Visit record</h2>{record ? <dl className="facts">
    {[...measurements, ['findings', 'Findings'], ['assessment', 'Assessment'], ['notes', 'Notes']]
      .filter(([key]) => record[key] != null).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{record[key]}</dd></div>)}
  </dl> : <p>No clinical record was entered for this visit.</p>}</section>;
}

async function PhysicianQueue({ db }) {
  const records = checked(await db.rpc('list_clinic_certificate_queue'));
  return <><Heading title="Certificates awaiting authorization">Review completed medical certificate visits before authorizing release.</Heading>
    {records.length ? records.map((item) => <Link className="visit-row" key={item.appointment_id} href={appointmentLink(item.appointment_id)}>
      <time>{item.visit_date}</time><span><strong>{item.full_name}</strong><small>{item.reference_number}</small></span>
      <Badge status="awaiting_authorization" />
    </Link>) : <Empty>Completed medical certificate visits will appear here.</Empty>}</>;
}

async function Appointment({ db, role, id, filters }) {
  if (role === 'physician') {
    const item = checked(await db.rpc('list_clinic_certificate_queue')).find((entry) => entry.appointment_id === id);
    if (!item) notFound();
    const clinical = checked(await db.rpc('read_clinic_visit', { appointment_key: id }));
    return <><Heading title={item.full_name}>{item.reference_number} · {item.visit_date}</Heading><ClinicalSummary record={clinical} />
      <ActionForm action={clinicAction.bind(null, 'authorize')} label="Authorize certificate" className="paper form-stack">
        <input type="hidden" name="id" value={id} />
        <label>Statement for the printed certificate<textarea name="text" maxLength={8000} rows={5} required /></label>
      </ActionForm></>;
  }
  const item = checked(await db.from('appointments').select('*').eq('id', id).maybeSingle());
  if (!item) notFound();
  const [letter, certificate] = (await Promise.all([
    db.from('appointment_attachments').select('appointment_id').eq('appointment_id', id).maybeSingle(),
    db.from('certificates').select('status, released_at').eq('appointment_id', id).maybeSingle()
  ])).map(checked);
  let student, clinical, history;
  if (role === 'nurse') {
    student = checked(await db.rpc('clinic_request_student', { appointment_key: id })).at(0);
    if (['checked_in', 'completed'].includes(item.status)) clinical = checked(await db.rpc('read_clinic_visit', { appointment_key: id }));
  } else {
    history = checked(await db.rpc('clinic_appointment_history', { appointment_key: id }));
  }
  return <><Heading title={item.reason}>{item.reference_number}</Heading>
    <section className="paper"><Badge status={item.status} />
      <dl className="facts"><div><dt>Visit time</dt><dd>{item.requested_start ? clinicDate(item.requested_start) : 'Awaiting nurse scheduling'}</dd></div>
        {student && <div><dt>Student</dt><dd>{student.full_name} · {student.student_number}</dd></div>}
        <div><dt>Urgency</dt><dd>{urgencyLabels[item.urgency]}</dd></div><div><dt>Concern</dt><dd>{item.concern}</dd></div>
        {item.decision_reason && <div><dt>Clinic response</dt><dd>{item.decision_reason}</dd></div>}
      </dl>
      {letter && <a href={'/letters/' + id} target="_blank" rel="noreferrer">Open referral or excuse letter</a>}
    </section>
    {history && <section className="paper"><h2>Status history</h2><ol className="history">{history.map((event, index) =>
      <li key={index}><Badge status={event.status} /><time>{clinicDate(event.occurred_at)}</time></li>)}</ol></section>}
    {role === 'student' && ['pending', 'confirmed'].includes(item.status) && <StatusForm id={id} status="cancelled" label="Cancel appointment" />}
    {role === 'student' && certificate?.status === 'released' && <Link className="button" href={'/clinic/certificate/' + id}>View medical certificate</Link>}
    {role === 'nurse' && item.status === 'pending' && <section className="paper form-stack"><h2>Review request</h2>
      {await NurseCalendar({ db, filters, appointmentId: id })}<StatusForm id={id} status="denied" label="Deny appointment" denial />
    </section>}
    {role === 'nurse' && item.status === 'confirmed' && <section className="paper form-stack"><h2>Visit arrival</h2>
      <StatusForm id={id} status="checked_in" label="Check in student" />
      {new Date(item.requested_end) <= new Date() && <StatusForm id={id} status="no_show" label="Record no-show" />}
    </section>}
    {role === 'nurse' && item.status === 'checked_in' && <><VisitForm id={id} clinical={clinical} /><StatusForm id={id} status="completed" label="Complete visit" /></>}
    {role === 'nurse' && item.status === 'completed' && <ClinicalSummary record={clinical} />}
    {role === 'nurse' && certificate && <section className="paper form-stack"><h2>Medical certificate</h2><Badge status={certificate.status} />
      {certificate.status === 'authorized' && <ActionForm action={clinicAction.bind(null, 'release')} label="Record release" className="form-stack">
        <input type="hidden" name="id" value={id} /><label>Released to<input name="text" maxLength={200} required /></label>
      </ActionForm>}
    </section>}
  </>;
}

async function Certificate({ db, id }) {
  const [certificate, appointment] = (await Promise.all([
    db.from('certificates').select('student_name, statement, authorized_at, released_at').eq('appointment_id', id).eq('status', 'released').maybeSingle(),
    db.from('appointments').select('reference_number, requested_start').eq('id', id).maybeSingle()
  ])).map(checked);
  if (!certificate || !appointment) notFound();
  return <><div className="no-print"><Heading title="Medical certificate">You can print this certificate or save it as a PDF.</Heading></div>
    <article className="certificate paper">
      <header><p>MERAYAG · University Clinic</p><h1>Medical Certificate</h1></header>
      <dl className="facts"><div><dt>Student</dt><dd>{certificate.student_name}</dd></div>
        <div><dt>Clinic reference</dt><dd>{appointment.reference_number}</dd></div>
        <div><dt>Visit date</dt><dd>{clinicDate(appointment.requested_start, { dateStyle: 'long' })}</dd></div></dl>
      <p className="certificate-statement">{certificate.statement}</p>
      <p>Authorized {clinicDate(certificate.authorized_at)}<br />Released {clinicDate(certificate.released_at)}</p>
    </article><PrintButton /></>;
}

async function Audit({ db, filters }) {
  const filter = z.object({ date: z.iso.date().optional(), actor: z.uuid().optional(),
    action: z.string().regex(/^[a-z_]{1,70}$/).optional(), reference: z.string().max(80).optional() });
  const parsed = filter.safeParse(Object.fromEntries(Object.entries(filters).filter(([, value]) => value)));
  let rows = [];
  if (parsed.success) {
    const { date, actor, action, reference } = parsed.data;
    let query = db.from('audit_log').select('id, occurred_at, actor_id, actor_role, action, reference_number').order('occurred_at', { ascending: false }).limit(100);
    if (date) {
      const from = new Date(date + 'T00:00:00+08:00');
      query = query.gte('occurred_at', from.toISOString()).lt('occurred_at', new Date(+from + 86400000).toISOString());
    }
    if (actor) query = query.eq('actor_id', actor);
    if (action) query = query.eq('action', action);
    if (reference) query = query.eq('reference_number', reference);
    rows = checked(await query);
  }
  return <><Heading title="Audit log">Review the 100 most recent matching clinic events.</Heading>
    <form className="paper field-grid" action="/clinic/audit">
      <label>Date (Manila)<input type="date" name="date" defaultValue={filters.date} /></label>
      <label>Actor ID<input name="actor" defaultValue={filters.actor} /></label>
      <label>Action<input name="action" defaultValue={filters.action} placeholder="appointment_confirmed" /></label>
      <label>Reference number<input name="reference" defaultValue={filters.reference} /></label>
      <button>Filter audit log</button>
    </form>
    {!parsed.success ? <Empty>Check the date, actor UUID, and action format.</Empty> : rows.length ? <div className="table-scroll"><table>
      <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Reference</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td>{clinicDate(row.occurred_at)}</td><td>{row.actor_role}<small>{row.actor_id}</small></td><td>{row.action}</td><td>{row.reference_number ?? '—'}</td></tr>)}</tbody>
    </table></div> : <Empty>No matching audit events.</Empty>}
  </>;
}


async function ReleaseQueue({ db }) {
  const certificates = checked(await db.from('certificates')
    .select('appointment_id, status, student_name, appointments(reference_number, requested_start)')
    .in('status', ['authorized', 'released']).order('authorized_at', { ascending: false }).limit(100));
  return <><Heading title="Certificate releases">Open an authorized certificate to record who received it.</Heading>
    {certificates.length ? certificates.map((item) => <Link className="visit-row" key={item.appointment_id} href={appointmentLink(item.appointment_id)}>
      <time>{clinicDate(item.appointments.requested_start)}</time>
      <span><strong>{item.student_name}</strong><small>{item.appointments.reference_number}</small></span>
      <Badge status={item.status} />
    </Link>) : <Empty>Certificates will appear here after a physician authorizes them.</Empty>}</>;
}



async function StudentHome({ db, user }) {
  const [appointments, profile, certificates] = (await Promise.all([
    db.from('appointments').select('id, reference_number, reason, status, requested_start').order('created_at', {ascending:false}),
    db.from('profiles').select('full_name').eq('user_id',user.id).maybeSingle(),
    db.from('certificates').select('appointment_id').eq('status','released')
  ])).map(checked);
  return <StudentDashboard appointments={appointments} name={profile?.full_name ?? 'Student'} released={certificates.length}/>;
}
