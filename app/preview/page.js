import { PreviewBooking } from './booking.js';
import { notFound } from 'next/navigation';
import { ClinicShell } from '../clinic/clinic-shell.js';
import { StudentDashboard } from '../../lib/student-dashboard.js';
import { NurseDeskView } from '../../lib/nurse-desk.js';
import { AdminDeskView } from '../../lib/admin-desk.js';
import { AppointmentList } from '../../lib/appointment-list.js';
import { ScheduleCalendar } from '../schedule-calendar.js';
import { addDays, addMonths, isDateKey, manilaDate, monthStart, toMs, weekday } from '../../lib/manila.js';

// Sample visits around today (Manila time) so the nurse calendar can be tried without signing in.
function sampleVisits(today) {
  const visit = (offset, from, to, reason, number) => ({
    id: 'sample-' + number, reference: 'MRY-' + (1000 + number), reason, status: 'confirmed',
    start: toMs(addDays(today, offset), from), end: toMs(addDays(today, offset), to)
  });
  return [visit(0, 540, 570, 'Vital signs check', 1), visit(0, 600, 660, 'Medical consultation', 2),
    visit(1, 510, 540, 'General check-up', 3), visit(1, 780, 825, 'Dental appointment', 4),
    visit(2, 840, 900, 'Medical certificate', 5), visit(4, 540, 600, 'Medical consultation', 6)];
}

// Sample student visits for the home and appointments previews (add ?empty=1 to see the empty state).
function sampleAppointments(today) {
  const at = (offset, minutes) => new Date(toMs(addDays(today, offset), minutes)).toISOString();
  return [
    { id: 'a1', reference_number: 'MRY-1042', reason: 'Medical consultation', status: 'confirmed', requested_start: at(2, 9 * 60) },
    { id: 'a2', reference_number: 'MRY-1039', reason: 'Vital signs check', status: 'pending', requested_start: null },
    { id: 'a3', reference_number: 'MRY-0988', reason: 'Medical certificate', status: 'completed', requested_start: at(-12, 14 * 60 + 30) },
    { id: 'a4', reference_number: 'MRY-0951', reason: 'General check-up', status: 'denied', requested_start: null }
  ];
}

// Sample open times (weekdays, 8:00 to 11:30, every half hour) for the student booking preview.
function sampleSlots(today) {
  const slots = [];
  for (let offset = 1; offset <= 20; offset++) {
    const day = addDays(today, offset);
    if ([0, 6].includes(weekday(day))) continue;
    for (let minutes = 8 * 60, index = 0; minutes < 12 * 60; minutes += 30, index++) {
      slots.push({ id: 'slot-' + day + '-' + minutes, start: toMs(day, minutes), end: toMs(day, minutes + 30), left: 1 + ((offset + index) % 3) });
    }
  }
  return slots;
}

