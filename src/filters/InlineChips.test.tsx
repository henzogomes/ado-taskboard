import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineChips } from './InlineChips'

const options = ['New', 'Active', 'Done']

describe('InlineChips', () => {
  it('renders the label and a button per option', () => {
    render(<InlineChips label="State" options={options} selected={[]} onChange={vi.fn()} />)

    expect(screen.getByText('State')).toBeInTheDocument()
    for (const option of options) {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    }
  })

  it('reflects the selected state via aria-pressed', () => {
    render(<InlineChips label="State" options={options} selected={['Active']} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange adding the option when an unselected chip is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<InlineChips label="State" options={options} selected={['New']} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Active' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['New', 'Active'])
  })

  it('calls onChange removing the option when a selected chip is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<InlineChips label="State" options={options} selected={['New', 'Active']} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'New' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['Active'])
  })

  it('shows a muted "none" when there are no options', () => {
    render(<InlineChips label="State" options={[]} selected={[]} onChange={vi.fn()} />)

    expect(screen.getByText('none')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
