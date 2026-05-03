// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { cn } from '../../../src/utils/cn'

describe('cn utility', () => {
  it('returns an empty string with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('returns a single class name unchanged', () => {
    expect(cn('flex')).toBe('flex')
  })

  it('joins multiple class names with a space', () => {
    expect(cn('flex', 'items-center', 'gap-4')).toBe('flex items-center gap-4')
  })

  it('ignores falsy values (false, null, undefined)', () => {
    expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz')
  })

  it('resolves Tailwind conflicts — last class wins', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles object syntax: includes keys with truthy values', () => {
    expect(cn({ 'text-green-500': true, 'text-red-500': false })).toBe('text-green-500')
  })

  it('handles array syntax', () => {
    expect(cn(['flex', 'gap-2'])).toBe('flex gap-2')
  })

  it('merges Tailwind padding utilities correctly', () => {
    expect(cn('px-4 py-2', 'px-6')).toBe('py-2 px-6')
  })

  it('combines conditional and static classes', () => {
    const isActive = true
    const result = cn('btn', isActive && 'btn-active', 'text-sm')
    expect(result).toBe('btn btn-active text-sm')
  })
})
