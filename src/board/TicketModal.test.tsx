import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TicketModal } from './TicketModal'
import type { FieldMeta, StateCategory, WorkItem, WorkItemDetail } from '../api/types'
import type { WorkItemComment } from '../api/types'
import { useWorkItemDetail } from '../hooks/useWorkItemDetail'
import { useWorkItemComments } from '../hooks/useWorkItemComments'
import { useFieldMeta } from '../hooks/useFieldMeta'
import { StateCategoryContext } from '../theme/StateCategoryContext'

vi.mock('../hooks/useWorkItemDetail', () => ({
  useWorkItemDetail: vi.fn(),
}))
vi.mock('../hooks/useWorkItemComments', () => ({
  useWorkItemComments: vi.fn(),
}))
vi.mock('../hooks/useFieldMeta', () => ({
  useFieldMeta: vi.fn(),
}))

const mockedUseWorkItemDetail = vi.mocked(useWorkItemDetail)
const mockedUseWorkItemComments = vi.mocked(useWorkItemComments)
const mockedUseFieldMeta = vi.mocked(useFieldMeta)

const NO_COMMENTS = {
  comments: [] as WorkItemComment[],
  isLoading: false,
  error: null,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  isFetchingNextPage: false,
  totalCount: 0,
}

const META: Record<string, FieldMeta> = {
  'System.Description': { referenceName: 'System.Description', displayName: 'Description', type: 'html' },
  'Microsoft.VSTS.Common.AcceptanceCriteria': {
    referenceName: 'Microsoft.VSTS.Common.AcceptanceCriteria',
    displayName: 'Acceptance Criteria',
    type: 'html',
  },
  'Microsoft.VSTS.TCM.ReproSteps': {
    referenceName: 'Microsoft.VSTS.TCM.ReproSteps',
    displayName: 'Repro Steps',
    type: 'html',
  },
}

beforeEach(() => {
  // Default: field metadata already loaded (individual tests override).
  mockedUseFieldMeta.mockReturnValue({ meta: META, isLoading: false })
  // Default: no comments (comments-specific tests override this).
  mockedUseWorkItemComments.mockReturnValue(NO_COMMENTS)
})

function renderModal(
  props: { item: WorkItem | null; onClose: () => void },
  stateCategory: Record<string, StateCategory> = {},
) {
  return render(
    <StateCategoryContext.Provider value={stateCategory}>
      <TicketModal {...props} />
    </StateCategoryContext.Provider>,
  )
}

const item: WorkItem = {
  id: 819099,
  rev: 1,
  type: 'Task',
  title: 'Copilot ask endpoint',
  state: 'Active',
  boardColumn: 'In Development',
  assignedTo: { displayName: 'Jane Doe', uniqueName: 'jane@example.com' },
  tags: ['agentic'],
  parent: 807119,
  iterationPath: 'ProjectX\\Sprint 4',
}

