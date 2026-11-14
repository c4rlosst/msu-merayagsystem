export const reasons = ['Vital signs check', 'Medical consultation', 'General check-up', 'Dental appointment', 'Medical certificate'];
export const statuses = {
  pending: 'Pending', confirmed: 'Confirmed', denied: 'Denied', cancelled: 'Cancelled',
  checked_in: 'Checked in', completed: 'Completed', no_show: 'No-show',
  awaiting_authorization: 'Awaiting authorization', authorized: 'Authorized', released: 'Released'
};
// Building an Intl.DateTimeFormat is slow, so each distinct set of options is built once and reused.
const formatters = new Map();
export function clinicDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  const key = JSON.stringify(options);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-PH', { ...options, timeZone: 'Asia/Manila' });
    formatters.set(key, formatter);
  }
  return formatter.format(new Date(value));
}

export const urgencyLabels = { urgent: 'As soon as possible', soon: 'In the next few days', flexible: 'I can wait' };
