import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App'
import source from './EditingPlaneDebug.tsx?raw'

const originalUrl = window.location.href

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', originalUrl)
})

describe('editing plane experiment', () => {
  it('does not add experimental DOM without its query flag', () => {
    render(<App />)

    expect(screen.queryByLabelText('Fixed plane input')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Visual viewport plane input')).not.toBeInTheDocument()
    expect(screen.getByTestId('os-shell')).toBeInTheDocument()
  })

  it('portals both isolated positioning strategies only when enabled', () => {
    window.history.replaceState(null, '', '/?editingPlaneDebug=1')
    render(<App />)

    expect(screen.getByLabelText('Fixed plane input')).toBeInTheDocument()
    expect(screen.getByLabelText('Visual viewport plane input')).toBeInTheDocument()
    expect(document.body.querySelectorAll(':scope > [data-editing-plane]')).toHaveLength(2)
    expect(screen.getByTestId('os-shell').contains(screen.getByLabelText('Fixed plane input'))).toBe(false)
  })

  it('contains no prohibited scrolling, user-agent, transform, timer, or keyboard constants', () => {
    expect(source).not.toMatch(/scrollTo|scrollIntoView|userAgent|setTimeout|setInterval|\.os-shell[^'"\n]*transform/i)
  })
})