describe('TicketModal', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when item is null', () => {
    mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
    const { container } = render(<TicketModal item={null} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders Tier-1 fields instantly from the given item while details are loading', () => {
    mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: true, error: null })
    render(<TicketModal item={item} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', expect.stringContaining('819099'))

    const link = screen.getByRole('link', { name: /819099/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('/_workitems/edit/819099'))
    expect(screen.getByText('Copilot ask endpoint')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Task')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('agentic')).toBeInTheDocument()
    expect(screen.getByText('Parent #807119')).toBeInTheDocument()
    expect(screen.getByText('Sprint 4')).toBeInTheDocument()

    expect(screen.getByRole('status', { name: 'Loading details…' })).toBeInTheDocument()
  })

  it('renders the sanitized description once loaded, stripping a <script> tag', () => {
    const detail: WorkItemDetail = {
      id: 819099,
      fields: { 'System.Description': '<p>Safe text</p><script>alert(1)</script>' },
      relations: [],
    }
    mockedUseWorkItemDetail.mockReturnValue({ detail, isLoading: false, error: null })
    render(<TicketModal item={item} onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Description' })).toBeInTheDocument()
    expect(screen.getByText('Safe text')).toBeInTheDocument()
    expect(document.querySelector('script')).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('alert(1)')
  })

  it('renders a Bug shape dynamically — Repro Steps under its display name, no phantom Description/AC', () => {
    const detail: WorkItemDetail = {
      id: 819099,
      fields: { 'Microsoft.VSTS.TCM.ReproSteps': '<p>1. do the thing</p>' },
      relations: [],
    }
    mockedUseWorkItemDetail.mockReturnValue({ detail, isLoading: false, error: null })
    render(<TicketModal item={item} onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Repro Steps' })).toBeInTheDocument()
    expect(screen.getByText('1. do the thing')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Description' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Acceptance Criteria' })).not.toBeInTheDocument()
    expect(screen.queryByText(/No details/i)).not.toBeInTheDocument()
  })

  it('skips a blank rich-text field and shows "No details" when nothing is populated', () => {
    const detail: WorkItemDetail = {
      id: 819099,
      fields: { 'System.Description': '<div><br></div>' },
      relations: [],
    }
    mockedUseWorkItemDetail.mockReturnValue({ detail, isLoading: false, error: null })
    render(<TicketModal item={item} onClose={vi.fn()} />)

    expect(screen.queryByRole('heading', { name: 'Description' })).not.toBeInTheDocument()
    expect(screen.getByText(/No details/i)).toBeInTheDocument()
  })

  it('shows the loading skeleton while field metadata is still loading', () => {
    mockedUseFieldMeta.mockReturnValue({ meta: {}, isLoading: true })
    mockedUseWorkItemDetail.mockReturnValue({
      detail: { id: 819099, fields: { 'System.Description': '<p>x</p>' }, relations: [] },
      isLoading: false,
      error: null,
    })
    render(<TicketModal item={item} onClose={vi.fn()} />)
    expect(screen.getByRole('status', { name: 'Loading details…' })).toBeInTheDocument()
  })

  it('shows relations with resolved ids as links', () => {
    const detail: WorkItemDetail = {
      id: 819099,
      fields: {},
      relations: [{ rel: 'System.LinkTypes.Hierarchy-Reverse', id: 807119, url: 'https://x/807119' }],
    }
    mockedUseWorkItemDetail.mockReturnValue({ detail, isLoading: false, error: null })
    render(<TicketModal item={item} onClose={vi.fn()} />)

    // Humanized label, not the raw `System.LinkTypes.Hierarchy-Reverse` string.
    expect(screen.getByText('Parent')).toBeInTheDocument()
    expect(screen.queryByText(/System\.LinkTypes/)).not.toBeInTheDocument()

    const relationLink = screen.getByRole('link', { name: '#807119' })
    expect(relationLink).toHaveAttribute('href', expect.stringContaining('/_workitems/edit/807119'))
  })

  it('shows a couldn\'t-load note on error, while Tier 1 still renders', () => {
    mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: new Error('boom') })
    render(<TicketModal item={item} onClose={vi.fn()} />)
    expect(screen.getByText("Couldn't load details.")).toBeInTheDocument()
    expect(screen.getByText('Copilot ask endpoint')).toBeInTheDocument()
  })

  it('calls onClose on Escape', () => {
    mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
    const onClose = vi.fn()
    render(<TicketModal item={item} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on backdrop click but not on a click inside the dialog', () => {
    mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
    const onClose = vi.fn()
    render(<TicketModal item={item} onClose={onClose} />)

    fireEvent.click(screen.getByText('Copilot ask endpoint'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('ticket-modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is clicked', () => {
    mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
    const onClose = vi.fn()
    render(<TicketModal item={item} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('colors the state pill and dialog accent from the live state-category map', () => {
    mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
    renderModal({ item, onClose: vi.fn() }, { Active: 'InProgress' })

    expect(screen.getByText('Active')).toHaveClass('bg-state-inprogress/15')
    expect(screen.getByRole('dialog')).toHaveClass('border-t-state-inprogress')
  })

  it('falls back to the gray pill and accent for a state absent from the category map', () => {
    mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
    renderModal({ item: { ...item, state: 'SomeCustomState' }, onClose: vi.fn() }, {})

    expect(screen.getByText('SomeCustomState')).toHaveClass('bg-content-subtle/15')
    expect(screen.getByRole('dialog')).toHaveClass('border-t-content-subtle')
  })

  describe('Comments section', () => {
    it('renders comments with author and sanitized body, stripping a <script> tag', () => {
      mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
      mockedUseWorkItemComments.mockReturnValue({
        ...NO_COMMENTS,
        comments: [
          {
            id: 1,
            text: '<div>Looks good — merging.</div><script>alert(1)</script>',
            createdBy: { displayName: 'Jane Doe', uniqueName: 'jane@example.com' },
            createdDate: '2025-07-01T09:00:00Z',
          },
        ],
        totalCount: 1,
      })
      render(<TicketModal item={item} onClose={vi.fn()} />)

      expect(screen.getByRole('heading', { name: 'Comments' })).toBeInTheDocument()
      // Author appears in both the assignee chip and the comment; scope to the comments list.
      const section = screen.getByTestId('ticket-comments')
      expect(within(section).getByText('Jane Doe')).toBeInTheDocument()
      expect(screen.getByText('Looks good — merging.')).toBeInTheDocument()
      expect(document.querySelector('script')).not.toBeInTheDocument()
      expect(document.body.innerHTML).not.toContain('alert(1)')
    })

    it('shows the empty state when there are no comments', () => {
      mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
      mockedUseWorkItemComments.mockReturnValue(NO_COMMENTS)
      render(<TicketModal item={item} onClose={vi.fn()} />)
      expect(screen.getByText('No comments.')).toBeInTheDocument()
    })

    it('shows the loading skeleton while comments are loading', () => {
      mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
      mockedUseWorkItemComments.mockReturnValue({ ...NO_COMMENTS, isLoading: true })
      render(<TicketModal item={item} onClose={vi.fn()} />)
      expect(screen.getByRole('status', { name: 'Loading comments…' })).toBeInTheDocument()
    })

    it("shows a couldn't-load note when comments error", () => {
      mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
      mockedUseWorkItemComments.mockReturnValue({ ...NO_COMMENTS, error: new Error('boom') })
      render(<TicketModal item={item} onClose={vi.fn()} />)
      expect(screen.getByText("Couldn't load comments.")).toBeInTheDocument()
    })

    it('shows "Load more comments" when hasNextPage and calls fetchNextPage on click', () => {
      const fetchNextPage = vi.fn()
      mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
      mockedUseWorkItemComments.mockReturnValue({
        ...NO_COMMENTS,
        comments: [
          {
            id: 1,
            text: '<div>First</div>',
            createdBy: { displayName: 'Jane Doe', uniqueName: 'jane@example.com' },
            createdDate: '2025-07-01T09:00:00Z',
          },
        ],
        hasNextPage: true,
        fetchNextPage,
        totalCount: 4,
      })
      render(<TicketModal item={item} onClose={vi.fn()} />)

      const button = screen.getByRole('button', { name: 'Load more comments' })
      fireEvent.click(button)
      expect(fetchNextPage).toHaveBeenCalledTimes(1)
    })

    it('disables the button and shows a loading label while fetching the next page', () => {
      mockedUseWorkItemDetail.mockReturnValue({ detail: undefined, isLoading: false, error: null })
      mockedUseWorkItemComments.mockReturnValue({
        ...NO_COMMENTS,
        comments: [
          {
            id: 1,
            text: '<div>First</div>',
            createdBy: { displayName: 'Jane Doe', uniqueName: 'jane@example.com' },
            createdDate: '2025-07-01T09:00:00Z',
          },
        ],
        hasNextPage: true,
        isFetchingNextPage: true,
        totalCount: 4,
      })
      render(<TicketModal item={item} onClose={vi.fn()} />)

      const button = screen.getByRole('button', { name: 'Loading…' })
      expect(button).toBeDisabled()
    })
  })
})
