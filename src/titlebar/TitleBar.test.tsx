import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { TitleBar } from './TitleBar'

describe('TitleBar', () => {
  const original = window.taskboard

  afterEach(() => {
    if (original === undefined) delete window.taskboard
    else window.taskboard = original
    vi.restoreAllMocks()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders nothing in the plain web app (no preload bridge)', () => {
    delete window.taskboard
    const { container } = render(<TitleBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the drag strip and themes the overlay from the active theme', async () => {
    const setTitleBarOverlay = vi.fn()
    window.taskboard = { isDesktop: true, setTitleBarOverlay }
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) =>
        name === '--surface' ? '17 24 39' : '156 163 175',
    } as CSSStyleDeclaration)

    const { container } = render(<TitleBar />)
    expect(container.firstChild).not.toBeNull()
    expect(container.firstChild).toHaveTextContent('ADO Taskboard')
    expect(setTitleBarOverlay).toHaveBeenCalledWith({ color: '#111827', symbolColor: '#9ca3af' })

    // A theme switch (commit or preview) re-syncs the overlay colors.
    document.documentElement.dataset.theme = 'dark'
    await vi.waitFor(() => expect(setTitleBarOverlay).toHaveBeenCalledTimes(2))
  })
})
