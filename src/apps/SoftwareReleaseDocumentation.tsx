import { getSoftwareReleaseInformation } from './softwareReleaseInformation'

export function SoftwareReleaseDocumentation({ releaseId }: { releaseId: string }) {
  const information = getSoftwareReleaseInformation(releaseId)
  if (!information) return null
  return <>
    <div className="node-section"><span>ABOUT</span></div>
    <p className="node-note">{information.about}</p>
    <div className="node-section"><span>CAPABILITIES</span></div>
    <dl className="node-facts">{information.capabilities.map((capability) => <div key={capability.label}><dt>{capability.label}</dt><dd>{capability.description}</dd></div>)}</dl>
    <div className="node-section"><span>CHANGES</span></div>
    <ul className="software-changes">{information.changes.map((change) => <li key={change}>{change}</li>)}</ul>
  </>
}
