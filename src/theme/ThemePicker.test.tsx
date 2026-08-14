import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemePicker } from './ThemePicker'
import { THEMES } from './themes'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  delete document.documentElement.dataset.theme
})

describe('ThemePicker', () => {
  it('shows the active theme label and lists every theme when opened', async () => {
    const user = userEvent.setup()
    render(<ThemePicker />)

    const trigger = screen.getByRole('button', { name: /theme/i })
    expect(trigger).toHaveTextContent('Light')

    await user.click(trigger)
    // Menu text carries a "✓" (current) and an emoji prefix, so match the label
    // as a substring rather than exact.
    const labels = screen.getAllByRole('menuitem').map((el) => el.textContent?.replace('✓', '').trim())
    for (const t of THEMES) {
      expect(labels.some((l) => l?.includes(t.label)), t.label).toBe(true)
    }
  })

  it('applies and persists the selected theme', async () => {
    const user = userEvent.setup()
    render(<ThemePicker />)

    await user.click(screen.getByRole('button', { name: /theme/i }))
    await user.click(screen.getByRole('menuitem', { name: /^Dark$/ }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('ado-taskboard-theme')).toBe('dark')
  })

  it('previews on hover without committing, and reverts when dismissed by clicking outside', async () => {
    const user = userEvent.setup()
    render(<ThemePicker />)

    await user.click(screen.getByRole('button', { name: /theme/i }))
    await user.hover(screen.getByRole('menuitem', { name: /^Dark$/ }))

    // Applied VISUALLY (preview), but NOT committed and the menu stays open.
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('ado-taskboard-theme')).toBe('light')
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Dismiss without selecting → revert to the committed theme.
    await user.click(document.body)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('arrow keys preview without committing; Enter commits + closes', async () => {
    const user = userEvent.setup()
    render(<ThemePicker />)

    await user.click(screen.getByRole('button', { name: /theme/i }))
    // Highlight starts on the current theme (Light, pinned first); ↓ → next light
    // theme (alphabetical: Catppuccin Latte), applied as a preview only.
    await user.keyboard('{ArrowDown}')
    expect(document.documentElement.dataset.theme).toBe('catppuccin-latte')
    expect(localStorage.getItem('ado-taskboard-theme')).toBe('light') // not committed yet
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Enter}')
    expect(localStorage.getItem('ado-taskboard-theme')).toBe('catppuccin-latte') // committed
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Escape reverts the preview to the committed theme', async () => {
    const user = userEvent.setup()
    render(<ThemePicker />)

    await user.click(screen.getByRole('button', { name: /theme/i }))
    await user.keyboard('{ArrowDown}')
    expect(document.documentElement.dataset.theme).toBe('catppuccin-latte') // previewed

    await user.keyboard('{Escape}')
    expect(document.documentElement.dataset.theme).toBe('light') // reverted
    expect(localStorage.getItem('ado-taskboard-theme')).toBe('light')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
