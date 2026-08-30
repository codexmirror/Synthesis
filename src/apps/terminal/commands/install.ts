import type { TerminalCommand } from '../commandTypes'

export const installCommand: TerminalCommand = {
  description: '<local-absolute-file-path>  Install a local software package',
  run(context, args) {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: install <local-absolute-file-path>'] }
    const result = context.operations.installLocalSoftwarePackage(args[0])
    switch (result.status) {
      case 'started': return { type: 'output', lines: ['INSTALLING', `${result.name} ${result.version}${result.channel ? ` ${titleCase(result.channel)}` : ''}`, `PROCESS ${result.processId}`] }
      case 'already_installed': return { type: 'output', lines: ['ALREADY INSTALLED'] }
      case 'already_installing': return { type: 'output', lines: ['INSTALLATION ALREADY RUNNING'] }
      case 'invalid_path': return { type: 'output', lines: ['INVALID PATH'] }
      case 'package_not_found': return { type: 'output', lines: ['FILE NOT FOUND'] }
      case 'package_not_file': return { type: 'output', lines: ['NOT A FILE'] }
      case 'not_software_package': return { type: 'output', lines: ['NOT A SOFTWARE PACKAGE'] }
      case 'unrecognized_package_extension': return { type: 'output', lines: ['UNRECOGNIZED PACKAGE EXTENSION'] }
      case 'install_path_occupied': return { type: 'output', lines: ['INSTALLATION PATH OCCUPIED'] }
      case 'insufficient_memory': return { type: 'output', lines: ['INSUFFICIENT MEMORY', `${result.requiredMiB} MiB required`, `${Math.floor(result.availableMiB)} MiB available`] }
    }
  },
}

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }
