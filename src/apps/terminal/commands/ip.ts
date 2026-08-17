import { target, text, type TerminalCommand } from '../commandTypes'

export const ipCommand: TerminalCommand = {
  description: 'Show local address',
  run: ({ localDevice }) => ({ type: 'output', lines: [[text('Local address: '), target(localDevice.ip, 'local')]] }),
}
