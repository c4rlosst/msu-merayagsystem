import { clinicDate } from './clinic.js';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** The email a student gets when a nurse cancels their appointment. */
export function cancellationEmail({ name, reason, start, reference, explanation, bookUrl }) {
  const when = start ? clinicDate(start, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  const subject = 'Your clinic visit' + (start ? ' on ' + clinicDate(start, { month: 'long', day: 'numeric' }) : '') + ' was cancelled';
  const greeting = name ? 'Hello ' + name + ',' : 'Hello,';
  const text = [
    greeting, '',
    'The infirmary cancelled your appointment.', '',
    'Visit: ' + reason, when ? 'Was scheduled for: ' + when : null, 'Reference: ' + reference, '',
    'Reason from the nurse:', explanation, '',
    bookUrl ? 'You can book another time here: ' + bookUrl : 'You can book another time from your MERAYAG student account.', '',
    'MERAYAG University Infirmary'
  ].filter((line) => line !== null).join('\n');
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:32rem;margin:0 auto;color:#2b2230">
  <div style="background:#750a5a;color:#fff;padding:18px 22px;font-size:18px;font-weight:700;letter-spacing:.04em">MERAYAG</div>
  <div style="border:1px solid #e1e4ea;border-top:0;padding:22px">
    <p style="margin:0 0 14px">${escape(greeting)}</p>
    <p style="margin:0 0 14px"><strong>The infirmary cancelled your appointment.</strong></p>
    <table style="border-collapse:collapse;margin:0 0 16px;font-size:14px">
      <tr><td style="padding:3px 14px 3px 0;color:#6b6674">Visit</td><td>${escape(reason)}</td></tr>
      ${when ? `<tr><td style="padding:3px 14px 3px 0;color:#6b6674">Was scheduled for</td><td>${escape(when)}</td></tr>` : ''}
      <tr><td style="padding:3px 14px 3px 0;color:#6b6674">Reference</td><td>${escape(reference)}</td></tr>
    </table>
    <p style="margin:0 0 6px;color:#6b6674;font-size:13px">Reason from the nurse</p>
    <p style="margin:0 0 18px;padding:10px 14px;background:#f3e0ec;white-space:pre-wrap">${escape(explanation)}</p>
    ${bookUrl ? `<p style="margin:0 0 18px"><a href="${escape(bookUrl)}" style="background:#ffb719;color:#2a1c22;padding:10px 18px;text-decoration:none;font-weight:700;border-radius:6px;display:inline-block">Book another time</a></p>` : ''}
    <p style="margin:0;color:#6b6674;font-size:12px">MERAYAG University Infirmary</p>
  </div></div>`;
  return { subject, text, html };
}
