'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

// The menu. A highlight slides up or down to the page you pick, the moment you click it, instead of
// jumping once the new page has loaded. `items` are [key, href, label, icon?]; `current` is a key.
function SlideNav({ items, current, preview }) {
  const nav = useRef(null);
  const pathname = usePathname();
  const [chosen, setChosen] = useState(null);
  const [pill, setPill] = useState(null);
  const [animate, setAnimate] = useState(false);
  const active = chosen ?? current;
  useEffect(() => setChosen(null), [pathname]);
  useLayoutEffect(() => {
    const place = () => {
      const link = [...nav.current.children].find((child) => child.dataset.key === active);
      setPill(link ? { x: link.offsetLeft, y: link.offsetTop, width: link.offsetWidth, height: link.offsetHeight } : null);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [active]);
  useEffect(() => { if (pill) setAnimate(true); }, [pill]); // no slide-in on the first paint
  return <nav aria-label="Clinic" ref={nav} className={pill ? 'has-pill' : undefined}>
    {pill && <span className="nav-pill" aria-hidden="true" data-animate={animate}
      style={{ width: pill.width, height: pill.height, transform: 'translate(' + pill.x + 'px,' + pill.y + 'px)' }} />}
    {items.map(([key, href, label, icon]) =>
      <Link key={key} href={preview && icon ? '/preview?page=' + key : href} data-key={key}
        aria-current={key === active ? 'page' : undefined} onClick={() => setChosen(key)}>
        {icon && <Icon name={icon} />}{label}{icon && key === active && <Icon name="chevron" size={18} className="nav-chevron" />}
      </Link>)}
  </nav>;
}

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
        <SlideNav items={studentLinks} current={current} preview={preview} />
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
      <SlideNav items={links[role].map(([href, label]) => [href, href, label])} current={current} />
      <div className="sidebar-foot">
        <div className="staff-id" title={email}><b>{name ?? email}</b>{detail && <small>{detail}</small>}</div>
        <form action={signOut}><button className="quiet">Sign out</button></form>
      </div>
    </aside>
    <main id="clinic-content" className="workspace">{children}</main>
  </div>;
}
