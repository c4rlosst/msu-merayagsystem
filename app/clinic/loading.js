// Shown the instant someone clicks a link inside the clinic, while the next page loads.
export default function Loading() {
  return <div className="skeleton" role="status" aria-label="Loading">
    <span className="skeleton-bar title" />
    <span className="skeleton-bar" style={{ width: '55%' }} />
    <span className="skeleton-bar card" />
    <span className="skeleton-bar card" />
  </div>;
}
