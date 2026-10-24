import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Tabs from '~/components/ui/Tabs.vue'

const TABS = [
  { value: 'list', label: 'Expenses' },
  { value: 'stats', label: 'Stats' }
]

const mountTabs = (modelValue = 'list') =>
  mountSuspended(Tabs, {
    props: { modelValue, tabs: TABS },
    slots: {
      list: () => 'List panel',
      stats: () => 'Stats panel'
    }
  })

describe('Tabs', () => {
  it('renders a tab per item', async () => {
    const wrapper = await mountTabs()

    expect(wrapper.findAll('[role="tab"]').map(tab => tab.text())).toEqual(['Expenses', 'Stats'])
  })

  it('marks the selected tab and shows its panel', async () => {
    const wrapper = await mountTabs('stats')

    const selected = wrapper.find('[role="tab"][aria-selected="true"]')
    expect(selected.text()).toBe('Stats')
    expect(wrapper.find('[role="tabpanel"]:not([hidden])').text()).toBe('Stats panel')
  })

  it('keeps hidden panels mounted', async () => {
    const wrapper = await mountTabs()

    expect(wrapper.text()).toContain('Stats panel')
  })

  it('emits the tab that was picked', async () => {
    const wrapper = await mountTabs()

    // Reka UI activates a tab on a primary-button mousedown.
    await wrapper.findAll('[role="tab"]')[1]!.trigger('mousedown', { button: 0 })

    expect(wrapper.emitted('update:modelValue')).toEqual([['stats']])
  })
})
