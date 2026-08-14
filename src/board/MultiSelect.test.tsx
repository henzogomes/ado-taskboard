import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiSelect } from './MultiSelect'

const options = ['Alice', 'Bob', 'Charlie']

function getTrigger(name: RegExp | string = 'Developer') {
  return screen.getByRole('button', { name })
}

describe('MultiSelect', () => {
  it('renders the trigger with the label and no badge when nothing is selected', () => {
    render(<MultiSelect label="Developer" options={options} selected={[]} onChange={vi.fn()} />)

    expect(getTrigger()).toHaveTextContent('Developer')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('uses the default trigger className when triggerClassName is omitted', () => {
    render(<MultiSelect label="Developer" options={options} selected={[]} onChange={vi.fn()} />)

    expect(getTrigger()).toHaveClass('mt-1.5')
  })

  it('applies a custom triggerClassName to the trigger button when provided', () => {
    render(
      <MultiSelect
        label="Developer"
        options={options}
        selected={[]}
        onChange={vi.fn()}
        triggerClassName="w-40 custom"
      />,
    )

    const trigger = getTrigger()
    expect(trigger).toHaveClass('w-40', 'custom')
    expect(trigger).not.toHaveClass('mt-1.5')
  })

  it('shows a count badge reflecting the number of selected options', () => {
    render(<MultiSelect label="Developer" options={options} selected={['Alice', 'Bob']} onChange={vi.fn()} />)

    expect(getTrigger(/Developer/)).toHaveTextContent('2')
  })

  it('opens the popover and lists every option as a checkbox', async () => {
    const user = userEvent.setup()
    render(<MultiSelect label="Developer" options={options} selected={[]} onChange={vi.fn()} />)

    await user.click(getTrigger())

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    for (const option of options) {
      expect(screen.getByRole('checkbox', { name: option })).toBeInTheDocument()
    }
  })

  it('narrows the list when typing in the search input', async () => {
    const user = userEvent.setup()
    render(<MultiSelect label="Developer" options={options} selected={[]} onChange={vi.fn()} />)

    await user.click(getTrigger())
    await user.type(screen.getByRole('searchbox'), 'bo')

    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Alice' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Charlie' })).not.toBeInTheDocument()
  })

  it('search is case-insensitive', async () => {
    const user = userEvent.setup()
    render(<MultiSelect label="Developer" options={options} selected={[]} onChange={vi.fn()} />)

    await user.click(getTrigger())
    await user.type(screen.getByRole('searchbox'), 'ALICE')

    expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeInTheDocument()
  })

  it('shows a muted "none" when the search matches nothing', async () => {
    const user = userEvent.setup()
    render(<MultiSelect label="Developer" options={options} selected={[]} onChange={vi.fn()} />)

    await user.click(getTrigger())
    await user.type(screen.getByRole('searchbox'), 'zzz')

    expect(screen.getByText('none')).toBeInTheDocument()
  })

  it('shows a muted "none" when there are no options at all', async () => {
    const user = userEvent.setup()
    render(<MultiSelect label="Developer" options={[]} selected={[]} onChange={vi.fn()} />)

    await user.click(getTrigger())

    expect(screen.getByText('none')).toBeInTheDocument()
  })

  it('calls onChange adding the option when an unselected option is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultiSelect label="Developer" options={options} selected={['Alice']} onChange={onChange} />)

    await user.click(getTrigger(/Developer/))
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['Alice', 'Bob'])
  })

  it('calls onChange removing the option when a selected option is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultiSelect label="Developer" options={options} selected={['Alice', 'Bob']} onChange={onChange} />)

    await user.click(getTrigger(/Developer/))
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['Bob'])
  })

  it('keeps the popover open after toggling an option', async () => {
    const user = userEvent.setup()
    render(<MultiSelect label="Developer" options={options} selected={[]} onChange={vi.fn()} />)

    await user.click(getTrigger())
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<MultiSelect label="Developer" options={options} selected={[]} onChange={vi.fn()} />)

    await user.click(getTrigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on outside mousedown', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <MultiSelect label="Developer" options={options} selected={[]} onChange={vi.fn()} />
        <div data-testid="outside">outside</div>
      </div>,
    )

    await user.click(getTrigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
