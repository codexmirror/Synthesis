import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { getFilesystemFile, listDirectory } from '../../core/game/filesystem'
import type { InstalledSoftware, SoftwarePackageFile } from '../../core/game/types'

const INITIAL_PATH = '/home/user'

export function Files() {
  const localDevice = useGameState().player.localDevice
  const filesystem = localDevice.filesystem
  const actions = useGameActions()
  const [path, setPath] = useState(INITIAL_PATH)
  const [selectedFile, setSelectedFile] = useState<string>()
  const listing = listDirectory(filesystem, path)
  const selected = selectedFile ? getFilesystemFile(filesystem, selectedFile) : undefined

  if (selectedFile) return <section className="app-content">
    <p className="eyebrow">LOCAL FILES</p>
    <div className="path">{selectedFile}</div>
    <button className="file-back" type="button" onClick={() => setSelectedFile(undefined)}>Back to {path}</button>
    {selected?.status === 'ok' ? selected.file.kind === 'text'
      ? <><p className="eyebrow">TEXT</p><pre className="file-content">{selected.file.content}</pre></>
      : <PackageDetails file={selected.file} installedSoftware={localDevice.installedSoftware} install={actions.installLocalSoftwarePackage} />
      : <p className="muted">FILE NOT FOUND</p>}
  </section>

  return <section className="app-content">
    <p className="eyebrow">LOCAL FILES</p>
    <div className="path">{path}</div>
    {listing.status === 'ok' ? listing.entries.map((entry) => {
      const entryPath = `${path === '/' ? '' : path}/${entry.name}`
      return <button className="file-row" type="button" key={entry.name} onClick={() => entry.type === 'directory' ? setPath(entryPath) : setSelectedFile(entryPath)}>
        <span aria-hidden="true">{entry.type === 'directory' ? '▰' : '▱'}</span><span>{entry.name}</span>
      </button>
    }) : <p className="muted">DIRECTORY NOT FOUND</p>}
  </section>
}

function PackageDetails({ file, installedSoftware, install }: {
  file: SoftwarePackageFile
  installedSoftware: readonly InstalledSoftware[]
  install: (path: string) => unknown
}) {
  const current = installedSoftware.find(({ id }) => id === file.productId)
  const supported = file.productId === 'nodescan'
  const alreadyInstalled = current?.releaseId === file.releaseId
  return <div className="file-package">
    <p className="eyebrow">SOFTWARE PACKAGE</p><h2>{file.name}</h2><p>{file.version} {titleCase(file.channel)}</p>
    <dl><dt>RELEASE</dt><dd>{file.releaseId}</dd><dt>PATH</dt><dd>{file.path}</dd><dt>CURRENT</dt><dd>{current && current.id === 'nodescan' ? `${current.name} ${current.version} ${titleCase(current.channel)}` : 'NOT INSTALLED'}</dd></dl>
    {!supported ? <p className="muted">UNSUPPORTED PACKAGE</p> : alreadyInstalled
      ? <><button type="button" disabled>INSTALLED ✓</button><p>INSTALLED RELEASE<br />{file.releaseId}</p></>
      : <button type="button" onClick={() => install(file.path)}>INSTALL</button>}
  </div>
}

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }
