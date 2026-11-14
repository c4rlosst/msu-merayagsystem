'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.js';

const sizeLabel = (bytes) => bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? Math.round(bytes / 1024) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB';

/**
 * A drag-and-drop box for one file. The real file input sits inside it, so the file is sent with the form
 * as usual (nothing uploads until the form is submitted). `accept` is a comma-separated list of MIME types.
 */
export function FileDrop({ name, label, accept, required = false, maxBytes = 5242880, hint }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState('');
  const allowed = accept.split(',');

  const clear = () => { if (input.current) input.current.value = ''; setFile(null); };
  function take(list) {
    const next = list?.[0];
    if (!next) return;
    if (!allowed.includes(next.type)) { clear(); setProblem('Choose a JPG, PNG or PDF.'); return; }
    if (next.size > maxBytes) { clear(); setProblem('Choose a file no larger than ' + Math.round(maxBytes / 1048576) + ' MB.'); return; }
    setProblem('');
    const transfer = new DataTransfer();
    transfer.items.add(next);
    input.current.files = transfer.files; // hand a dropped file to the real input
    setFile(next);
  }

  // After the form is sent or reset the input empties itself; keep the card in step with it.
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => { setFile(null); setProblem(''); };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, []);

  return <div className="drop-field">
    <span className="drop-label">{label}</span>
    <label className={'drop' + (over ? ' is-over' : '')}
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => { event.preventDefault(); setOver(false); take(event.dataTransfer.files); }}>
      <input ref={input} type="file" name={name} accept={accept} required={required && !file} className="drop-input"
        onChange={(event) => take(event.target.files)} />
      <span className="tile-icon"><Icon name="upload" size={22} /></span>
      <span className="drop-text"><b>Click to upload</b> or drag and drop</span>
      <small>{hint}</small>
    </label>
    {problem && <p className="error" role="alert">{problem}</p>}
    {file && <div className="drop-file">
      <span className="tile-icon tone-green"><Icon name="certificate" size={18} /></span>
      <span className="drop-file-info"><strong>{file.name}</strong><small>{sizeLabel(file.size)} · ready to send</small></span>
      <button type="button" className="drop-remove" onClick={clear} aria-label={'Remove ' + file.name}><Icon name="trash" size={18} /></button>
    </div>}
  </div>;
}
