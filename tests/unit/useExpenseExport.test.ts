// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Workbook } from 'exceljs'
import type { Expense } from '~/types'
import { useExpenseExport, type CategoryTotal, type ExpenseExportOptions } from '~/composables/useExpenseExport'

// Real ExcelJS, but every workbook the export creates is kept for inspection.
const workbooks = vi.hoisted(() => [] as Workbook[])

vi.mock('exceljs', async (importOriginal) => {
  const mod = await importOriginal<{ default?: typeof import('exceljs') } & typeof import('exceljs')>()
  const ExcelJS = mod.default ?? mod

  class RecordingWorkbook extends ExcelJS.Workbook {
    constructor () {
      super()
      workbooks.push(this)
    }
  }

  return { default: { ...ExcelJS, Workbook: RecordingWorkbook } }
})

const NOW = new Date(2026, 4, 15, 12)
const DARK_TEXT = 'FF111827'
const LIGHT_TEXT = 'FFFFFFFF'
const FALLBACK_GREY = 'FF9CA3AF'

// The donut is rasterised through <img> + <canvas>, which happy-dom can't do.
// This stand-in fails to load by default; tests that want the chart flip it.
let imageLoads = false
class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src (_url: string) {
    queueMicrotask(() => (imageLoads ? this.onload?.() : this.onerror?.()))
  }
}

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const stubCanvas = (context: object | null = { scale: vi.fn(), drawImage: vi.fn() }) => {
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
    if (tag !== 'canvas') return createElement(tag, options)
    return {
      width: 0,
      height: 0,
      getContext: () => context,
      toDataURL: () => PNG_DATA_URL
    } as unknown as HTMLCanvasElement
  })
}

let downloads: string[]
let blobs: Blob[]

const category = (overrides: Partial<CategoryTotal> = {}): CategoryTotal => ({
  categoryId: 'food',
  name: 'Food',
  color: '#3B82F6',
  total: 30,
  percentage: 75,
  ...overrides
})

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  amount: 10,
  description: 'Coffee',
  categoryId: 'food',
  categoryName: 'Food',
  categoryColor: '#3B82F6',
  userId: 'u1',
  createdAt: new Date(2026, 4, 1),
  updatedAt: new Date(2026, 4, 1),
  ...overrides
})

const options = (overrides: Partial<ExpenseExportOptions> = {}): ExpenseExportOptions => ({
  categoryTotals: [
    category(),
    category({ categoryId: 'fun', name: 'Fun', color: '#F59E0B', total: 10, percentage: 25 })
  ],
  expenses: [
    expense({ id: 'late', description: 'Late', createdAt: new Date(2026, 4, 9), amount: 30 }),
    expense({ id: 'early', description: 'Early', createdAt: new Date(2026, 4, 2), amount: 10, categoryName: 'Fun', categoryColor: '#F59E0B' })
  ],
  grandTotal: 40,
  periodLabel: 'May 2026',
  ...overrides
})

const exportWorkbook = async (overrides: Partial<ExpenseExportOptions> = {}) => {
  await useExpenseExport().exportToExcel(options(overrides))
  expect(workbooks).toHaveLength(1)
  return workbooks[0]!
}

