// Date helpers for the clinic calendar. The clinic runs on Manila time (UTC+8, no daylight saving),
// so everything here is plain arithmetic on a fixed offset: no Intl, no browser time zone, and the
// same result on the server and in the browser.

export const OFFSET = 8 * 3600000;
const DAY = 86400000;

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

const pad = (value) => String(value).padStart(2, '0');
const utc = (key) => Date.parse(key + 'T00:00:00Z');

/** "2026-11-14" for a moment in time, as the date it is in Manila. */
export const manilaDate = (ms) => new Date(ms + OFFSET).toISOString().slice(0, 10);

/** Minutes since midnight in Manila. */
export function manilaMinutes(ms) {
  const date = new Date(ms + OFFSET);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/** The moment (ms) that is `minutes` after midnight Manila time on `key`. */
export const toMs = (key, minutes) => utc(key) + minutes * 60000 - OFFSET;

export const isDateKey = (value) => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) &&
  new Date(utc(value)).toISOString().slice(0, 10) === value;

export const addDays = (key, count) => new Date(utc(key) + count * DAY).toISOString().slice(0, 10);
export const weekday = (key) => new Date(utc(key)).getUTCDay();
export const startOfWeek = (key) => addDays(key, -weekday(key));
export const monthStart = (key) => key.slice(0, 7) + '-01';

export function addMonths(key, count) {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + count, 1)).toISOString().slice(0, 10);
}

export function daysInMonth(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "9:30 AM" */
export function timeLabel(minutes) {
  const hour = Math.floor(minutes / 60) % 24;
  return ((hour % 12) || 12) + ':' + pad(minutes % 60) + ' ' + (hour < 12 ? 'AM' : 'PM');
}

/** "09:30", the format of <input type="time"> and of the server action. */
export const inputTime = (minutes) => pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);

export function parseInputTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function dayLabel(key, { long = true } = {}) {
  const [year, month, day] = key.split('-').map(Number);
  const names = long ? WEEKDAYS_LONG : WEEKDAYS;
  return names[weekday(key)] + ', ' + (long ? MONTHS[month - 1] : MONTHS[month - 1].slice(0, 3)) + ' ' + day + (long ? ', ' + year : '');
}

/** "Nov 8 – 14, 2026" or "Oct 30 – Nov 5, 2026" for the week starting at `start`. */
export function weekLabel(start) {
  const end = addDays(start, 6);
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const short = (month) => MONTHS[month - 1].slice(0, 3);
  if (startMonth === endMonth) return short(startMonth) + ' ' + startDay + ' – ' + endDay + ', ' + endYear;
  return short(startMonth) + ' ' + startDay + (startYear === endYear ? '' : ', ' + startYear) +
    ' – ' + short(endMonth) + ' ' + endDay + ', ' + endYear;
}

export const monthLabel = (key) => MONTHS[Number(key.slice(5, 7)) - 1] + ' ' + key.slice(0, 4);
