import { useState } from 'react'
import { useGameState } from '../../app/GameContext'
import { listDirectory, readTextFile } from '../../core/game/filesystem'

const INITIAL_PATH = '/home/user'

export function Files() {
  const filesystem = useGameState().player.localDevice.filesystem
  const [path, setPath] = useState(INITIAL_PATH)
  const [selectedFile, setSelectedFile] = useState<string>()
  const listing = listDirectory(filesystem, path)
  const selected = selectedFile ? readTextFile(filesystem, selectedFile) : undefined

  if (selectedFile) return <section className="app-content">
    <p className="eyebrow">LOCAL FILES</p>
    <div className="path">{selectedFile}</div>
    <button className="file-back" type="button" onClick={() => setSelectedFile(undefined)}>Back to {path}</button>
    {selected?.status === 'ok' ? <pre className="file-content">{selected.content}</pre> : <p className="muted">FILE NOT FOUND</p>}
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
