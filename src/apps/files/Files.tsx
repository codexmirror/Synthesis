import { useState } from 'react'
import { useGameState } from '../../app/GameContext'
import { getFilesystemFile, listDirectory } from '../../core/game/filesystem'

const INITIAL_PATH = '/home/user'

export function Files() {
  const filesystem = useGameState().player.localDevice.filesystem
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
      : <div className="file-package"><p className="eyebrow">SOFTWARE PACKAGE</p><h2>{selected.file.name}</h2><p>{selected.file.version} {titleCase(selected.file.channel)}</p><dl><dt>RELEASE</dt><dd>{selected.file.releaseId}</dd><dt>PATH</dt><dd>{selected.file.path}</dd></dl></div>
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

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }
