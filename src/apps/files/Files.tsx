import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { getFilesystemFile, getFilesystemFileSizeBytes, listDirectory } from '../../core/game/filesystem'
import { formatBytes } from '../byteFormat'
import type { ExecutableFile, FilesystemFile, InstalledSoftware, SoftwarePackageFile } from '../../core/game/types'

const INITIAL_PATH = '/home/user'

export function Files() {
  const localDevice = useGameState().player.localDevice
  const filesystem = localDevice.filesystem
  const actions = useGameActions()
  const [path, setPath] = useState(INITIAL_PATH)
  const [selectedFile, setSelectedFile] = useState<string>()
  const listing = listDirectory(filesystem, path)
  const selected = selectedFile ? getFilesystemFile(filesystem, selectedFile) : undefined

  if (selectedFile) return <section className="app-content files-app">
    <header className="files-header"><p className="eyebrow">FILES</p><div className="path">{selectedFile}</div></header>
    <button className="file-back" type="button" onClick={() => setSelectedFile(undefined)}>Back to {path}</button>
    {selected?.status === 'ok'
      ? <FileDetails file={selected.file} installedSoftware={localDevice.installedSoftware} install={actions.installLocalSoftwarePackage} />
      : <p className="muted">FILE NOT FOUND</p>}
  </section>

  return <section className="app-content files-app">
    <header className="files-header"><p className="eyebrow">FILES</p><div className="path">{path}</div></header>
    <div className="file-list">
      {path !== '/' && <button className="file-row" type="button" onClick={() => setPath(parentPath(path))}>
        <span className="file-icon" aria-hidden="true">▰</span><span className="file-row-copy"><strong>../</strong><small>DIRECTORY</small></span>
      </button>}
      {listing.status === 'ok' ? listing.entries.map((entry) => {
        const entryPath = `${path === '/' ? '' : path}/${entry.name}`
        const result = entry.type === 'file' ? getFilesystemFile(filesystem, entryPath) : undefined
        return <button className="file-row" type="button" key={entry.name} onClick={() => entry.type === 'directory' ? setPath(entryPath) : setSelectedFile(entryPath)}>
          <span className="file-icon" aria-hidden="true">{entry.type === 'directory' ? '▰' : '▱'}</span>
          <span className="file-row-copy"><strong>{entry.name}</strong><small>{entry.type === 'directory' ? 'DIRECTORY' : result?.status === 'ok' ? `${typeLabel(result.file)} · ${formatBytes(getFilesystemFileSizeBytes(result.file))}` : 'FILE'}</small></span>
        </button>
      }) : <p className="muted">DIRECTORY NOT FOUND</p>}
    </div>
  </section>
}

function FileDetails({ file, installedSoftware, install }: {
  file: FilesystemFile
  installedSoftware: readonly InstalledSoftware[]
  install: (path: string) => unknown
}) {
  return <div className="file-details">
    <dl className="file-facts">
      <dt>NAME</dt><dd>{basename(file.path)}</dd>
      <dt>TYPE</dt><dd>{typeLabel(file)}</dd>
      <dt>SIZE</dt><dd>{formatBytes(getFilesystemFileSizeBytes(file))}</dd>
      <dt>PATH</dt><dd>{file.path}</dd>
    </dl>
    {file.kind === 'text' ? <section><p className="eyebrow">CONTENT</p><pre className="file-content">{file.content}</pre></section>
      : file.kind === 'software_package' ? <PackageDetails file={file} installedSoftware={installedSoftware} install={install} />
        : <ExecutableDetails file={file} />}
  </div>
}

function PackageDetails({ file, installedSoftware, install }: { file: SoftwarePackageFile; installedSoftware: readonly InstalledSoftware[]; install: (path: string) => unknown }) {
  const current = installedSoftware.find(({ id }) => id === file.productId)
  const supported = file.productId === 'nodescan'
  const alreadyInstalled = current?.releaseId === file.releaseId
  return <section className="file-kind-details">
    <p className="eyebrow">PACKAGE</p><h2>{file.name}</h2>
    <dl><dt>PRODUCT</dt><dd>{file.name}</dd><dt>VERSION</dt><dd>{file.version} {titleCase(file.channel)}</dd><dt>RELEASE</dt><dd>{file.releaseId}</dd><dt>CURRENT</dt><dd>{current && current.id === 'nodescan' ? `${current.name} ${current.version} ${titleCase(current.channel)}` : 'NOT INSTALLED'}</dd></dl>
    {!supported ? <p className="muted">UNSUPPORTED PACKAGE</p> : alreadyInstalled
      ? <><button type="button" disabled>INSTALLED ✓</button><p>INSTALLED RELEASE<br />{file.releaseId}</p></>
      : <button type="button" onClick={() => install(file.path)}>INSTALL</button>}
  </section>
}

function ExecutableDetails({ file }: { file: ExecutableFile }) {
  return <section className="file-kind-details"><p className="eyebrow">EXECUTABLE</p><dl><dt>PROGRAM</dt><dd>{file.name} ({file.programId})</dd><dt>VERSION</dt><dd>{file.version}</dd><dt>RELEASE</dt><dd>{file.releaseId}</dd></dl></section>
}

function parentPath(path: string) { return path.slice(0, path.lastIndexOf('/')) || '/' }
function basename(path: string) { return path.slice(path.lastIndexOf('/') + 1) }
function typeLabel(file: FilesystemFile) { return file.kind === 'text' ? 'TEXT' : file.kind === 'software_package' ? 'SOFTWARE PACKAGE' : 'EXECUTABLE' }
function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }
