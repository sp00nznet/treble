/** Stub for screens not yet built. Replace with real screens per the handoff. */
export function Placeholder({ name }: { name: string }) {
  return (
    <div className="screen">
      <h1 className="h1" style={{ textTransform: "capitalize" }}>{name}</h1>
      <p style={{ color: "var(--text-2)", marginTop: 12, fontSize: 15, maxWidth: 520, lineHeight: 1.5 }}>
        This screen isn’t built yet. Implement it from the design prototype
        (<code>Treble.dc.html</code>) and the handoff README — the layout, exact
        tokens, and interactions are documented there.
      </p>
    </div>
  );
}