export const dynamic = 'force-dynamic';
export default async function DashboardPreview({ searchParams }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const query = await searchParams;
  const { page = 'home' } = query;
  if (!['home','book','appointments','profile','schedule','nurse','admin'].includes(page)) notFound();
  const today = manilaDate(Date.now());
  const date = isDateKey(query.date) ? query.date : today;
  const appointments = query.empty ? [] : sampleAppointments(today);
  const announcements = query.empty ? [] : [
    { id: 'n1', title: 'Infirmary schedule update', body: 'The infirmary will be closed on November 14 (Friday).' },
    { id: 'n2', title: 'Flu vaccination week', body: 'Free flu shots at the infirmary, November 17 to 21, 9 AM to 3 PM.' }
  ];
  if (page === 'nurse' || page === 'admin') {
    const at = (offset, minutes) => new Date(toMs(addDays(today, offset), minutes)).toISOString();
    const row = (id, reason, status, urgency, start, n) => ({ id, reference_number: 'CLN-2026-00' + n, reason, status, urgency, requested_start: start });
    const todayVisits = query.empty ? [] : [row('v1', 'Vital signs check', 'confirmed', 'soon', at(0, 23 * 60 + 30), 41), row('v2', 'Medical certificate', 'checked_in', 'soon', at(0, 7 * 60), 40)];
    const pending = query.empty ? [] : [row('p1', 'Medical consultation', 'pending', 'urgent', null, 44), row('p2', 'General check-up', 'pending', 'flexible', null, 45)];
    const students = new Map(query.empty ? [] : [['v1', { full_name: 'Maria Santos', course: 'BS Nursing', year_level: 2 }], ['v2', { full_name: 'Jose Reyes', course: 'BS Biology', year_level: 3 }],
      ['p1', { full_name: 'Ana Dizon', course: 'BS Education', year_level: 1 }], ['p2', { full_name: 'Paolo Cruz', course: 'BS IT', year_level: 4 }]]);
    const staff = [
      { email: 'n-01@nurses.merayag.invalid', role: 'nurse', active: true, full_name: 'Liza Ramos', last_sign_in_at: at(0, 8 * 60) },
      { email: 'n-02@nurses.merayag.invalid', role: 'nurse', active: false, full_name: 'Grace Tan', last_sign_in_at: at(-20, 9 * 60) },
      { email: 'doc@msugensan.edu.ph', role: 'physician', active: true, full_name: 'Dr. Mario Lim', last_sign_in_at: null },
      { email: 'admin@msugensan.edu.ph', role: 'admin', active: true, full_name: null, last_sign_in_at: at(0, 7 * 60) }
    ];
    return <ClinicShell role={page} email="n-01@nurses.merayag.invalid" name={page === 'nurse' ? 'Liza Ramos' : 'admin@msugensan.edu.ph'} detail={page === 'nurse' ? 'N-01' : ''}>
      <div className="menu-content">{page === 'nurse'
        ? <NurseDeskView pending={pending} upcoming={todayVisits} students={students} counts={{ releases: query.empty ? 0 : 2, openDays: query.empty ? 0 : 6 }} plain />
        : <AdminDeskView staff={query.empty ? [] : staff} />}</div>
    </ClinicShell>;
  }
  return <ClinicShell role="student" email="student@school.example" name="Santos" detail="Maria" avatar={null} preview={page}>
      <div key={page} className="menu-content">
      {page==='home' && <StudentDashboard appointments={appointments} name="Maria Santos" released={1} announcements={announcements} preview/>}
      {page==='appointments' && <AppointmentList appointments={appointments} preview/>}
      {page==='book' && <PreviewBooking slots={query.empty ? [] : sampleSlots(today)} />}
      {page==='schedule' && <>
        <header className="page-heading"><h1>Review request</h1><p>Sample visits. Nothing here is saved.</p></header>
        <section className="paper form-stack"><h2>Review request</h2>
          <ScheduleCalendar initialBookings={sampleVisits(today)} initialDate={date} nowMs={Date.now()}
            initialRange={{ from: monthStart(addMonths(date, -1)), to: monthStart(addMonths(date, 2)) }}
            appointment={{ id: 'sample', urgency: 'As soon as possible', reason: 'Vital signs check' }} preview />
        </section></>}
      {page==='profile' && <>
        <header className="page-heading"><h1>{page==='book'?'Book an appointment':'Student details'}</h1><p>These details are used on your appointments and medical certificates.</p></header>
        <section className={page==='book'?'profile-prompt':'profile-preview'}>
          {page==='book' && <><h2>Complete your student details first</h2><p>The clinic uses your student ID to match your visit to your record.</p></>}
          <div className="paper form-stack"><h2>Personal information</h2>
            <div className="field-grid">{[['Student ID number','2026-00123'],['Full name','Sample Student'],['Course','BS Computer Science'],['Year level','1'],['Contact number','0917 000 0000'],['Student email','student@school.example']].map(([label,value]) =>
              <label key={label}>{label}<input value={value} readOnly/></label>)}</div>
            <p className="preview-note">Sample profile for layout preview.</p>
          </div>
        </section>
      </>}
      </div>
  </ClinicShell>;
}
