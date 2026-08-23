import type { TerminalCommand } from '../commandTypes'

export const installCommand: TerminalCommand = {
  description: '<local-absolute-file-path>  Install a local software package',
  run(context, args) {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: install <local-absolute-file-path>'] }
    const result = context.operations.installLocalSoftwarePackage(args[0])
    switch (result.status) {
      case 'installed': return { type: 'output', lines: ['INSTALLED', `${result.name} ${result.version} ${titleCase(result.channel)}`] }
      case 'already_installed': return { type: 'output', lines: ['ALREADY INSTALLED'] }
      case 'invalid_path': return { type: 'output', lines: ['INVALID PATH'] }
      case 'package_not_found': return { type: 'output', lines: ['FILE NOT FOUND'] }
      case 'package_not_file': return { type: 'output', lines: ['NOT A FILE'] }
      case 'not_software_package': return { type: 'output', lines: ['NOT A SOFTWARE PACKAGE'] }
      case 'unsupported_package': return { type: 'output', lines: ['UNSUPPORTED PACKAGE'] }
      case 'install_path_occupied': return { type: 'output', lines: ['INSTALLATION PATH OCCUPIED'] }
    }
  },
}

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }
