import { target, text, type TerminalCommand } from '../commandTypes'

export const ipCommand: TerminalCommand = {
  description: 'Show local network configuration',
  run: ({ localDevice }) => ({ type: 'output', lines: [
    [text('ADDRESS   '), target(localDevice.ip, 'local')],
    localDevice.network ? [text('NETWORK   '), target(localDevice.network, 'local')] : 'NETWORK   UNAVAILABLE',
    localDevice.gateway ? [text('GATEWAY   '), target(localDevice.gateway, 'local')] : 'GATEWAY   UNAVAILABLE',
  ] }),
}
