const storageKey = 'synthesis.notes.v1'

export function loadNotes(): string {
  return localStorage.getItem(storageKey) ?? ''
}

export function saveNotes(notes: string): void {
  localStorage.setItem(storageKey, notes)
}
