import { useState } from 'react'
import { loadNotes, saveNotes } from './notesStorage'

export function Notes() {
  const [notes, setNotes] = useState(loadNotes)

  function updateNotes(value: string) {
    setNotes(value)
    saveNotes(value)
  }

  return (
    <section className="app-content notes">
      <div className="notes-meta">
        <label className="eyebrow" htmlFor="notes">
          LOCAL NOTES · AUTO-SAVED
        </label>
        <output aria-label="Note character count">{notes.length} CHR</output>
      </div>
      <textarea
        id="notes"
        value={notes}
        placeholder="Write a note…"
        onChange={(event) => updateNotes(event.target.value)}
      />
    </section>
  )
}
