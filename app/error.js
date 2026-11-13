'use client';

export default function ClinicError({ unstable_retry }) {
  return <main className="workspace"><section className="paper">
    <h1>The clinic could not load</h1>
    <p>Try again. If the problem continues, contact the university clinic.</p>
    <button onClick={() => unstable_retry()}>Try again</button>
  </section></main>;
}
