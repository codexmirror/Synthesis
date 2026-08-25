import { describe, expect, it } from 'vitest'
import { getSoftwareReleaseInformation } from './softwareReleaseInformation'
import { AUTHORED_SOFTWARE_RELEASES } from '../core/game/softwareReleaseContent'

describe('software release information', () => {
  it('represents every current release without turning hidden state into documentation', () => {
    const standard = getSoftwareReleaseInformation('nodescan-1.0-standard')!
    expect(standard.capabilities.map(({ label }) => label)).toEqual(['NETWORK SCAN', 'SERVICE ANALYSIS'])
    expect(JSON.stringify(standard)).not.toMatch(/inspect/i)
    expect(getSoftwareReleaseInformation('nodescan-1.1-experimental')?.changes).toContain('Firmware fingerprinting')
    expect(getSoftwareReleaseInformation('basic-credential-toolkit-1.0')?.capabilities.map(({ label }) => label)).toContain('AUTH-017 SUPPORT')
    expect(JSON.stringify(getSoftwareReleaseInformation('node-miner-1.0'))).not.toMatch(/33%|developer|share/i)
  })
  it('returns no invented documentation for unknown releases', () => {
    expect(getSoftwareReleaseInformation('future-9.0')).toBeUndefined()
  })

  it('is a presentation projection of the authored documentation owner', () => {
    for (const release of AUTHORED_SOFTWARE_RELEASES) {
      expect(getSoftwareReleaseInformation(release.releaseId)).toEqual({
        releaseId: release.releaseId,
        ...release.documentation,
      })
    }
  })
})
