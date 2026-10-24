import { describe, expect, it } from 'vitest'
import { mockComponent, mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import FilterBar from '~/components/ui/FilterBar.vue'
import type { Category } from '~/types'

mockComponent('USelect', async () => (await import('../../helpers/stubs')).SelectStub)

const CATEGORIES = [
  { id: 'food', name: 'Food' },
  { id: 'travel', name: 'Travel' }
] as Category[]

const ALL_FILTERS = {
  hasSearchBar: true,
  hasCategoryFilter: true,
  hasMonthFilter: true,
  hasYearFilter: true
}

// Option labels, minus the stand-in select's placeholder.
const optionLabels = (wrapper: VueWrapper, label: string) =>
  wrapper.find(`select[aria-label="${label}"]`).findAll('option').map(option => option.text()).slice(1)

describe('FilterBar', () => {
  it('renders nothing unless asked', async () => {
    const wrapper = await mountSuspended(FilterBar)

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('renders only the requested filters', async () => {
    const wrapper = await mountSuspended(FilterBar, { props: { hasMonthFilter: true, hasYearFilter: true } })

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('select').map(select => select.attributes('aria-label')))
      .toEqual(['Filter by month', 'Filter by year'])
  })

  it('lists the categories after "All Categories"', async () => {
    const wrapper = await mountSuspended(FilterBar, { props: { ...ALL_FILTERS, categories: CATEGORIES } })

    expect(optionLabels(wrapper, 'Filter by category')).toEqual(['All Categories', 'Food', 'Travel'])
  })

  it('lists every month plus "All" and "Current"', async () => {
    const wrapper = await mountSuspended(FilterBar, { props: ALL_FILTERS })

    const months = optionLabels(wrapper, 'Filter by month')
    expect(months.slice(0, 3)).toEqual(['All months', 'Current month', 'January'])
    expect(months).toHaveLength(14)
  })

  it('lists the available years plus "All" and "Current"', async () => {
    const wrapper = await mountSuspended(FilterBar, { props: { ...ALL_FILTERS, availableYears: [2026, 2025] } })

    expect(optionLabels(wrapper, 'Filter by year')).toEqual(['All years', 'Current year', '2026', '2025'])
  })

  it('uses the search placeholder', async () => {
    const wrapper = await mountSuspended(FilterBar, { props: { hasSearchBar: true, searchPlaceholder: 'Find…' } })

    expect(wrapper.find('input').attributes('placeholder')).toBe('Find…')
  })

  it('emits the search text', async () => {
    const wrapper = await mountSuspended(FilterBar, { props: ALL_FILTERS })

    await wrapper.find('input').setValue('taxi')

    expect(wrapper.emitted('update:search')).toEqual([['taxi']])
  })

  it('shows an empty filter as "All"', async () => {
    const wrapper = await mountSuspended(FilterBar, { props: { ...ALL_FILTERS, categories: CATEGORIES } })

    for (const label of ['Filter by category', 'Filter by month', 'Filter by year']) {
      expect(wrapper.find<HTMLSelectElement>(`select[aria-label="${label}"]`).element.value).toBe('all')
    }
  })

  it('emits "All" as an empty filter', async () => {
    const wrapper = await mountSuspended(FilterBar, {
      props: { ...ALL_FILTERS, categories: CATEGORIES, category: 'food', month: '3', year: '2025', availableYears: [2025] }
    })

    await wrapper.find('select[aria-label="Filter by category"]').setValue('all')
    await wrapper.find('select[aria-label="Filter by month"]').setValue('all')
    await wrapper.find('select[aria-label="Filter by year"]').setValue('all')

    expect(wrapper.emitted('update:category')).toEqual([['']])
    expect(wrapper.emitted('update:month')).toEqual([['']])
    expect(wrapper.emitted('update:year')).toEqual([['']])
  })

  it('emits other choices as they are', async () => {
    const wrapper = await mountSuspended(FilterBar, {
      props: { ...ALL_FILTERS, categories: CATEGORIES, availableYears: [2025] }
    })

    await wrapper.find('select[aria-label="Filter by category"]').setValue('travel')
    await wrapper.find('select[aria-label="Filter by month"]').setValue('current')
    await wrapper.find('select[aria-label="Filter by year"]').setValue('2025')

    expect(wrapper.emitted('update:category')).toEqual([['travel']])
    expect(wrapper.emitted('update:month')).toEqual([['current']])
    expect(wrapper.emitted('update:year')).toEqual([['2025']])
  })
})
