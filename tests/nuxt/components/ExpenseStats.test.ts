import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockComponent, mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { ref, type Ref } from 'vue'
import { where } from 'firebase/firestore'
import ExpenseStats from '~/components/ExpenseStats.vue'
import { createFirestoreMock, type FirestoreMock } from '../helpers/firestore'
import { findButton } from '../helpers/dom'

const mocks = vi.hoisted(() => ({
  firestore: undefined as unknown as FirestoreMock,
  user: undefined as unknown as Ref<{ uid: string } | null>,
  exporter: undefined as unknown as { exporting: Ref<boolean>, exportToExcel: ReturnType<typeof vi.fn> }
}))

mockNuxtImport('useAuth', () => () => ({ user: mocks.user }))
mockNuxtImport('useFirestore', () => () => mocks.firestore)
mockNuxtImport('useExpenseExport', () => () => mocks.exporter)
mockComponent('USelect', async () => (await import('../helpers/stubs')).SelectStub)

const NOW = new Date(2026, 4, 15, 12)

const expense = (id: string, categoryId: string, amount: number, createdAt = new Date(2026, 4, 3)) => ({
  id,
  amount,
  description: id,
  categoryId,
  categoryName: categoryId[0]!.toUpperCase() + categoryId.slice(1),
  categoryColor: { food: '#10B981', travel: '#EF4444', fun: '#8B5CF6' }[categoryId] ?? '#3B82F6',
  createdAt
})

// This month: travel 60, food 38, fun 2 (100 total). Last year: travel 40.
const EXPENSES = [
  expense('lunch', 'food', 30),
  expense('taxi', 'travel', 60),
  expense('snack', 'food', 8),
  expense('arcade', 'fun', 2),
  expense('flight', 'travel', 40, new Date(2025, 1, 1))
]

