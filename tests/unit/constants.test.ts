import { describe, expect, it } from 'vitest'
import {
  CATEGORY_COLORS,
  CATEGORY_PALETTE,
  DEFAULT_CATEGORY_COLOR,
  MONTH_NAMES,
  MONTH_OPTIONS,
  categoryColorVar
} from '~/constants'

describe('MONTH_NAMES', () => {
  it('lists the twelve months in Date.getMonth() order', () => {
    expect(MONTH_NAMES).toHaveLength(12)
    expect(MONTH_NAMES[0]).toBe('January')
    expect(MONTH_NAMES[new Date(2026, 11, 1).getMonth()]).toBe('December')
  })
})

describe('MONTH_OPTIONS', () => {
  it('uses the 0-based month index as a string value', () => {
    expect(MONTH_OPTIONS).toHaveLength(12)
    expect(MONTH_OPTIONS[0]).toEqual({ value: '0', label: 'January' })
    expect(MONTH_OPTIONS[11]).toEqual({ value: '11', label: 'December' })
  })
})

describe('category palette', () => {
  it('exposes every palette colour, in order, for the picker', () => {
    expect(CATEGORY_COLORS).toEqual(Object.values(CATEGORY_PALETTE))
  })

  it('falls back to blue', () => {
    expect(DEFAULT_CATEGORY_COLOR).toBe(CATEGORY_PALETTE.blue)
  })
})

describe('categoryColorVar', () => {
  it('maps every palette colour to its theme token', () => {
    for (const [key, color] of Object.entries(CATEGORY_PALETTE)) {
      expect(categoryColorVar(color)).toBe(`var(--category-${key})`)
    }
  })

  it('matches palette colours regardless of case', () => {
    expect(categoryColorVar(CATEGORY_PALETTE.red.toLowerCase())).toBe('var(--category-red)')
  })

  it('returns colours outside the palette unchanged', () => {
    expect(categoryColorVar('#123456')).toBe('#123456')
  })

  it('tolerates documents without a colour', () => {
    expect(categoryColorVar('')).toBe('')
    expect(categoryColorVar(undefined as unknown as string)).toBeUndefined()
  })
})
