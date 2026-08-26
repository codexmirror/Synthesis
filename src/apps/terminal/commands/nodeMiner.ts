import type { TerminalCommand } from '../commandTypes'
import { NODE_MINER_TERMINAL_DESCRIPTION, runNodeMinerTerminal } from '../../nodeMinerTerminal'

const UNAVAILABLE_LINES = ['Command not found: node-miner. Type "help" for available commands.']

export const nodeMinerCommand: TerminalCommand = {
  description: NODE_MINER_TERMINAL_DESCRIPTION,
  run(context, args) {
    if (!context.nodeMiner.available) return { type: 'output', lines: UNAVAILABLE_LINES }
    return { type: 'output', lines: [...runNodeMinerTerminal(args, context.operations.nodeMiner)] }
  },
}
