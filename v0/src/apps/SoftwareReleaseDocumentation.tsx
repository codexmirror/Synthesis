import { useState, type ReactNode } from 'react'
import { getSoftwareReleaseInformation } from './softwareReleaseInformation'

/**
 * Player-facing release documentation, presented in the small pieces the
 * software surfaces actually compose.
 *
 * Information being available is not the same as information being expanded:
 * Files keeps the whole document behind a disclosure, System shows the
 * about/capabilities summary with a software row and keeps the rest behind the
 * same disclosure, and Install Review states only what the release provides.
 * All of them read a presentation projection of the authored release content;
 * none of them is gameplay truth.
 */
export function SoftwareReleaseAbout({ releaseId }: { releaseId: string }) {
  const information = getSoftwareReleaseInformation(releaseId)
  if (!information) return null
  return <>
    <div className="node-section"><span>ABOUT</span></div>
    <p className="node-note">{information.about}</p>
  </>
}

export function SoftwareReleaseCapabilities({ releaseId, heading = 'CAPABILITIES' }: { releaseId: string; heading?: string }) {
  const information = getSoftwareReleaseInformation(releaseId)
  if (!information) return null
  return <>
    <div className="node-section"><span>{heading}</span></div>
    <dl className="node-facts">{information.capabilities.map((capability) => <div key={capability.label}><dt>{capability.label}</dt><dd>{capability.description}</dd></div>)}</dl>
  </>
}

export function SoftwareReleaseChanges({ releaseId }: { releaseId: string }) {
  const information = getSoftwareReleaseInformation(releaseId)
  if (!information) return null
  return <>
    <div className="node-section"><span>CHANGES</span></div>
    <ul className="software-changes">{information.changes.map((change) => <li key={change}>{change}</li>)}</ul>
  </>
}

/**
 * The compact RELEASE INFORMATION disclosure. Closed by default: nothing it
 * holds is needed to decide what the software is or what can be done with it.
 * `summary` includes about/capabilities for surfaces that do not already show
 * them; `facts` carries the caller's own represented release metadata, which
 * remains visible even for a release the documentation registry does not
 * describe.
 */
export function SoftwareReleaseDisclosure({ releaseId, summary = false, facts }: { releaseId: string; summary?: boolean; facts?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <section className="release-disclosure">
    <button className="node-disclosure" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>RELEASE INFORMATION</span>
      <span className="node-disclosure-mark" aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="release-disclosure-panel">
      {summary && <><SoftwareReleaseAbout releaseId={releaseId} /><SoftwareReleaseCapabilities releaseId={releaseId} /></>}
      <SoftwareReleaseChanges releaseId={releaseId} />
      {facts}
    </div>}
  </section>
}
