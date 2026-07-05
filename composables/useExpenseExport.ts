import { ref } from 'vue'
import type { Expense } from '~/types'
import { getExpenseDate } from '~/composables/useExpenseFilters'

export interface CategoryTotal {
  categoryId: string
  name: string
  color: string
  total: number
  percentage: number
}

export interface ExpenseExportOptions {
  categoryTotals: CategoryTotal[]
  expenses: Expense[]
  grandTotal: number
  periodLabel: string
}

// Shared palette so both sheets read as one document.
const HEADER_FILL = 'FF1F2937' // gray-800
const HEADER_FONT = 'FFFFFFFF'
const STRIPE_FILL = 'FFF3F4F6' // gray-100
const TOTAL_FILL = 'FFE5E7EB' // gray-200
const BORDER_COLOR = 'FFD1D5DB' // gray-300
const CURRENCY_FMT = '"$"#,##0.00'

// Convert a CSS hex colour (#rgb / #rrggbb) to ExcelJS ARGB. Falls back to grey.
const toArgb = (hex: string): string => {
  let c = (hex || '').replace('#', '').trim()
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('')
  if (c.length !== 6 || /[^0-9a-fA-F]/.test(c)) return 'FF9CA3AF'
  return `FF${c.toUpperCase()}`
}

// Normalise a CSS hex colour to #RRGGBB (used for the inline SVG).
const toHex = (hex: string): string => `#${toArgb(hex).slice(2)}`

// Pick black or white text for readability against a filled cell.
const readableText = (hex: string): string => {
  const argb = toArgb(hex).slice(2)
  const r = parseInt(argb.slice(0, 2), 16)
  const g = parseInt(argb.slice(2, 4), 16)
  const b = parseInt(argb.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? 'FF111827' : 'FFFFFFFF'
}

const solidFill = (argb: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb }
})

const thinBorder = () => ({
  top: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  left: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  right: { style: 'thin' as const, color: { argb: BORDER_COLOR } }
})

// Build a standalone donut SVG (no external deps/fonts) that mirrors the app chart.
const buildDonutSvg = (cats: CategoryTotal[], grandTotal: number, size = 260): string => {
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.4
  const innerR = size * 0.26
  const labelR = (outerR + innerR) / 2

  const polar = (radius: number, angleDeg: number) => {
    const a = (angleDeg - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
  }

  const sector = (start: number, end: number) => {
    const so = polar(outerR, end)
    const eo = polar(outerR, start)
    const si = polar(innerR, end)
    const ei = polar(innerR, start)
    const large = end - start <= 180 ? '0' : '1'
    return [
      'M', so.x, so.y,
      'A', outerR, outerR, 0, large, 0, eo.x, eo.y,
      'L', ei.x, ei.y,
      'A', innerR, innerR, 0, large, 1, si.x, si.y,
      'Z'
    ].join(' ')
  }

  let cursor = 0
  const parts: string[] = []
  for (const cat of cats) {
    const start = (cursor / 100) * 360
    cursor += cat.percentage
    const end = Math.min((cursor / 100) * 360, 359.999)
    parts.push(`<path d="${sector(start, end)}" fill="${toHex(cat.color)}" stroke="#ffffff" stroke-width="1.5"/>`)
    if (cat.percentage >= 5) {
      const mid = polar(labelR, (start + end) / 2)
      parts.push(
        `<text x="${mid.x.toFixed(1)}" y="${mid.y.toFixed(1)}" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="700" text-anchor="middle" dominant-baseline="central">${Math.round(cat.percentage)}%</text>`
      )
    }
  }

  const totalText = `-$${grandTotal.toFixed(2)}`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="#ffffff"/>`,
    parts.join(''),
    `<text x="${cx}" y="${cy - 6}" fill="#111827" font-family="Arial, sans-serif" font-size="16" font-weight="700" text-anchor="middle" dominant-baseline="central">${totalText}</text>`,
    `<text x="${cx}" y="${cy + 14}" fill="#6b7280" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" dominant-baseline="central">Total spent</text>`,
    '</svg>'
  ].join('')
}

