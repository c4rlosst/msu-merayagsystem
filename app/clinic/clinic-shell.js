'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '../actions.js';
import { Icon } from '../icons.js';

const roleNames = { student: 'Student', nurse: 'Nurse', physician: 'Physician', admin: 'Administrator' };
const links = {
  nurse: [['/clinic', 'Clinic desk'], ['/clinic/calendar', 'Calendar'], ['/clinic/slots', 'Open slots'], ['/clinic/announcements', 'Announcements'], ['/clinic/audit', 'Audit log']],
  physician: [['/clinic', 'Certificates']],
  admin: [['/clinic/admin', 'Staff access'], ['/clinic/audit', 'Audit log']]
};
const studentLinks = [
  ['home', '/clinic', 'Home', 'home'], ['book', '/clinic/book', 'Book an Appointment', 'book'],
  ['appointments', '/clinic/appointments', 'My Appointments', 'history'], ['profile', '/clinic/profile', 'My Profile', 'user']
];

// The sidebar and page frame. It lives in the clinic layout, so it stays on screen while only the
// content area changes (and shows a loading skeleton) when someone moves between pages.
// Students get a light sidebar with icons and a top bar showing their name and photo; staff keep the
// dark one. `preview` (a page key) points the student links at the dev-only /preview pages.
export function ClinicShell({ role, email, name, detail, avatar, preview, children }) {
  const screen = usePathname().split('/')[2];
  if (role === 'student') {
    const current = preview ?? (['appointment', 'certificate'].includes(screen) ? 'appointments' : screen ?? 'home');
    return <div className="clinic-shell student-shell">
      <a href="#clinic-content" className="skip-link">Skip to content</a>
      <aside className="sidebar no-print">
        <Link href={preview ? '/preview' : '/clinic'} className="brand">
          <Image src="/merayag-phoenix-panel.png" alt="" width={689} height={1000} sizes="48px" className="brand-mark" priority />
          <span><b>MERAYAG</b><small>Student portal</small></span>
        </Link>
        <p className="menu-label">Main Menu</p>
        <nav aria-label="Clinic">{studentLinks.map(([key, href, label, icon]) =>
          <Link key={key} href={preview ? '/preview?page=' + key : href} aria-current={key === current ? 'page' : undefined}>
            <Icon name={icon} />{label}{key === current && <Icon name="chevron" size={18} className="nav-chevron" />}
          </Link>
        )}</nav>
        <form action={signOut} className="signout"><button className="quiet"><Icon name="logout" />Sign Out</button></form>
      </aside>
      <div className="student-main">
        <header className="topbar no-print">
          <div className="who"><b>{name}</b><small>{detail}</small></div>
          {avatar ? <img src={avatar} alt="" className="avatar" referrerPolicy="no-referrer" />
            : <span className="avatar" aria-hidden="true">{(name || '?').slice(0, 1).toUpperCase()}</span>}
        </header>
        <main id="clinic-content" className="workspace">{children}</main>
      </div>
    </div>;
  }
  const current = screen ? '/clinic/' + screen : role === 'admin' ? '/clinic/admin' : '/clinic';
  return <div className="clinic-shell">
    <a href="#clinic-content" className="skip-link">Skip to content</a>
    <aside className="sidebar no-print">
      <Link href="/clinic" className="brand">
        <Image src="/merayag-phoenix-panel.png" alt="" width={689} height={1000} sizes="48px" className="brand-mark" priority />
        <span><b>MERAYAG</b><small>{roleNames[role]} portal</small></span>
      </Link>
      <nav aria-label="Clinic">{links[role].map(([href, label]) =>
        <Link key={href} href={href} aria-current={href === current ? 'page' : undefined}>{label}</Link>
      )}</nav>
      <div className="sidebar-foot">
        <div className="staff-id" title={email}><b>{name ?? email}</b>{detail && <small>{detail}</small>}</div>
        <form action={signOut}><button className="quiet">Sign out</button></form>
      </div>
    </aside>
    <main id="clinic-content" className="workspace">{children}</main>
  </div>;
}
