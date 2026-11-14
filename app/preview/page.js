import { PreviewBooking } from './booking.js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StudentDashboard } from '../../lib/student-dashboard.js';
import { AppointmentList } from '../../lib/appointment-list.js';

export const dynamic = 'force-dynamic';
export default async function DashboardPreview({ searchParams }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { page = 'home' } = await searchParams;
  if (!['home','book','appointments','profile'].includes(page)) notFound();
  const groups = [1,2,3].map((offset) => {
    const day = new Date(Date.now() + offset * 86400000).toISOString().slice(0,10);
    return {key: day, label: day, slots: ['09:00 AM','09:30 AM','10:00 AM','10:30 AM'].map((label,index) => ({id: day + index, label, remaining: 3}))};
  });
  return <div className="clinic-shell">
    <aside className="sidebar">
      <Link href="/preview" className="brand">MERAYAG</Link><p className="role-label">Student portal</p>
      <nav aria-label="Clinic">{[['home','Home'],['book','Book'],['appointments','My appointments'],['profile','My profile']].map(([key,label]) =>
        <Link key={key} href={'/preview?page='+key} aria-current={page===key?'page':undefined}>{label}</Link>)}</nav>
    </aside>
    <main className="workspace"><p className="account">Student preview · Sample data</p>
      <div key={page} className="menu-content">
      {page==='home' && <StudentDashboard appointments={[]} name="Student" preview/>}
      {page==='appointments' && <AppointmentList appointments={[]} preview/>}
      {page==='book' && <PreviewBooking groups={groups}/>}
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
