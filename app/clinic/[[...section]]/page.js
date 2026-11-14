import { NurseCalendar } from '../../../lib/nurse-calendar.js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { requireRole } from '../../../lib/session.js';
import { clinicDate, reasons, statuses, urgencyLabels } from '../../../lib/clinic.js';
import { AppointmentList } from '../../../lib/appointment-list.js';
import { StudentDashboard, VisitDate } from '../../../lib/student-dashboard.js';
import { clinicAction } from '../../actions.js';
import { ActionForm, BookingForm, PrintButton } from '../../forms.js';
import { SlotBooking } from '../../slot-booking.js';
import { Badge, Empty, Heading, Rows } from '../../../lib/clinic-ui.js';
import { NurseDeskView } from '../../../lib/nurse-desk.js';
import { AdminDeskView } from '../../../lib/admin-desk.js';
import { AccountView } from '../../../lib/account.js';
import { AnnouncementsView } from '../../../lib/announcements-view.js';
import { accountLabel } from '../../../lib/staff-id.js';
import { manilaDate, timeLabel } from '../../../lib/manila.js';

const roleNames = { student: 'Student', nurse: 'Nurse', physician: 'Physician', admin: 'Administrator' };
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
    if (role === 'admin') content = await AdminDesk({ db, user });
  } else if (section.length === 1 && screen === 'admin' && role === 'admin') {
    content = await AdminDesk({ db, user });
  } else if (section.length === 1 && screen === 'account' && role !== 'student') {
    const named = user.user_metadata?.full_name || user.user_metadata?.name;
    content = <AccountView name={named || accountLabel(user.email)} account={accountLabel(user.email)} roleLabel={roleNames[role]} />;
  } else if (section.length === 1 && screen === 'appointments' && role === 'student') {
    content = await Appointments({ db });
  } else if (section.length === 1 && screen === 'book' && role === 'student') {
    content = await Book({ db, user, filters: await searchParams });
  } else if (section.length === 1 && screen === 'profile' && role === 'student') {
    content = await Profile({ db, user });
  } else if (section.length === 1 && screen === 'calendar' && role === 'nurse') {
    content = await NurseCalendar({ db, filters: await searchParams });
  } else if (section.length === 1 && screen === 'announcements' && role === 'nurse') {
    content = await Announcements({ db });
  } else if (section.length === 1 && screen === 'slots' && role === 'nurse') {
    content = await Slots({ db });
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

  // The sidebar and page frame come from app/clinic/layout.js, so only this content changes between pages.
  return <div key={section.join('/') || 'home'} className="menu-content">{content}</div>;
}