const fillOf = (cell: { fill?: unknown }) => (cell.fill as { fgColor?: { argb?: string } } | undefined)?.fgColor?.argb

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)

  workbooks.length = 0
  downloads = []
  blobs = []
  imageLoads = false

  vi.stubGlobal('Image', FakeImage)
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob as Blob)
    return `blob:${blobs.length}`
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useExpenseExport', () => {
  describe('Summary sheet', () => {
    it('titles the sheet with the period', async () => {
      const summary = (await exportWorkbook()).getWorksheet('Summary')!

      expect(summary.getCell('A1').value).toBe('Spending by Category')
      expect(summary.getCell('A2').value).toBe('May 2026')
      expect(summary.getRow(4).values).toEqual([undefined, 'Category', 'Amount', 'Share'])
    })

    it('writes one row per category with its amount and share', async () => {
      const summary = (await exportWorkbook()).getWorksheet('Summary')!

      expect(summary.getRow(5).values).toEqual([undefined, 'Food', 30, 0.75])
      expect(summary.getRow(6).values).toEqual([undefined, 'Fun', 10, 0.25])
    })

    it('colours each category cell with readable text', async () => {
      const summary = (await exportWorkbook()).getWorksheet('Summary')!

      // Blue is dark enough for white text, amber needs dark text.
      expect(fillOf(summary.getCell('A5'))).toBe('FF3B82F6')
      expect(summary.getCell('A5').font?.color?.argb).toBe(LIGHT_TEXT)
      expect(fillOf(summary.getCell('A6'))).toBe('FFF59E0B')
      expect(summary.getCell('A6').font?.color?.argb).toBe(DARK_TEXT)
    })

    it('expands short hex colours and falls back to grey for invalid ones', async () => {
      const summary = (await exportWorkbook({
        categoryTotals: [
          category({ color: '#fff' }),
          category({ categoryId: 'bad', color: 'not-a-colour' }),
          category({ categoryId: 'none', color: '' })
        ]
      })).getWorksheet('Summary')!

      expect(fillOf(summary.getCell('A5'))).toBe('FFFFFFFF')
      expect(summary.getCell('A5').font?.color?.argb).toBe(DARK_TEXT)
      expect(fillOf(summary.getCell('A6'))).toBe(FALLBACK_GREY)
      expect(fillOf(summary.getCell('A7'))).toBe(FALLBACK_GREY)
    })

    it('adds a total row that sums the categories', async () => {
      const summary = (await exportWorkbook()).getWorksheet('Summary')!

      expect(summary.getCell('A7').value).toBe('Total')
      expect(summary.getCell('B7').value).toEqual({ formula: 'SUM(B5:B6)' })
      expect(summary.getCell('C7').value).toBe(1)
    })

    it('shows a zero share when nothing was spent', async () => {
      const summary = (await exportWorkbook({
        categoryTotals: [category({ total: 0, percentage: 0 })],
        grandTotal: 0
      })).getWorksheet('Summary')!

      expect(summary.getCell('C5').value).toBe(0)
    })
  })

  describe('Expenses sheet', () => {
    it('lists the expenses oldest first', async () => {
      const sheet = (await exportWorkbook()).getWorksheet('Expenses')!

      expect(sheet.getRow(1).values).toEqual([undefined, 'Date', 'Description', 'Category', 'Amount'])
      expect(sheet.getRow(2).values).toEqual([undefined, new Date(2026, 4, 2), 'Early', 'Fun', 10])
      expect(sheet.getRow(3).values).toEqual([undefined, new Date(2026, 4, 9), 'Late', 'Food', 30])
    })

    it('reads Firestore timestamps', async () => {
      const date = new Date(2026, 4, 4)
      const sheet = (await exportWorkbook({
        expenses: [expense({ createdAt: { seconds: date.getTime() / 1000 } as unknown as Date })]
      })).getWorksheet('Expenses')!

      expect(sheet.getCell('A2').value).toEqual(date)
    })

    it('colours the category cell', async () => {
      const sheet = (await exportWorkbook()).getWorksheet('Expenses')!

      expect(fillOf(sheet.getCell('C2'))).toBe('FFF59E0B')
      expect(sheet.getCell('C2').font?.color?.argb).toBe(DARK_TEXT)
    })

    it('adds a filter over the data and a filter-aware total', async () => {
      const sheet = (await exportWorkbook()).getWorksheet('Expenses')!

      expect(sheet.autoFilter).toEqual({ from: { row: 1, column: 1 }, to: { row: 3, column: 4 } })
      expect(sheet.getCell('C4').value).toBe('Total')
      expect(sheet.getCell('D4').value).toEqual({ formula: 'SUBTOTAL(9,D2:D3)' })
    })

    it('totals zero when there are no expenses', async () => {
      const sheet = (await exportWorkbook({ expenses: [] })).getWorksheet('Expenses')!

      expect(sheet.autoFilter).toEqual({ from: { row: 1, column: 1 }, to: { row: 1, column: 4 } })
      expect(sheet.getCell('D2').value).toEqual({ formula: '0' })
    })
  })

  describe('download', () => {
    it('downloads an .xlsx named after the period and today', async () => {
      await exportWorkbook()

      expect(downloads).toEqual(['spendy-may-2026-may-15-2026.xlsx'])
      const file = blobs.at(-1)!
      expect(file.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(file.size).toBeGreaterThan(0)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(`blob:${blobs.length}`)
    })

    it('makes the period safe for a file name', async () => {
      await exportWorkbook({ periodLabel: '  All months / All years!' })
      expect(downloads).toEqual(['spendy-all-months-all-years-may-15-2026.xlsx'])
    })

    it('falls back to "export" when the period has no usable characters', async () => {
      await exportWorkbook({ periodLabel: '***' })
      expect(downloads).toEqual(['spendy-export-may-15-2026.xlsx'])
    })
  })

  describe('donut chart', () => {
    it('embeds the rendered chart when the browser can rasterise it', async () => {
      imageLoads = true
      stubCanvas()

      const summary = (await exportWorkbook()).getWorksheet('Summary')!

      expect(summary.getImages()).toHaveLength(1)
    })

    it('draws a slice per category with the total in the middle', async () => {
      imageLoads = true
      stubCanvas()

      await exportWorkbook({
        categoryTotals: [
          category({ color: '#3b82f6', percentage: 96 }),
          category({ categoryId: 'tiny', color: '#EF4444', total: 1, percentage: 4 })
        ],
        grandTotal: 25
      })

      const svg = await blobs[0]!.text()
      expect(blobs[0]!.type).toContain('image/svg+xml')
      expect(svg).toContain('fill="#3B82F6"')
      expect(svg).toContain('fill="#EF4444"')
      expect(svg).toContain('-$25.00')
      // Labels are left off slices under 5% to avoid clutter.
      expect(svg).toContain('>96%</text>')
      expect(svg).not.toContain('>4%</text>')
    })

    it('still exports without the chart when the image fails to load', async () => {
      const summary = (await exportWorkbook()).getWorksheet('Summary')!

      expect(summary.getImages()).toHaveLength(0)
      expect(downloads).toHaveLength(1)
    })

    it('still exports without the chart when there is no canvas context', async () => {
      imageLoads = true
      stubCanvas(null)

      const summary = (await exportWorkbook()).getWorksheet('Summary')!

      expect(summary.getImages()).toHaveLength(0)
      expect(downloads).toHaveLength(1)
    })
  })

  describe('exporting state', () => {
    it('is set while the export runs and cleared after', async () => {
      const { exporting, exportToExcel } = useExpenseExport()

      const running = exportToExcel(options())
      expect(exporting.value).toBe(true)

      await running
      expect(exporting.value).toBe(false)
    })

    it('ignores a second export while one is running', async () => {
      const { exportToExcel } = useExpenseExport()

      await Promise.all([exportToExcel(options()), exportToExcel(options())])

      expect(workbooks).toHaveLength(1)
      expect(downloads).toHaveLength(1)
    })

    it('is cleared when the export fails', async () => {
      vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => {
        throw new Error('download blocked')
      })
      const { exporting, exportToExcel } = useExpenseExport()

      await expect(exportToExcel(options())).rejects.toThrow('download blocked')
      expect(exporting.value).toBe(false)
    })
  })
})
