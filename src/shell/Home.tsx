import { type AppId, appEntries } from './appRegistry'

export function Home({ openApp }: { openApp: (app: AppId) => void }) {
  return (
    <main className="home">
      <div className="home-heading">
        <p className="eyebrow">LOCAL WORKSPACE</p>
        <h1>Select a module</h1>
      </div>
      <div className="app-grid">
        {appEntries.map(([id, app], index) => (
          <button
            className="app-launcher"
            key={id}
            onClick={() => openApp(id)}
            aria-label={`Open ${app.label}`}
          >
            <span className="app-glyph">{app.glyph}</span>
            <span>{app.label}</span>
            <small>
              {String(index + 1).padStart(2, '0')} / OPEN
            </small>
          </button>
        ))}
      </div>
    </main>
  )
}
