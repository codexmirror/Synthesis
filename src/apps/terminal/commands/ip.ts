import { target, text, type TerminalCommand } from '../commandTypes'

export const ipCommand: TerminalCommand = {
  description: 'Show local network configuration',
  run: ({ localDevice }) => ({ type: 'output', lines: [
    [text('ADDRESS   '), target(localDevice.ip, 'local')],
    `NETWORK   ${localDevice.network ?? 'UNAVAILABLE'}`,
    `GATEWAY   ${localDevice.gateway ?? 'UNAVAILABLE'}`,
  ] }),
}
