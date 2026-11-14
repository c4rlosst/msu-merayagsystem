export const reasons = ['Vital signs check', 'Medical consultation', 'General check-up', 'Dental appointment', 'Medical certificate'];
export const statuses = {
  pending: 'Pending', confirmed: 'Confirmed', denied: 'Denied', cancelled: 'Cancelled',
  checked_in: 'Checked in', completed: 'Completed', no_show: 'No-show',
  awaiting_authorization: 'Awaiting authorization', authorized: 'Authorized', released: 'Released'
};
export function clinicDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat('en-PH', { ...options, timeZone: 'Asia/Manila' }).format(new Date(value));
}

export const urgencyLabels = { urgent: 'As soon as possible', soon: 'In the next few days', flexible: 'I can wait' };
