import { useState } from 'react'

const storageKey = 'node-os.notes'

export function Notes() {
  const [notes, setNotes] = useState(() => localStorage.getItem(storageKey) ?? '')
  return <section className="app-content notes"><label className="eyebrow" htmlFor="notes">LOCAL NOTES · AUTO-SAVED</label><textarea id="notes" value={notes} placeholder="Write a note…" onChange={(event) => { setNotes(event.target.value); localStorage.setItem(storageKey, event.target.value) }} /></section>
}
