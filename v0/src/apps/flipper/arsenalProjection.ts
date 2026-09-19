import { CREDENTIAL_ACCESS_MODULE_1_0, findCompatibleLocalFlipperModuleArtifacts, findInstalledFlipper, isKeyProbeCompatibleWithFlipper } from '../../core/game/flipper'
import type { LocalDeviceState } from '../../core/game/types'
import { DEAUTH_EXTENSION, findCompatibleDeauthExtension } from '../../core/game/deauth'

/** A derived view of one represented provider, never progression state. */
export interface FlipperArsenalProvider {
  readonly id: 'credential-access-module' | 'keyprobe' | 'deauth-extension'
  readonly name: string
  readonly version: string
  readonly form: 'SOFTWARE MODULE' | 'INSTALLED SOFTWARE' | 'FLIPPER EXTENSION'
  readonly integration: 'INTEGRATED' | 'AVAILABLE TO INTEGRATE' | 'COMPATIBLE' | 'AVAILABLE'
}

export interface FlipperArsenalBranch {
  readonly area: 'ACCESS' | 'NETWORK'
  readonly family: 'CREDENTIAL ACCESS' | 'DEAUTH'
  readonly providers: readonly FlipperArsenalProvider[]
}

/**
 * Project the first concrete arsenal branch from local possession. Provider
 * compatibility comes from Flipper's domain rules; this presentation stores
 * none of it and reads no target, Discovery, Knowledge, or World Truth.
 */
export function deriveFlipperArsenal(device: Pick<LocalDeviceState, 'installedSoftware' | 'filesystem'>): readonly FlipperArsenalBranch[] {
  const flipper = findInstalledFlipper(device)
  if (!flipper) return []

  const providers: FlipperArsenalProvider[] = []
  const credentialArtifact = findCompatibleLocalFlipperModuleArtifacts(device)
    .find(({ moduleId }) => moduleId === CREDENTIAL_ACCESS_MODULE_1_0.moduleId)
  if (flipper.integratedModules.includes(CREDENTIAL_ACCESS_MODULE_1_0.moduleId) || credentialArtifact) {
    providers.push({
      id: 'credential-access-module', name: CREDENTIAL_ACCESS_MODULE_1_0.name, version: CREDENTIAL_ACCESS_MODULE_1_0.version,
      form: 'SOFTWARE MODULE',
      integration: flipper.integratedModules.includes(CREDENTIAL_ACCESS_MODULE_1_0.moduleId) ? 'INTEGRATED' : 'AVAILABLE TO INTEGRATE',
    })
  }

  const keyProbe = device.installedSoftware.find(isKeyProbeCompatibleWithFlipper)
  if (keyProbe) providers.push({
    id: 'keyprobe', name: keyProbe.name, version: keyProbe.version,
    form: 'INSTALLED SOFTWARE', integration: 'COMPATIBLE',
  })

  const branches: FlipperArsenalBranch[] = providers.length ? [{ area: 'ACCESS', family: 'CREDENTIAL ACCESS', providers }] : []
  if (findCompatibleDeauthExtension(device)) branches.push({ area: 'NETWORK', family: 'DEAUTH', providers: [{ id: 'deauth-extension', name: DEAUTH_EXTENSION.name, version: DEAUTH_EXTENSION.version, form: 'FLIPPER EXTENSION', integration: 'AVAILABLE' }] })
  return branches
}
