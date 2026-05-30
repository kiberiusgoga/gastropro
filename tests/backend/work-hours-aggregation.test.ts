import { describe, it, expect } from 'vitest'

// Pure unit tests for HR aggregation logic (no DB mocks needed)

function computeHours(clockIn: string, clockOut: string, breakMinutes: number): number {
  const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  const diffHours = diffMs / 3600000
  const net = diffHours - breakMinutes / 60
  return Math.max(0, Math.round(net * 100) / 100)
}

function computeWeeklyOvertime(totalHours: number, threshold: number): number {
  return Math.max(0, Math.round((totalHours - threshold) * 100) / 100)
}

function aggregateByWeek(entries: { hours_worked: number; week: string }[]) {
  const map = new Map<string, number>()
  for (const e of entries) {
    map.set(e.week, (map.get(e.week) ?? 0) + e.hours_worked)
  }
  return Object.fromEntries(map)
}

describe('Work Hours Aggregation — pure logic', () => {

  it('1 — computeHours: 8h shift minus 30min break = 7.5h', () => {
    const ci = '2026-05-29T08:00:00Z'
    const co = '2026-05-29T16:00:00Z'
    expect(computeHours(ci, co, 30)).toBe(7.5)
  })

  it('2 — overtime vs threshold: 45h total, threshold 40 → 5h overtime', () => {
    expect(computeWeeklyOvertime(45, 40)).toBe(5)
    expect(computeWeeklyOvertime(38, 40)).toBe(0)  // under threshold
    expect(computeWeeklyOvertime(40, 40)).toBe(0)  // exactly at threshold
    expect(computeWeeklyOvertime(40.5, 40)).toBe(0.5)
  })

  it('3 — weekly aggregation groups by week correctly', () => {
    const entries = [
      { hours_worked: 7.5, week: '2026-05-25' },
      { hours_worked: 8.0, week: '2026-05-25' },
      { hours_worked: 7.0, week: '2026-06-01' },
    ]
    const result = aggregateByWeek(entries)
    expect(result['2026-05-25']).toBe(15.5)
    expect(result['2026-06-01']).toBe(7.0)
  })

  it('4 — negative break guard: 1h shift, 90min break → 0h (not negative)', () => {
    const ci = '2026-05-29T09:00:00Z'
    const co = '2026-05-29T10:00:00Z'
    expect(computeHours(ci, co, 90)).toBe(0)
  })

  it('5 — computeHours rounding: 7.333... rounds to 7.33', () => {
    // 8h shift, 40min break = 7h 20min = 7.333... → 7.33
    const ci = '2026-05-29T08:00:00Z'
    const co = '2026-05-29T16:00:00Z'
    expect(computeHours(ci, co, 40)).toBe(7.33)
  })
})
