export default function DashboardLoading() {
  return (
    <div className="a2s-route-loading" role="status" aria-live="polite">
      <span className="a2s-route-loading-dot" aria-hidden="true" />
      <div>
        <strong>Loading page</strong>
        <p>The next screen is on its way.</p>
      </div>
    </div>
  );
}
