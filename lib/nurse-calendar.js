import { ScheduleCalendar } from '../app/schedule-calendar.js';
import { fetchBookings } from './bookings.js';
import { addMonths, isDateKey, manilaDate, monthStart } from './manila.js';

// Loads about three months of visits once; the calendar then moves around instantly in the browser
// and fetches more in the background (see loadCalendarRange in app/actions.js).
export async function NurseCalendar({ db, filters, appointment }) {
  const date = isDateKey(filters.date) ? filters.date : manilaDate(Date.now());
  const from = monthStart(addMonths(date, -1));
  const to = monthStart(addMonths(date, 2));
  const bookings = await fetchBookings(db, from, to);
  return <ScheduleCalendar initialBookings={bookings} initialRange={{ from, to }} initialDate={date}
    nowMs={Date.now()} appointment={appointment} />;
}