const mountStats = async (expenses = EXPENSES) => {
  const wrapper = await mountSuspended(ExpenseStats)
  mocks.firestore.emit('expenses', expenses)
  await wrapper.vm.$nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountStats>>

const legend = (wrapper: Wrapper) =>
  wrapper.findAll('.legend-item').map(item => [item.find('.legend-name').text(), item.find('.legend-value').text()])

const legendItem = (wrapper: Wrapper, name: string) =>
  wrapper.findAll('.legend-item').find(item => item.find('.legend-name').text() === name)!

const center = (wrapper: Wrapper) =>
  [wrapper.find('.center-primary').text(), wrapper.find('.center-secondary').text()]

const exportedOptions = () => mocks.exporter.exportToExcel.mock.calls[0]![0]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  mocks.firestore = createFirestoreMock()
  mocks.user = ref({ uid: 'u1' })
  mocks.exporter = { exporting: ref(false), exportToExcel: vi.fn() }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ExpenseStats', () => {
  it('shows a loader until the first snapshot arrives', async () => {
    const wrapper = await mountSuspended(ExpenseStats)

    expect(wrapper.find('.stats-content').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No expenses found')
    expect(mocks.firestore.subscribeToCollection).toHaveBeenCalledWith(
      'expenses',
      [where('userId', '==', 'u1')],
      expect.any(Function)
    )
  })

  it('says so when there is nothing to chart', async () => {
    const wrapper = await mountStats([])

    expect(wrapper.text()).toContain('No expenses found')
    expect(wrapper.text()).not.toContain('Export to Excel')
  })

  it('totals this month\'s spending by category, largest first', async () => {
    const wrapper = await mountStats()

    expect(legend(wrapper)).toEqual([
      ['Travel', '60.0% · -$60.00'],
      ['Food', '38.0% · -$38.00'],
      ['Fun', '2.0% · -$2.00']
    ])
    expect(wrapper.find('.stats-summary-total').text()).toBe('-$100.00')
    expect(center(wrapper)).toEqual(['-$100.00', 'Total spent'])
  })

  it('draws a slice per category and labels the ones big enough to read', async () => {
    const wrapper = await mountStats()

    const slices = wrapper.findAll('.slice')
    expect(slices).toHaveLength(3)
    expect(slices[0]!.find('path').attributes('style')).toContain('var(--category-red)')
    expect(slices.map(slice => slice.find('.slice-label').exists() ? slice.find('.slice-label').text() : null))
      .toEqual(['60%', '38%', null])
  })

  it('draws a single category as a full ring', async () => {
    const wrapper = await mountStats([expense('lunch', 'food', 30)])

    const path = wrapper.find('.slice path').attributes('d')!
    expect(path).toMatch(/^M /)
    // Large-arc flag set: the arc spans (almost) the whole circle.
    expect(path).toContain(' A 80 80 0 1 0 ')
  })

  describe('highlighting a category', () => {
    it('shows its share while hovered', async () => {
      const wrapper = await mountStats()

      await legendItem(wrapper, 'Food').trigger('mouseenter')
      expect(center(wrapper)).toEqual(['38%', 'Food'])
      expect(legendItem(wrapper, 'Food').classes()).toContain('legend-item-active')
      expect(wrapper.findAll('.slice')[1]!.classes()).toContain('slice-active')
      expect(wrapper.findAll('.slice')[0]!.classes()).toContain('slice-dim')

      await legendItem(wrapper, 'Food').trigger('mouseleave')
      expect(center(wrapper)).toEqual(['-$100.00', 'Total spent'])
    })

    it('links chart slices to the legend', async () => {
      const wrapper = await mountStats()

      await wrapper.findAll('.slice')[0]!.trigger('mouseenter')

      expect(legendItem(wrapper, 'Travel').classes()).toContain('legend-item-active')
    })

    it('pins a category on click and unpins it on a second click', async () => {
      const wrapper = await mountStats()

      await legendItem(wrapper, 'Fun').trigger('click')
      expect(center(wrapper)).toEqual(['2%', 'Fun'])

      await legendItem(wrapper, 'Travel').trigger('mouseenter')
      expect(center(wrapper)).toEqual(['60%', 'Travel'])
      await legendItem(wrapper, 'Travel').trigger('mouseleave')
      expect(center(wrapper)).toEqual(['2%', 'Fun'])

      await wrapper.findAll('.slice')[2]!.trigger('click')
      expect(center(wrapper)).toEqual(['-$100.00', 'Total spent'])
    })

    it('drops a pinned category that leaves the filter', async () => {
      const wrapper = await mountStats()
      await legendItem(wrapper, 'Fun').trigger('click')

      mocks.firestore.emit('expenses', EXPENSES.filter(e => e.categoryId !== 'fun'))
      await wrapper.vm.$nextTick()
      mocks.firestore.emit('expenses', EXPENSES)
      await wrapper.vm.$nextTick()

      expect(center(wrapper)).toEqual(['-$100.00', 'Total spent'])
    })
  })

  describe('filters', () => {
    it('charts every expense with all months and years', async () => {
      const wrapper = await mountStats()

      await wrapper.find('select[aria-label="Filter by month"]').setValue('all')
      await wrapper.find('select[aria-label="Filter by year"]').setValue('all')

      expect(legend(wrapper)[0]).toEqual(['Travel', '71.4% · -$100.00'])
      expect(wrapper.find('.stats-summary-total').text()).toBe('-$140.00')
    })

    it('offers each year that has expenses', async () => {
      const wrapper = await mountStats()

      const years = wrapper.find('select[aria-label="Filter by year"]').findAll('option').map(option => option.text())
      expect(years).toEqual(['', 'All years', 'Current year', '2026', '2025'])
    })
  })

  describe('export', () => {
    it('exports the charted figures for the current period', async () => {
      const wrapper = await mountStats()

      await findButton(wrapper, 'Export to Excel').trigger('click')

      expect(mocks.exporter.exportToExcel).toHaveBeenCalledTimes(1)
      const options = exportedOptions()
      expect(options.periodLabel).toBe('May 2026')
      expect(options.grandTotal).toBe(100)
      expect(options.categoryTotals.map((cat: { name: string }) => cat.name)).toEqual(['Travel', 'Food', 'Fun'])
      expect(options.expenses.map((e: { id: string }) => e.id).sort()).toEqual(['arcade', 'lunch', 'snack', 'taxi'])
    })

    it.each([
      ['all', 'all', 'All months All years'],
      ['2', '2025', 'March 2025'],
      ['all', 'current', 'All months 2026'],
      ['current', 'all', 'May All years']
    ])('labels month %s / year %s as "%s"', async (month, year, label) => {
      const wrapper = await mountStats([...EXPENSES, expense('march', 'food', 5, new Date(2025, 2, 3))])

      await wrapper.find('select[aria-label="Filter by month"]').setValue(month)
      await wrapper.find('select[aria-label="Filter by year"]').setValue(year)
      await findButton(wrapper, 'Export to Excel').trigger('click')

      expect(exportedOptions().periodLabel).toBe(label)
    })

    it('shows progress while exporting', async () => {
      mocks.exporter.exporting.value = true
      const wrapper = await mountStats()

      const button = findButton(wrapper, 'Exporting…')
      expect(button.attributes('disabled')).toBeDefined()
    })
  })

  it('does nothing while signed out', async () => {
    mocks.user.value = null
    await mountSuspended(ExpenseStats)

    expect(mocks.firestore.subscribeToCollection).not.toHaveBeenCalled()
  })

  it('stops listening when unmounted', async () => {
    const wrapper = await mountStats()

    wrapper.unmount()

    expect(mocks.firestore.listeners[0]!.unsubscribe).toHaveBeenCalled()
  })
})
