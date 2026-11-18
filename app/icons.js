// Icons8 "Material Outlined" icons (free set), kept as small PNG files in /public/icons. Each one is used as a
// mask, so CSS colours it with the surrounding text colour: white on a coloured tile, plum when active.
const files = {
  home: 'home', book: 'today', slots: 'calendar-plus', plus: 'calendar-plus', calendar: 'calendar',
  history: 'clock', user: 'user', logout: 'exit', chevron: 'chevron-right', check: 'checked',
  clipboard: 'inspection', list: 'inspection', file: 'certificate', certificate: 'certificate', award: 'certificate',
  card: 'identification-documents', megaphone: 'megaphone', alert: 'error', users: 'user-group',
  lock: 'lock', upload: 'upload', trash: 'trash'
};

export function Icon({ name, size = 20, className }) {
  return <span aria-hidden="true" className={'ico' + (className ? ' ' + className : '')}
    style={{ width: size, height: size, '--ico': 'url(/icons/' + files[name] + '.png)' }} />;
}
