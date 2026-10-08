/** Decorative corner brackets for `.hud-card` panels. */
export default function HudCorners() {
  const bracket = "absolute h-3 w-3 border-theme-accent/70";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className={`${bracket} left-2 top-2 border-l-2 border-t-2`} />
      <span className={`${bracket} right-2 top-2 border-r-2 border-t-2`} />
      <span className={`${bracket} bottom-2 left-2 border-b-2 border-l-2`} />
      <span className={`${bracket} bottom-2 right-2 border-b-2 border-r-2`} />
    </div>
  );
}
