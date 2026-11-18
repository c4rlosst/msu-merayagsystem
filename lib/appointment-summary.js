import { clinicDate, urgencyLabels } from './clinic.js';
import { Badge, Panel } from './clinic-ui.js';

/** The top of an appointment page: title and status, the details, the letter link and the status history. */
export function AppointmentSummary({ item, student, letterId, history }) {
  return <>
    <header className="page-heading"><h1>{item.reason}</h1>
      <p className="head-meta"><span>{item.reference_number}</span><Badge status={item.status} /></p></header>
    <Panel title="Details">
      <dl className="facts">
        <div><dt>Visit time</dt><dd>{item.requested_start ? clinicDate(item.requested_start) : 'Awaiting nurse scheduling'}</dd></div>
        {student && <div><dt>Student</dt><dd>{student.full_name} · {student.student_number}</dd></div>}
        <div><dt>Urgency</dt><dd>{urgencyLabels[item.urgency]}</dd></div>
        <div><dt>Concern</dt><dd>{item.concern}</dd></div>
        {item.decision_reason && <div><dt>Clinic response</dt><dd>{item.decision_reason}</dd></div>}
      </dl>
      {letterId && <div className="panel-foot"><a className="button quiet" href={'/letters/' + letterId} target="_blank" rel="noreferrer">Open referral or excuse letter</a></div>}
    </Panel>
    {history && <Panel title="Status history"><ol className="timeline">{history.map((event, index) =>
      <li key={index}><Badge status={event.status} /><time>{clinicDate(event.occurred_at)}</time></li>)}</ol></Panel>}
  </>;
}
