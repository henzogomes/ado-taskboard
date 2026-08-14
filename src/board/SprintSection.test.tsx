import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SprintSection, SectionSkeleton } from './SprintSection'
import type { Board, Iteration, WorkItem } from '../api/types'
import type { SprintSection as SprintSectionModel } from '../domain/board'

const iteration: Iteration = { id: 'it-1', name: 'Sprint 42', path: 'Proj\\Sprint 42' }

const board: Board = {
  columns: [
    { name: 'New', columnType: 'incoming', isSplit: false, stateMappings: {} },
    { name: 'Done', columnType: 'outgoing', isSplit: false, stateMappings: {} },
  ],
}

function makeSection(): SprintSectionModel {
  return {
    iteration,
    lanes: [],
    noParentLane: { story: null, tasksByColumn: {}, taskCount: 0 },
    storyCount: 0,
    taskCount: 0,
  }
}

const story: WorkItem = {
  id: 101,
  type: 'User Story',
  title: 'Login flow',
  state: 'New',
  boardColumn: 'New',
  assignedTo: null,
  tags: [],
  parent: null,
  iterationPath: 'Proj\\Sprint 42',
  rev: 1,
}

/** A section carrying one story lane, so the body has real column headers + a card. */
function makeSectionWithContent(): SprintSectionModel {
  return {
    iteration,
    lanes: [{ story, tasksByColumn: {}, taskCount: 0 }],
    noParentLane: { story: null, tasksByColumn: {}, taskCount: 0 },
    storyCount: 1,
    taskCount: 0,
  }
}

describe('SprintSection', () => {
  it('reflects the `expanded` prop on the <details> open attribute', () => {
    const { container, rerender } = render(
      <SprintSection section={makeSection()} board={board} showAll expanded onToggle={() => {}} />,
    )
    const details = container.querySelector('details')!
    expect(details.open).toBe(true)

    rerender(
      <SprintSection section={makeSection()} board={board} showAll expanded={false} onToggle={() => {}} />,
    )
    expect(details.open).toBe(false)
  })

  it('shows the sprint name in the summary header', () => {
    render(<SprintSection section={makeSection()} board={board} showAll expanded onToggle={() => {}} />)
    expect(screen.getByText('Sprint 42')).toBeInTheDocument()
  })

  it('invokes onToggle when the user clicks the summary of an expanded section', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<SprintSection section={makeSection()} board={board} showAll expanded onToggle={onToggle} />)

    await user.click(screen.getByText('Sprint 42'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('invokes onToggle when the user clicks the summary of a collapsed section', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<SprintSection section={makeSection()} board={board} showAll expanded={false} onToggle={onToggle} />)

    await user.click(screen.getByText('Sprint 42'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('renders the lane grid body when expanded', () => {
    render(
      <SprintSection section={makeSectionWithContent()} board={board} showAll expanded onToggle={() => {}} />,
    )
    // header still present
    expect(screen.getByText('Sprint 42')).toBeInTheDocument()
    // body is mounted: the sticky 'Story' column header + the card title
    expect(screen.getByText('Story')).toBeInTheDocument()
    expect(screen.getByText('Login flow')).toBeInTheDocument()
  })

  it('mounts the real grid (not the skeleton) once the expanded body settles', () => {
    // The deferred-mount transition commits synchronously in jsdom, so an
    // expanded render lands on the real grid; the skeleton is only the
    // first-frame stand-in. Assert the grid is present and the skeleton is gone.
    render(
      <SprintSection section={makeSectionWithContent()} board={board} showAll expanded onToggle={() => {}} />,
    )
    expect(screen.getByText('Login flow')).toBeInTheDocument()
    expect(screen.queryByTestId('section-skeleton')).not.toBeInTheDocument()
  })

  it('SectionSkeleton renders a cheap, inert placeholder sized to the columns', () => {
    render(<SectionSkeleton columns={board.columns} />)
    const skeleton = screen.getByTestId('section-skeleton')
    expect(skeleton).toBeInTheDocument()
    // Decorative: hidden from the accessibility tree.
    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    // Cheap stand-in: pulsing placeholder blocks, no cards/lanes.
    expect(skeleton.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('Login flow')).not.toBeInTheDocument()
  })

  it('renders only the header (no lane body) when collapsed', () => {
    render(
      <SprintSection section={makeSectionWithContent()} board={board} showAll expanded={false} onToggle={() => {}} />,
    )
    // header still present (name + counts)
    expect(screen.getByText('Sprint 42')).toBeInTheDocument()
    expect(screen.getByText('1 story')).toBeInTheDocument()
    // body is NOT in the DOM
    expect(screen.queryByText('Story')).not.toBeInTheDocument()
    expect(screen.queryByText('Login flow')).not.toBeInTheDocument()
  })
})
