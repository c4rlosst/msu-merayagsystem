import Link from 'next/link';
import { Icon } from '../app/icons.js';
import { clinicDate, statuses } from './clinic.js';

// Small building blocks shared by the clinic pages.
export function Heading({ title, children }) {
  return <header className="page-heading"><h1>{title}</h1>{children && <p>{children}</p>}</header>;
}
export function Badge({ status }) {
  return <span className={'badge ' + status}>{statuses[status] ?? status}</span>;
}
export function Empty({ children }) {
  return <p className="paper empty">{children}</p>;
}
// A group of visit rows sits on one surface, separated by rules, instead of one box per row.
export function Rows({ children }) { return <div className="paper list">{children}</div>; }

/** A titled card. `count` is a small number next to the title, `action` a link on the right. */
export function Panel({ title, count, action, children, className = '' }) {
  return <section className={'panel ' + className}>
    <header className="panel-head">
      <h2>{title}{count != null && <span className="count">{count}</span>}</h2>{action}
    </header>
    {children}
  </section>;
}

/** Row of numbers at the top of a screen. items: [label, total, icon, { hint, alert }]. */
export function StatTiles({ items }) {
  return <dl className="tiles">{items.map(([label, total, icon, { hint, alert } = {}]) =>
    <div key={label} className={'tile' + (total ? '' : ' is-zero') + (alert && total ? ' is-alert' : '')}>
      <span className="tile-icon"><Icon name={icon} size={20} /></span>
      <dt>{label}</dt><dd>{total}</dd>{hint && <small>{hint}</small>}
    </div>)}</dl>;
}

/** Big, obvious buttons for the things people do most. items: [icon, label, href]. */
export function ActionGrid({ items, columns = 3 }) {
  return <nav className={'actions cols-' + columns}>{items.map(([icon, label, href]) =>
    <Link key={label} href={href}><span className="tile-icon"><Icon name={icon} size={20} /></span>{label}</Link>)}</nav>;
}

export const urgencyShort = { urgent: 'ASAP', soon: 'Soon', flexible: 'Flexible' };
export const timeOf = (value) => clinicDate(value, { hour: 'numeric', minute: '2-digit' }).toUpperCase();
