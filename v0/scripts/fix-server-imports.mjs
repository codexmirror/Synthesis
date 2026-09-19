import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await visit(path)
    else if (entry.name.endsWith('.js')) {
      const source = await readFile(path, 'utf8')
      await writeFile(path, source.replace(/(from\s+['"]|import\s*\(\s*['"])(\.{1,2}\/[^'"]+?)(['"])/g, (_, prefix, specifier, quote) => `${prefix}${specifier.endsWith('.js') ? specifier : `${specifier}.js`}${quote}`))
    }
  }
}
await visit(fileURLToPath(new URL('../dist-server', import.meta.url)))
