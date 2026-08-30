/**
 * The built-in Communication client placeholder for this VEYRA release.
 *
 * This surface intentionally observes no communication state: the simulation
 * has no foreign messages, people, accounts, or history to present. Its copy
 * describes only the availability of the client in this build, never the
 * represented person's communication history.
 */
export function VeyraCommunication() {
  return <section className="veyra-screen veyra-communication" aria-label="Communication">
    <header className="veyra-communication__head">
      <p className="veyra-eyebrow">VEYRA</p>
      <h1 className="veyra-title">Communication</h1>
    </header>
    <div className="veyra-communication__status">
      <p>Communication is unavailable.</p>
    </div>
  </section>
}
