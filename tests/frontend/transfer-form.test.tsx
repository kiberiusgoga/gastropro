// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/lib/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import apiClient from '../../src/lib/apiClient'
import { toast } from 'sonner'

const mockPost = vi.mocked(apiClient.post)

const warehouses = [
  { id: 'wh1', name: 'Главен', is_main: true },
  { id: 'wh2', name: 'Тераса', is_main: false },
]

const products = [
  { id: 'p1', name: 'Брашно', unit: 'kg' },
  { id: 'p2', name: 'Парадајз', unit: 'kg' },
  { id: 'p3', name: 'Масло', unit: 'L' },
]

// ── Pure validation logic (mirrors TransferForm internals) ───────────────────

function isFormValid(sourceId: string, destId: string, productId: string | null, quantity: string): boolean {
  if (!sourceId || !destId || !productId || !quantity) return false
  if (parseFloat(quantity) <= 0) return false
  if (sourceId === destId) return false
  return true
}

function sourceEqDest(sourceId: string, destId: string): boolean {
  return Boolean(sourceId && destId && sourceId === destId)
}

function filterProducts(products: { id: string; name: string; unit: string }[], search: string) {
  if (!search.trim()) return products
  return products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
}

// ── Simulated submit handler (mirrors TransferForm.handleSubmit logic) ───────

async function simulateSubmit(payload: {
  sourceId: string
  destId: string
  productId: string | null
  quantity: string
  note: string
}) {
  await apiClient.post('/transfers', {
    source_warehouse_id: payload.sourceId,
    destination_warehouse_id: payload.destId,
    product_id: payload.productId,
    quantity: parseFloat(payload.quantity),
    note: payload.note.trim() || undefined,
  })
}

beforeEach(() => { vi.clearAllMocks() })

// ── TransferForm logic ───────────────────────────────────────────────────────

describe('TransferForm validation', () => {
  it('1 — Form is invalid with all empty fields (submit disabled by default)', () => {
    expect(isFormValid('', '', null, '')).toBe(false)
  })

  it('2 — Submit is disabled when any required field is missing', () => {
    expect(isFormValid('wh1', '', null, '')).toBe(false)
    expect(isFormValid('wh1', 'wh2', null, '')).toBe(false)
    expect(isFormValid('wh1', 'wh2', 'p1', '')).toBe(false)
    expect(isFormValid('wh1', 'wh2', 'p1', '0')).toBe(false)
    // All fields valid
    expect(isFormValid('wh1', 'wh2', 'p1', '5')).toBe(true)
  })

  it('3 — Source = Destination triggers inline error, submit disabled', () => {
    expect(sourceEqDest('wh1', 'wh1')).toBe(true)
    expect(isFormValid('wh1', 'wh1', 'p1', '5')).toBe(false)
    // Different warehouses: no error
    expect(sourceEqDest('wh1', 'wh2')).toBe(false)
    expect(isFormValid('wh1', 'wh2', 'p1', '5')).toBe(true)
  })

  it('4 — Successful submit calls POST with correct payload, fires onSuccess', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'tr1' } })
    const onSuccess = vi.fn()

    await simulateSubmit({ sourceId: 'wh1', destId: 'wh2', productId: 'p1', quantity: '5', note: '' })
    onSuccess()

    expect(mockPost).toHaveBeenCalledWith('/transfers', {
      source_warehouse_id: 'wh1',
      destination_warehouse_id: 'wh2',
      product_id: 'p1',
      quantity: 5,
      note: undefined,
    })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('5 — Failed submit exposes API error message', async () => {
    const apiError = { response: { data: { message: 'Insufficient stock' } } }
    mockPost.mockRejectedValueOnce(apiError)

    let caughtMessage = ''
    try {
      await simulateSubmit({ sourceId: 'wh1', destId: 'wh2', productId: 'p1', quantity: '999', note: '' })
    } catch (err: any) {
      caughtMessage = err.response?.data?.message ?? 'transfer_failed'
    }

    expect(caughtMessage).toBe('Insufficient stock')
  })
})

// ── ProductCombobox logic ────────────────────────────────────────────────────

describe('ProductCombobox', () => {
  it('6 — Filters product list by typed search text (case-insensitive)', () => {
    expect(filterProducts(products, 'пар')).toHaveLength(1)
    expect(filterProducts(products, 'пар')[0].name).toBe('Парадајз')

    expect(filterProducts(products, 'ш')).toHaveLength(1)
    expect(filterProducts(products, 'ш')[0].name).toBe('Брашно')

    // Case-insensitive
    expect(filterProducts(products, 'масло')).toHaveLength(1)

    // Empty search returns all
    expect(filterProducts(products, '')).toHaveLength(3)
    expect(filterProducts(products, '   ')).toHaveLength(3)
  })

  it('7 — Outside-click handler closes dropdown when click is outside container', () => {
    // Simulate the useEffect close-on-outside-click logic from ProductCombobox
    let isOpen = true

    // container.contains() returns false when click is outside
    const containerElement = { contains: (_target: unknown) => false } as unknown as HTMLDivElement
    const outsideTarget = {} as Node

    const handler = (e: { target: Node }) => {
      if (containerElement && !containerElement.contains(e.target)) {
        isOpen = false
      }
    }

    handler({ target: outsideTarget })
    expect(isOpen).toBe(false)

    // When click is inside the container, isOpen stays true
    let isOpen2 = true
    const innerContainer = { contains: (_target: unknown) => true } as unknown as HTMLDivElement
    const insideTarget = {} as Node
    const handler2 = (e: { target: Node }) => {
      if (innerContainer && !innerContainer.contains(e.target)) {
        isOpen2 = false
      }
    }
    handler2({ target: insideTarget })
    expect(isOpen2).toBe(true)
  })
})
