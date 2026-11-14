'use client';

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { clinicAction, loadCalendarRange } from './actions.js';
import {
  WEEKDAYS, addDays, addMonths, dayLabel, daysInMonth, inputTime, manilaDate, manilaMinutes,
  monthLabel, monthStart, parseInputTime, startOfWeek, timeLabel, toMs, weekday, weekLabel
} from '../lib/manila.js';

const FIRST_HOUR = 6;            // the week grid shows 6 AM ...
const LAST_HOUR = 20;            // ... to 8 PM
const ROW = 44;                  // pixels per hour
const SNAP = 15;                 // clicking the grid snaps to 15 minutes
const DURATIONS = [15, 30, 45, 60];
const OPEN = 8 * 60;             // only used to suggest a time: weekdays, 8 AM to 5 PM
const CLOSE = 17 * 60;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => FIRST_HOUR + index);
const GRID_HEIGHT = HOURS.length * ROW;

const top = (minutes) => ((minutes - FIRST_HOUR * 60) / 60) * ROW;
const ceilSnap = (minutes) => Math.ceil(minutes / SNAP) * SNAP;
const hourLabel = (hour) => ((hour % 12) || 12) + (hour < 12 ? ' AM' : ' PM');

function groupByDay(bookings) {
  const days = new Map();
  for (const booking of bookings) {
    const last = manilaDate(Math.max(booking.start, booking.end - 1));
    for (let day = manilaDate(booking.start); day <= last; day = addDays(day, 1)) {
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(booking);
    }
  }
  for (const list of days.values()) list.sort((a, b) => a.start - b.start);
  return days;
}

// The part of a booking that falls on `day`, as minutes since midnight.
function segment(booking, day) {
  const dayStart = toMs(day, 0);
  const dayEnd = toMs(addDays(day, 1), 0);
  return {
    from: booking.start <= dayStart ? 0 : manilaMinutes(booking.start),
    to: booking.end >= dayEnd ? 24 * 60 : manilaMinutes(booking.end)
  };
}

/**
 * Week calendar (expandable to a month) for scheduling and browsing visits. Moving between days,
 * weeks and months is instant: the visits are loaded once and more are fetched in the background.
 * With `appointment`, it also shows the "schedule this visit" form.
 */
