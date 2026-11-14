import { Icon } from '../app/icons.js';
import { ActionForm } from '../app/forms.js';
import { postAnnouncement, removeAnnouncement } from '../app/actions.js';
import { clinicDate } from './clinic.js';
import { Heading, Panel } from './clinic-ui.js';

/** Nurse screen: post a notice students see on their home screen, and take posted ones down. */
export function AnnouncementsView({ notices }) {
  return <>
    <Heading title="Announcements">Post notices students see on their home screen, such as a closure or a schedule change.</Heading>
    <div className="desk">
      <div className="desk-rail">
        <ActionForm action={postAnnouncement} label="Post announcement" className="panel panel-form">
          <h2>New announcement</h2>
          <label>Title<input name="title" required maxLength={120} placeholder="Infirmary closed on Friday" /></label>
          <label>Message<textarea name="body" required maxLength={600} rows={4} placeholder="What students need to know" /></label>
          <label>Last day to show it
            <input type="date" name="until" />
            <small>Optional. Leave it empty to keep it up until you remove it.</small></label>
        </ActionForm>
      </div>
      <Panel title="Posted announcements" count={notices.length} className="desk-main">
        {notices.length ? <div className="posts">{notices.map((notice) => <article className="post" key={notice.id}>
          <span className="tile-icon tone-red"><Icon name="megaphone" size={18} /></span>
          <div className="post-body">
            <strong>{notice.title}</strong>
            <p>{notice.body}</p>
            <p className="post-meta">
              <span>Posted {clinicDate(notice.created_at, { dateStyle: 'medium' })}</span>
              <span className={notice.expires_at ? 'badge pending' : 'badge confirmed'}>
                {notice.expires_at ? 'Shown until ' + clinicDate(Date.parse(notice.expires_at) - 1, { dateStyle: 'medium' }) : 'Shown until removed'}</span>
            </p>
          </div>
          <ActionForm action={removeAnnouncement} label="Remove" className="inline-form">
            <input type="hidden" name="id" value={notice.id} />
          </ActionForm>
        </article>)}</div>
          : <p className="panel-empty">Nothing posted yet. Anything you post shows on every student’s home screen.</p>}
      </Panel>
    </div>
  </>;
}
