import type { AuthenticatedSnapshot } from './model'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'content-type': 'application/json', ...init?.headers } })
  const body = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(body.error ?? 'Unable to enter Synthesis.')
  return body
}

export const restoreOnlineSession = () => request<AuthenticatedSnapshot>('/api/session')
export const enterSynthesis = (name: string, password: string) => request<AuthenticatedSnapshot>('/api/enter', { method: 'POST', body: JSON.stringify({ name, password }) })
export const logoutOnlineSession = () => request<{ ok: true }>('/api/logout', { method: 'POST', body: '{}' })
