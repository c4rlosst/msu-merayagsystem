import { PreviewBooking } from './booking.js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StudentDashboard } from '../../lib/student-dashboard.js';
import { AppointmentList } from '../../lib/appointment-list.js';
import { ScheduleCalendar } from '../schedule-calendar.js';
import { addDays, addMonths, isDateKey, manilaDate, monthStart, toMs } from '../../lib/manila.js';

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

export const dynamic = 'force-dynamic';
export default async function DashboardPreview({ searchParams }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const query = await searchParams;
  const { page = 'home' } = query;
  if (!['home','book','appointments','profile','schedule'].includes(page)) notFound();
  const today = manilaDate(Date.now());
  const date = isDateKey(query.date) ? query.date : today;
  return <div className="clinic-shell">
    <aside className="sidebar">
      <Link href="/preview" className="brand">MERAYAG</Link><p className="role-label">Student portal</p>
      <nav aria-label="Clinic">{[['home','Home'],['book','Book'],['appointments','My appointments'],['profile','My profile'],['schedule','Nurse schedule']].map(([key,label]) =>
        <Link key={key} href={'/preview?page='+key} aria-current={page===key?'page':undefined}>{label}</Link>)}</nav>
    </aside>
    <main className="workspace"><p className="account">Student preview · Sample data</p>
      <div key={page} className="menu-content">
      {page==='home' && <StudentDashboard appointments={[]} name="Student" preview/>}
      {page==='appointments' && <AppointmentList appointments={[]} preview/>}
      {page==='book' && <PreviewBooking />}
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
    </main>
  </div>;
}
