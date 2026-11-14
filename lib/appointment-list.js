'use client';
import { useState } from 'react';
import Link from 'next/link';
import { VisitList } from './student-dashboard.js';
import { Panel } from './clinic-ui.js';

export function AppointmentList({ appointments, preview = false }) {
  const [status,setStatus] = useState('all');
  const bookUrl = preview ? '/preview?page=book' : '/clinic/book';
  const shown = appointments.filter((item) => status === 'all' || item.status === status);
  return <>
    <header className="page-heading"><h1>My appointments</h1><p>Every clinic request, with its reference number and current status.</p><Link className="button" href={bookUrl}>New request</Link></header>
    <div className="status-filters" aria-label="Filter appointments">{['all','pending','confirmed','checked_in','completed','denied','cancelled','no_show'].map((value) =>
      <button key={value} aria-pressed={status===value} onClick={()=>setStatus(value)}>{value.replaceAll('_',' ')}</button>)}</div>
    <Panel title="All visits" count={shown.length}><div className="rows"><VisitList appointments={shown} preview={preview} bookUrl={bookUrl} showAction={false}/></div></Panel>
  </>;
}
