'use client';
import { useState } from 'react';
import { BookingForm } from '../forms.js';
import { reasons } from '../../lib/clinic.js';

export function PreviewBooking() {
  const [ready, setReady] = useState(false);
  return <>
    <header className="page-heading"><h1>Book an appointment</h1><p>Tell the nurse how soon you need a visit.</p></header>
    {ready ? <BookingForm reasons={reasons} preview /> :
      <section className="profile-prompt"><h2>Complete your student details first</h2><p>The clinic uses your student ID to match your visit to your record.</p>
        <form className="paper form-stack" onSubmit={(event) => { event.preventDefault(); setReady(true); }}>
          <h2>Personal information</h2>
          <div className="field-grid">{[['Student ID number','2026-00123'],['Full name','Sample Student'],['Course','BS Computer Science'],['Contact number','0917 000 0000']].map(([label,value]) =>
            <label key={label}>{label}<input defaultValue={value} required /></label>)}
            <label>Year level<select required defaultValue="1">{[1,2,3,4,5,6].map((year) => <option key={year}>{year}</option>)}</select></label>
            <label>School email<input value="student@school.example" readOnly /></label>
          </div>
          <button>Save and continue preview</button>
        </form>
      </section>}
  </>;
}
