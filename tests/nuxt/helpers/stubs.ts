import { defineComponent, h, watch, type PropType } from 'vue'

// Nuxt UI's modal, select and dropdown render through portals and pointer
// events that happy-dom can't drive reliably. These stand-ins keep the same
// props and events, so the components under test behave as they do in the app.

// UModal: renders inline while open and fires after:leave once it closes.
export const ModalStub = defineComponent({
  name: 'UModal',
  props: {
    open: Boolean,
    title: { type: String, default: '' }
  },
  emits: ['update:open', 'after:leave'],
  setup (props, { emit, slots }) {
    watch(() => props.open, (open, wasOpen) => {
      if (wasOpen && !open) emit('after:leave')
    })

    return () => props.open
      ? h('div', { 'data-testid': 'modal', 'data-title': props.title }, [
        h('h2', props.title),
        h('button', { 'data-testid': 'modal-dismiss', onClick: () => emit('update:open', false) }, 'Dismiss'),
        slots.body?.(),
        slots.footer?.()
      ])
      : null
  }
})

type SelectItem = { value: string, label: string }

// USelect: a native <select> with the same items and v-model.
export const SelectStub = defineComponent({
  name: 'USelect',
  props: {
    modelValue: { type: String, default: '' },
    items: { type: Array as PropType<SelectItem[]>, default: () => [] },
    placeholder: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup (props, { emit }) {
    return () => h(
      'select',
      {
        value: props.modelValue,
        onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value)
      },
      [
        h('option', { value: '' }, props.placeholder),
        ...props.items.map(item => h('option', { value: item.value }, item.label))
      ]
    )
  }
})

// An empty marker for a child component that has its own tests.
export const placeholder = (testId: string) =>
  defineComponent({ render: () => h('div', { 'data-testid': testId }) })

type MenuItem = { label: string, onSelect?: () => void }

// UDropdownMenu: the trigger plus every item, always visible.
export const DropdownMenuStub = defineComponent({
  name: 'UDropdownMenu',
  props: {
    items: { type: Array as PropType<MenuItem[][]>, default: () => [] }
  },
  setup (props, { slots }) {
    return () => h('div', { 'data-testid': 'dropdown' }, [
      slots.default?.(),
      h('ul', props.items.flat().map(item =>
        h('li', item.onSelect ? h('button', { onClick: item.onSelect }, item.label) : item.label)
      ))
    ])
  }
})
