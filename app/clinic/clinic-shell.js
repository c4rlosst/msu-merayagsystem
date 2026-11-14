'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '../actions.js';

const roleNames = { student: 'Student', nurse: 'Nurse', physician: 'Physician', admin: 'Administrator' };
const links = {
  student: [['/clinic', 'Home'], ['/clinic/book', 'Book'], ['/clinic/appointments', 'My appointments'], ['/clinic/profile', 'My profile']],
  nurse: [['/clinic', 'Clinic desk'], ['/clinic/calendar', 'Calendar'], ['/clinic/audit', 'Audit log']],
  physician: [['/clinic', 'Certificates']],
  admin: [['/clinic/admin', 'Staff access'], ['/clinic/audit', 'Audit log']]
};

// The sidebar and page frame. It lives in the clinic layout, so it stays on screen while only the
// content area changes (and shows a loading skeleton) when someone moves between pages.
export function ClinicShell({ role, email, children }) {
  const screen = usePathname().split('/')[2];
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
        <span title={email}>{email}</span>
        <form action={signOut}><button className="quiet">Sign out</button></form>
      </div>
    </aside>
    <main id="clinic-content" className="workspace">{children}</main>
  </div>;
}
