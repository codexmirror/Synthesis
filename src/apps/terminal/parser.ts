export interface ParsedCommand {
  raw: string
  name: string
  args: string[]
}

export function parseCommand(input: string): ParsedCommand {
  const raw = input.trim()
  const [name = '', ...args] = raw ? raw.split(/\s+/) : []
  return { raw, name: name.toLowerCase(), args }
}
