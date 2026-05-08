import { describe, it, expect } from 'vitest'
import { generateTempPassword } from '../../src/utils/passwordGenerator'

const AMBIGUOUS = new Set(['0', 'O', '1', 'l', 'I'])

describe('generateTempPassword', () => {
  it('returns a string of exactly 16 characters', () => {
    expect(generateTempPassword()).toHaveLength(16)
  })

  it('100 generated passwords are all unique (entropy check)', () => {
    const passwords = new Set(Array.from({ length: 100 }, generateTempPassword))
    expect(passwords.size).toBe(100)
  })

  it('contains no ambiguous characters (0, O, 1, l, I)', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword()
      for (const ch of pw) {
        expect(AMBIGUOUS.has(ch), `found ambiguous char '${ch}' in "${pw}"`).toBe(false)
      }
    }
  })

  it('different calls return different values', () => {
    const a = generateTempPassword()
    const b = generateTempPassword()
    expect(a).not.toBe(b)
  })
})
