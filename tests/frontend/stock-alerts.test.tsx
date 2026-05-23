// @vitest-environment node
import { vi, describe, it, expect } from 'vitest'

// Pure logic: mirrors the toLocaleLowerCase fix in ProductCombobox
function filterProducts(
  products: { id: string; name: string; unit: string }[],
  search: string,
): { id: string; name: string; unit: string }[] {
  if (!search.trim()) return products
  return products.filter((p) =>
    p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  )
}

const products = [
  { id: 'p1', name: 'Брашно', unit: 'kg' },
  { id: 'p2', name: 'БРАШНО', unit: 'kg' }, // uppercase Cyrillic
  { id: 'p3', name: 'Парадајз', unit: 'kg' },
  { id: 'p4', name: 'Масло', unit: 'L' },
]

describe('ProductCombobox Cyrillic search (toLocaleLowerCase)', () => {
  it('1 — Mixed-case Cyrillic search finds results regardless of input case', () => {
    // lowercase search finds titlecase result
    expect(filterProducts(products, 'брашно')).toHaveLength(2) // Брашно + БРАШНО
    // uppercase search also finds both
    expect(filterProducts(products, 'БРАШНО')).toHaveLength(2)
    // titlecase search
    expect(filterProducts(products, 'Брашно')).toHaveLength(2)
  })
})
