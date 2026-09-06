/** A quiet context marker at the foot of an active casework screen. */
export function ClientBar({ name }: { name: string }) {
  return (
    <div className="a2s-clientbar a2s-matte">
      <span className="a2s-clientbar-label">Working with</span>
      <b>{name}</b>
    </div>
  );
}