async function AdminDesk({ db, user }) {
  return <AdminDeskView staff={checked(await db.rpc('list_clinic_staff'))} selfEmail={user.email} />;
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

async function Book({ db, user, filters }) {
  const profile = checked(await db.from('profiles').select('user_id').eq('user_id', user.id).maybeSingle());
  if (!profile) return <><Heading title="Book an appointment">Complete your student details before requesting a visit.</Heading><section className="profile-prompt"><h2>Complete your student details first</h2><p>The clinic uses your student ID to match your visit to your record.</p>{await Profile({ db, user })}</section></>;
  if (filters?.mode === 'request') {
    return <><Heading title="Request an appointment">Tell us what brings you in and how soon you need a visit. The nurse will choose your date and time.</Heading>
      <BookingForm reasons={reasons} /><p><Link href="/clinic/book">Back to open times</Link></p></>;
  }
  const rows = checked(await db.from('slots').select('id, starts_at, ends_at, capacity, held_count')
    .gt('starts_at', new Date().toISOString()).is('retired_at', null).order('starts_at').limit(600));
  const slots = rows.filter((slot) => slot.capacity > slot.held_count).map((slot) => ({
    id: slot.id, start: Date.parse(slot.starts_at), end: Date.parse(slot.ends_at), left: slot.capacity - slot.held_count, capacity: slot.capacity
  }));
  return <><Heading title="Book an appointment">Slots are released by infirmary nurses. Choose an open time, tell us why you’re coming, and we will confirm your reference number.</Heading>
    <SlotBooking slots={slots} reasons={reasons} requestHref="/clinic/book?mode=request" /></>;
}

async function Slots({ db }) {
  const today = manilaDate(Date.now());
  const schedules = checked(await db.from('schedules')
    .select('id, clinic_date, opens_at, closes_at, slot_minutes, capacity, cancelled_at')
    .gte('clinic_date', today).order('clinic_date').limit(60));
  const booked = new Map();
  if (schedules.length) {
    for (const row of checked(await db.from('slots').select('schedule_id, capacity, held_count').in('schedule_id', schedules.map((item) => item.id)))) {
      const total = booked.get(row.schedule_id) ?? { places: 0, held: 0 };
      total.places += row.capacity;
      total.held += row.held_count;
      booked.set(row.schedule_id, total);
    }
  }
  const clock = (time) => { const [hour, minute] = time.split(':').map(Number); return timeLabel(hour * 60 + minute); };
  return <><Heading title="Open slots">Publish the times students can book. Students see them as soon as you open a day.</Heading>
    <ActionForm action={clinicAction.bind(null, 'schedule')} label="Open these times" className="paper form-stack">
      <h2>Open a clinic day</h2>
      <div className="field-grid">
        <label>Date<input type="date" name="date" min={today} required /></label>
        <label>Length of each visit (minutes)<input type="number" name="slot_length" min="5" max="240" defaultValue="30" required /></label>
        <label>Opens<input type="time" name="opening" defaultValue="08:00" required /></label>
        <label>Closes<input type="time" name="closing" defaultValue="12:00" required /></label>
        <label>Students per time<input type="number" name="slot_capacity" min="1" max="50" defaultValue="1" required />
          <small>How many students can book the same time.</small></label>
      </div>
    </ActionForm>
    <section><h2>Upcoming days</h2>
      {schedules.length ? <div className="paper list">{schedules.map((item) => {
        const total = booked.get(item.id) ?? { places: 0, held: 0 };
        return <div className="visit-row" key={item.id}>
          <VisitDate value={item.clinic_date + 'T00:00:00+08:00'} />
          <span className="visit-what"><strong>{clock(item.opens_at)} – {clock(item.closes_at)}</strong>
            <span className="visit-sub"><span>{item.slot_minutes}-minute visits</span><span>{total.held} of {total.places} places booked</span></span></span>
          {item.cancelled_at ? <span className="badge cancelled">Cancelled</span> : <details className="slot-cancel"><summary>Cancel day</summary>
            <ActionForm action={clinicAction.bind(null, 'cancel_schedule')} label="Cancel this day" className="form-stack">
              <input type="hidden" name="id" value={item.id} />
              <label>Reason shown to students<textarea name="explanation" required maxLength={1000} /></label>
              <small>Every booking on this day is cancelled and the students see this reason. You can only cancel a day that hasn’t opened yet.</small>
            </ActionForm></details>}
        </div>;
      })}</div> : <Empty>No days are open yet. Open a day above so students can book.</Empty>}
    </section></>;
}

async function Announcements({ db }) {
  const { data, error } = await db.from('announcements').select('id, title, body, created_at, expires_at')
    .order('created_at', { ascending: false }).limit(50);
  if (error) return <><Heading title="Announcements">Post notices students see on their home screen.</Heading>
    <Empty>Announcements aren’t available yet. Apply the latest database update, then reload this page.</Empty></>;
  return <AnnouncementsView notices={data} />;
}

async function Appointments({ db }) {
  const appointments = checked(await db.from('appointments').select('id, reference_number, reason, status, requested_start').order('created_at', { ascending: false }).limit(100));
  return <AppointmentList appointments={appointments} />;
}

async function NurseDesk({ db }) {
  const columns = 'id, reference_number, reason, status, urgency, requested_start';
  const today = manilaDate(Date.now());
  const [requests, visits, releases, openDays] = await Promise.all([
    db.from('appointments').select(columns).eq('status', 'pending').order('urgency').order('created_at'),
    db.from('appointments').select(columns).in('status', ['confirmed', 'checked_in']).order('requested_start'),
    db.from('certificates').select('appointment_id', { count: 'exact', head: true }).eq('status', 'authorized'),
    db.from('schedules').select('id', { count: 'exact', head: true }).gte('clinic_date', today).is('cancelled_at', null)
  ]);
  const pending = checked(requests);
  const upcoming = checked(visits);
  // Student names come from a call that needs the latest database update; the desk still works without it.
  const students = new Map();
  const ids = [...pending, ...upcoming].map((item) => item.id).slice(0, 200);
  if (ids.length) {
    const { data } = await db.rpc('clinic_desk_students', { appointment_keys: ids });
    for (const student of data ?? []) students.set(student.appointment_id, student);
  }
  return <NurseDeskView pending={pending} upcoming={upcoming} students={students}
    counts={{ releases: releases.count ?? 0, openDays: openDays.count ?? 0 }} />;
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
    {records.length ? <Rows>{records.map((item) => <Link className="visit-row" key={item.appointment_id} href={appointmentLink(item.appointment_id)}>
      <VisitDate value={item.visit_date} />
      <span className="visit-what"><strong>{item.full_name}</strong><span className="visit-sub"><span>{item.reference_number}</span></span></span>
      <Badge status="awaiting_authorization" />
    </Link>)}</Rows> : <Empty>Completed medical certificate visits will appear here.</Empty>}</>;
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
  // One round trip instead of four in a row: these lookups don't depend on each other. The record is
  // checked first, so a missing or hidden appointment is still a 404 and never a database error.
  const [itemResult, letterResult, certificateResult, extraResult] = await Promise.all([
    db.from('appointments').select('*').eq('id', id).maybeSingle(),
    db.from('appointment_attachments').select('appointment_id').eq('appointment_id', id).maybeSingle(),
    db.from('certificates').select('status, released_at').eq('appointment_id', id).maybeSingle(),
    role === 'nurse' ? db.rpc('clinic_request_student', { appointment_key: id }) : db.rpc('clinic_appointment_history', { appointment_key: id })
  ]);
  const item = checked(itemResult);
  if (!item) notFound();
  const letter = checked(letterResult);
  const certificate = checked(certificateResult);
  const extra = checked(extraResult);
  let student, clinical, history;
  if (role === 'nurse') {
    student = extra.at(0);
    if (['checked_in', 'completed'].includes(item.status)) clinical = checked(await db.rpc('read_clinic_visit', { appointment_key: id }));
  } else {
    history = extra;
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
      {item.requested_start ? <><p>The student booked <strong>{clinicDate(item.requested_start)}</strong>. Confirm this time, or deny the request with a reason.</p>
        <StatusForm id={id} status="confirmed" label="Confirm this time" /></>
        : await NurseCalendar({ db, filters, appointment: { id, urgency: urgencyLabels[item.urgency], reason: item.reason } })}<StatusForm id={id} status="denied" label="Deny appointment" denial />
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
    {certificates.length ? <Rows>{certificates.map((item) => <Link className="visit-row" key={item.appointment_id} href={appointmentLink(item.appointment_id)}>
      <VisitDate value={item.appointments.requested_start} />
      <span className="visit-what"><strong>{item.student_name}</strong><span className="visit-sub"><span>{item.appointments.reference_number}</span></span></span>
      <Badge status={item.status} />
    </Link>)}</Rows> : <Empty>Certificates will appear here after a physician authorizes them.</Empty>}</>;
}



async function StudentHome({ db, user }) {
  const [appointments, profile, certificates] = (await Promise.all([
    db.from('appointments').select('id, reference_number, reason, status, requested_start').order('created_at', {ascending:false}),
    db.from('profiles').select('full_name').eq('user_id',user.id).maybeSingle(),
    db.from('certificates').select('appointment_id').eq('status','released')
  ])).map(checked);
  const { data: announcements } = await db.from('announcements').select('id, title, body').order('created_at', { ascending: false }).limit(3);
  return <StudentDashboard appointments={appointments} name={profile?.full_name ?? 'Student'} released={certificates.length} announcements={announcements ?? []}/>;
}