// Rasterise the SVG to a PNG data URL via canvas (browser only).
const svgToPngDataUrl = (svg: string, size: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      try {
        const scale = 2
        const canvas = document.createElement('canvas')
        canvas.width = size * scale
        canvas.height = size * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('2d context unavailable')
        ctx.scale(scale, scale)
        ctx.drawImage(img, 0, 0, size, size)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to rasterise donut SVG'))
    }
    img.src = url
  })

const monthName = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const sanitiseFileName = (label: string) =>
  label.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export'

export const useExpenseExport = () => {
  const exporting = ref(false)

  const exportToExcel = async ({ categoryTotals, expenses, grandTotal, periodLabel }: ExpenseExportOptions) => {
    if (exporting.value) return
    exporting.value = true

    try {
      const ExcelJSModule = await import('exceljs')
      const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Spendy'
      workbook.created = new Date()

      // ── Sheet 1: Spending by category (mirrors the donut) ───────────────
      const summary = workbook.addWorksheet('Summary', {
        views: [{ state: 'frozen', ySplit: 4 }]
      })
      summary.columns = [
        { width: 26 },
        { width: 16 },
        { width: 12 }
      ]

      summary.mergeCells('A1:C1')
      const titleCell = summary.getCell('A1')
      titleCell.value = 'Spending by Category'
      titleCell.font = { bold: true, size: 16, color: { argb: 'FF111827' } }

      summary.mergeCells('A2:C2')
      const subtitleCell = summary.getCell('A2')
      subtitleCell.value = periodLabel
      subtitleCell.font = { italic: true, size: 11, color: { argb: 'FF6B7280' } }

      // Header row (row 4).
      const summaryHeader = summary.getRow(4)
      summaryHeader.values = ['Category', 'Amount', 'Share']
      summaryHeader.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: HEADER_FONT } }
        cell.fill = solidFill(HEADER_FILL)
        cell.alignment = { vertical: 'middle' }
        cell.border = thinBorder()
      })
      summary.getCell('B4').alignment = { horizontal: 'right', vertical: 'middle' }
      summary.getCell('C4').alignment = { horizontal: 'right', vertical: 'middle' }

      const firstDataRow = 5
      categoryTotals.forEach((cat, index) => {
        const row = summary.getRow(firstDataRow + index)
        row.getCell(1).value = cat.name
        row.getCell(2).value = cat.total
        row.getCell(3).value = grandTotal > 0 ? cat.total / grandTotal : 0

        // Category cell carries its donut colour.
        row.getCell(1).fill = solidFill(toArgb(cat.color))
        row.getCell(1).font = { bold: true, color: { argb: readableText(cat.color) } }

        // Amount / share get alternating stripes for legibility.
        const stripe = index % 2 === 1
        for (const col of [2, 3]) {
          if (stripe) row.getCell(col).fill = solidFill(STRIPE_FILL)
        }
        row.getCell(2).numFmt = CURRENCY_FMT
        row.getCell(2).alignment = { horizontal: 'right' }
        row.getCell(3).numFmt = '0.0%'
        row.getCell(3).alignment = { horizontal: 'right' }
        row.eachCell(cell => (cell.border = thinBorder()))
      })

      // Total row with a live SUM.
      const totalRowNum = firstDataRow + categoryTotals.length
      const totalRow = summary.getRow(totalRowNum)
      totalRow.getCell(1).value = 'Total'
      totalRow.getCell(2).value = { formula: `SUM(B${firstDataRow}:B${totalRowNum - 1})` }
      totalRow.getCell(3).value = 1
      totalRow.getCell(2).numFmt = CURRENCY_FMT
      totalRow.getCell(3).numFmt = '0.0%'
      totalRow.eachCell((cell, col) => {
        cell.font = { bold: true }
        cell.fill = solidFill(TOTAL_FILL)
        cell.border = thinBorder()
        if (col > 1) cell.alignment = { horizontal: 'right' }
      })

      // Optional: embed a rendered donut next to the table.
      try {
        const svg = buildDonutSvg(categoryTotals, grandTotal, 260)
        const dataUrl = await svgToPngDataUrl(svg, 260)
        const imageId = workbook.addImage({ base64: dataUrl, extension: 'png' })
        summary.addImage(imageId, {
          tl: { col: 4.2, row: 3.2 },
          ext: { width: 260, height: 260 }
        })
      } catch {
        // Chart is a nice-to-have; ignore if rasterisation isn't available.
      }

      // ── Sheet 2: All expenses (sortable + filterable) ───────────────────
      const sheet = workbook.addWorksheet('Expenses', {
        views: [{ state: 'frozen', ySplit: 1 }]
      })
      sheet.columns = [
        { header: 'Date', key: 'date', width: 16 },
        { header: 'Description', key: 'description', width: 36 },
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Amount', key: 'amount', width: 16 }
      ]

      const headerRow = sheet.getRow(1)
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: HEADER_FONT } }
        cell.fill = solidFill(HEADER_FILL)
        cell.alignment = { vertical: 'middle' }
        cell.border = thinBorder()
      })
      sheet.getCell('D1').alignment = { horizontal: 'right', vertical: 'middle' }

      // Default order: oldest first.
      const ordered = [...expenses].sort(
        (a, b) => getExpenseDate(a.createdAt).getTime() - getExpenseDate(b.createdAt).getTime()
      )

      ordered.forEach((expense, index) => {
        const row = sheet.getRow(index + 2)
        row.getCell(1).value = getExpenseDate(expense.createdAt)
        row.getCell(1).numFmt = 'yyyy-mm-dd'
        row.getCell(2).value = expense.description
        row.getCell(3).value = expense.categoryName
        row.getCell(4).value = expense.amount
        row.getCell(4).numFmt = CURRENCY_FMT
        row.getCell(4).alignment = { horizontal: 'right' }

        // Category cell keeps its colour so rows are scannable.
        row.getCell(3).fill = solidFill(toArgb(expense.categoryColor))
        row.getCell(3).font = { color: { argb: readableText(expense.categoryColor) } }

        const stripe = index % 2 === 1
        for (const col of [1, 2, 4]) {
          if (stripe) row.getCell(col).fill = solidFill(STRIPE_FILL)
        }
        row.eachCell(cell => (cell.border = thinBorder()))
      })

      const lastDataRow = ordered.length + 1

      // Sortable / filterable header dropdowns over the data range.
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(lastDataRow, 1), column: 4 }
      }

      // Total row uses SUBTOTAL so it respects any active filter.
      const expensesTotalRow = sheet.getRow(lastDataRow + 1)
      expensesTotalRow.getCell(3).value = 'Total'
      expensesTotalRow.getCell(4).value = {
        formula: ordered.length ? `SUBTOTAL(9,D2:D${lastDataRow})` : '0'
      }
      expensesTotalRow.getCell(4).numFmt = CURRENCY_FMT
      expensesTotalRow.getCell(3).alignment = { horizontal: 'right' }
      expensesTotalRow.getCell(4).alignment = { horizontal: 'right' }
      for (const col of [3, 4]) {
        const cell = expensesTotalRow.getCell(col)
        cell.font = { bold: true }
        cell.fill = solidFill(TOTAL_FILL)
        cell.border = thinBorder()
      }

      // ── Download ────────────────────────────────────────────────────────
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `spendy-${sanitiseFileName(periodLabel)}-${monthName(new Date()).replace(/[, ]+/g, '-').toLowerCase()}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportToExcel }
}