export function ScheduleCalendar({ initialBookings, initialRange, initialDate, nowMs, appointment, preview = false }) {
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const today = manilaDate(now);
  const nowMinutes = manilaMinutes(now);

  const [view, setView] = useState('week');
  const [date, setDate] = useState(initialDate);
  const [bookings, setBookings] = useState(initialBookings);
  const [range, setRange] = useState(initialRange);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [startMin, setStartMin] = useState(null);
  const [endMin, setEndMin] = useState(null);
  const bodyRef = useRef(null);

  const action = useMemo(() => preview
    ? async () => ({ message: 'Preview only: nothing was saved.' })
    : clinicAction.bind(null, 'assign_time'), [preview]);
  const [state, dispatch, pending] = useActionState(action, {});

  const byDay = useMemo(() => groupByDay(bookings), [bookings]);
  const weekStart = startOfWeek(date);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  // Fetch more months in the background when navigation goes beyond what is already loaded.
  const ensureLoaded = useCallback(async (from, to) => {
    if (preview || (from >= range.from && to <= range.to)) return;
    const wantFrom = monthStart(addMonths(from, -1));
    const wantTo = monthStart(addMonths(to, 2));
    setLoading(true);
    setLoadError('');
    const result = await loadCalendarRange(wantFrom, wantTo);
    setLoading(false);
    if (result.error || !result.bookings) {
      setLoadError(result.error ?? 'Could not load the calendar. Try again.');
      return;
    }
    setBookings((previous) => {
      const merged = new Map(previous.map((booking) => [booking.id, booking]));
      for (const booking of result.bookings) merged.set(booking.id, booking);
      return [...merged.values()];
    });
    setRange((previous) => wantFrom <= previous.to && wantTo >= previous.from
      ? { from: wantFrom < previous.from ? wantFrom : previous.from, to: wantTo > previous.to ? wantTo : previous.to }
      : { from: wantFrom, to: wantTo });
  }, [preview, range]);

  function goTo(key, nextView = view) {
    setDate(key);
    if (nextView === 'month') ensureLoaded(monthStart(key), addMonths(key, 1));
    else ensureLoaded(startOfWeek(key), addDays(startOfWeek(key), 7));
    const url = new URL(window.location.href); // keep a refresh on the same date
    url.searchParams.set('date', key);
    window.history.replaceState(null, '', url);
  }
  function shiftMonth(key, count) {
    const first = addMonths(key, count);
    return first.slice(0, 8) + String(Math.min(Number(key.slice(8)), daysInMonth(first))).padStart(2, '0');
  }
  const step = (direction) => goTo(view === 'week' ? addDays(date, 7 * direction) : shiftMonth(date, direction));

  const earliestStart = (day) => day < today ? Infinity : day === today ? ceilSnap(nowMinutes + 1) : 0;
  const length = startMin !== null && endMin !== null && endMin > startMin ? endMin - startMin : 30;

  function chooseStart(day, minutes) {
    const start = Math.max(minutes, earliestStart(day));
    if (start > 24 * 60 - SNAP) return;
    setStartMin(start);
    setEndMin(Math.min(start + length, 24 * 60 - 1));
  }
  function pickTime(day, event) {
    if (event.target.closest('a')) return;
    if (day !== date) goTo(day);
    if (!appointment || day < today) return;
    const rect = event.currentTarget.getBoundingClientRect();
    chooseStart(day, FIRST_HOUR * 60 + Math.floor((((event.clientY - rect.top) / ROW) * 60) / SNAP) * SNAP);
  }

  // The earliest weekday time with no visit in the way, so the nurse starts from a sensible default.
  function suggestion(fromDay) {
    for (let index = 0; index < 21; index++) {
      const day = addDays(fromDay < today ? today : fromDay, index);
      if (day >= range.to) break;
      if (weekday(day) === 0 || weekday(day) === 6) continue;
      const list = byDay.get(day) ?? [];
      let minutes = Math.max(OPEN, day === today ? ceilSnap(nowMinutes + 1) : OPEN);
      while (minutes + length <= CLOSE) {
        const from = toMs(day, minutes);
        const clash = list.find((booking) => booking.start < from + length * 60000 && booking.end > from);
        if (!clash) return { day, minutes };
        minutes = Math.max(minutes + SNAP, ceilSnap(segment(clash, day).to));
      }
    }
    return null;
  }
  function suggest() {
    const found = suggestion(date);
    if (!found) return;
    if (found.day !== date) goTo(found.day);
    setStartMin(found.minutes);
    setEndMin(found.minutes + length);
  }
  useEffect(() => { if (appointment) suggest(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the working hours when the week grid opens, not the middle of the night.
  useEffect(() => {
    if (view === 'week' && bodyRef.current) {
      bodyRef.current.scrollTop = Math.max(0, top(startMin ?? 8 * 60) - ROW * 1.5);
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const startMs = startMin !== null ? toMs(date, startMin) : 0;
  const endMs = endMin !== null ? toMs(date, endMin) : 0;
  const complete = startMin !== null && endMin !== null;
  const orderOk = complete && endMin > startMin;
  const inPast = complete && startMs <= now;
  const clash = orderOk ? (byDay.get(date) ?? []).find((booking) => booking.start < endMs && booking.end > startMs) : null;
  const valid = orderOk && !inPast && !clash;
  const problem = !complete ? '' : !orderOk ? 'The end time must be after the start time.'
    : inPast ? 'That time has already passed.'
    : clash ? 'This overlaps visit ' + clash.reference + ' (' + timeLabel(segment(clash, date).from) + ' – ' + timeLabel(segment(clash, date).to) + '). Choose another time.' : '';
  const dayBookings = byDay.get(date) ?? [];
  const bookingHref = (booking) => preview ? '#' : '/clinic/appointment/' + booking.id;

  const title = view === 'week' ? weekLabel(weekStart) : monthLabel(date);
  const monthFirst = monthStart(date);
  const monthDays = Array.from({ length: daysInMonth(monthFirst) }, (_, index) =>
    monthFirst.slice(0, 8) + String(index + 1).padStart(2, '0'));

  return <section className="paper sched" aria-label="Appointment calendar" aria-busy={loading}>
    <div className="sched-toolbar">
      <div className="sched-nav">
        <button type="button" className="quiet" onClick={() => step(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous month'}>‹</button>
        <button type="button" className="quiet" onClick={() => step(1)} aria-label={view === 'week' ? 'Next week' : 'Next month'}>›</button>
        <button type="button" className="quiet" onClick={() => goTo(today)}>Today</button>
      </div>
      <h3 className="sched-title" aria-live="polite">{title}{loading && <small> · Loading…</small>}</h3>
      <div className="sched-views" role="group" aria-label="Calendar view">
        <button type="button" className="quiet" aria-pressed={view === 'week'} onClick={() => { setView('week'); goTo(date, 'week'); }}>Week</button>
        <button type="button" className="quiet" aria-pressed={view === 'month'} onClick={() => { setView('month'); goTo(date, 'month'); }}>Month</button>
      </div>
    </div>
    {loadError && <p role="alert" className="error">{loadError}</p>}

    {view === 'week' ? <div className="sched-week">
      <div className="sched-head">
        <span aria-hidden="true" />
        {weekDays.map((day) => {
          const count = (byDay.get(day) ?? []).length;
          return <button type="button" key={day} className={'sched-dayhead' + (day === today ? ' is-today' : '') + (day < today ? ' is-past' : '')}
            aria-pressed={day === date} aria-label={dayLabel(day) + ', ' + count + ' booked'} onClick={() => goTo(day)}>
            <small>{WEEKDAYS[weekday(day)]}</small>
            <strong>{Number(day.slice(8))}</strong>
            <em>{count ? count + ' booked' : ' '}</em>
          </button>;
        })}
      </div>
      <div className="sched-body" ref={bodyRef}>
        <div className="sched-grid" style={{ height: GRID_HEIGHT }}>
          <div className="sched-gutter" aria-hidden="true">
            {HOURS.map((hour) => <span key={hour} style={{ top: (hour - FIRST_HOUR) * ROW }}>{hourLabel(hour)}</span>)}
          </div>
          {weekDays.map((day) => {
            const showDraft = appointment && day === date && complete && orderOk;
            return <div key={day} className={'sched-col' + (day === date ? ' is-selected' : '') + (day < today ? ' is-past' : '')}
              onClick={(event) => pickTime(day, event)}>
              {HOURS.map((hour) => <i key={hour} className="sched-line" style={{ top: (hour - FIRST_HOUR) * ROW }} />)}
              {day === today && nowMinutes > FIRST_HOUR * 60 && <>
                <div className="sched-elapsed" style={{ height: Math.min(GRID_HEIGHT, top(nowMinutes)) }} />
                {nowMinutes < LAST_HOUR * 60 && <div className="sched-now" style={{ top: top(nowMinutes) }} />}
              </>}
              {(byDay.get(day) ?? []).map((booking) => {
                const { from, to } = segment(booking, day);
                const topPx = Math.max(0, top(from));
                const heightPx = Math.max(18, Math.min(GRID_HEIGHT, top(to)) - topPx);
                return <Link key={booking.id} href={bookingHref(booking)} className={'sched-booking ' + booking.status}
                  style={{ top: topPx, height: heightPx }} title={booking.reason + ' · ' + booking.reference}>
                  <b>{timeLabel(from)}</b> {booking.reason}
                </Link>;
              })}
              {showDraft && <div className={'sched-draft' + (clash ? ' is-conflict' : '')}
                style={{ top: Math.max(0, top(startMin)), height: Math.max(18, top(endMin) - Math.max(0, top(startMin))) }}>
                {timeLabel(startMin)} – {timeLabel(endMin)}
              </div>}
            </div>;
          })}
        </div>
      </div>
    </div> : <div className="sched-month" role="grid" aria-label="Choose a calendar date">
      {WEEKDAYS.map((name) => <span key={name} className="sched-weekday">{name}</span>)}
      {Array.from({ length: weekday(monthFirst) }, (_, index) => <span key={'blank-' + index} />)}
      {monthDays.map((day) => {
        const count = (byDay.get(day) ?? []).length;
        return <button type="button" key={day} className={'sched-cell' + (day === today ? ' is-today' : '') + (day < today ? ' is-past' : '')}
          aria-pressed={day === date} aria-label={dayLabel(day) + ', ' + count + ' booked'}
          onClick={() => { setView('week'); goTo(day, 'week'); }}>
          {Number(day.slice(8))}{count > 0 && <small>{count}</small>}
        </button>;
      })}
    </div>}

    <div className="sched-agenda">
      <h3>{dayLabel(date)}</h3>
      {dayBookings.length ? <ul>{dayBookings.map((booking) => {
        const { from, to } = segment(booking, date);
        return <li key={booking.id}><Link href={bookingHref(booking)}>
          <b>{timeLabel(from)} – {timeLabel(to)}</b> {booking.reason} <small>{booking.reference}</small>
        </Link></li>;
      })}</ul> : <p>No bookings on this day.</p>}
    </div>

    {appointment && <form action={dispatch} className="sched-form form-stack">
      <h3>Schedule this visit</h3>
      <p className="sched-hint">{appointment.urgency ? 'The student asked for a visit: ' + appointment.urgency.toLowerCase() + '. ' : ''}
        Click a time on the calendar, or adjust it below.</p>
      <input type="hidden" name="id" value={appointment.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="start" value={startMin !== null ? inputTime(startMin) : ''} />
      <input type="hidden" name="end" value={endMin !== null ? inputTime(endMin) : ''} />
      <div className="field-grid">
        <label>Start time (Manila)
          <input type="time" step="900" value={startMin !== null ? inputTime(startMin) : ''}
            onChange={(event) => setStartMin(parseInputTime(event.target.value))} />
        </label>
        <label>End time (Manila)
          <input type="time" step="900" value={endMin !== null ? inputTime(endMin) : ''}
            onChange={(event) => setEndMin(parseInputTime(event.target.value))} />
        </label>
      </div>
      <div className="sched-chips" role="group" aria-label="Visit length">
        <span>Length</span>
        {DURATIONS.map((minutes) => <button type="button" key={minutes} className="quiet" disabled={startMin === null}
          aria-pressed={orderOk && endMin - startMin === minutes}
          onClick={() => setEndMin(Math.min(startMin + minutes, 24 * 60 - 1))}>{minutes} min</button>)}
        <button type="button" className="quiet" onClick={suggest}>Suggest earliest open time</button>
      </div>
      <p className="sched-summary" role="status">{valid
        ? dayLabel(date) + ' · ' + timeLabel(startMin) + ' – ' + timeLabel(endMin)
        : complete || date < today ? '' : 'Pick a time to continue.'}</p>
      {date < today && <p role="alert" className="error">This date has passed. Choose today or a later date.</p>}
      {problem && date >= today && <p role="alert" className="error">{problem}</p>}
      {state.error && <p role="alert" className="error">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
      <button disabled={!valid || date < today || pending}>{pending ? 'Confirming…' : 'Confirm appointment'}</button>
    </form>}
  </section>;
}
