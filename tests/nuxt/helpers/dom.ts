import type { DOMWrapper, VueWrapper } from '@vue/test-utils'

type Wrapper = VueWrapper | DOMWrapper<Element>

// A button by its visible text or accessible name.
export const findButton = (wrapper: Wrapper, name: string) => {
  const button = wrapper.findAll('button').find(candidate =>
    candidate.text() === name || candidate.attributes('aria-label') === name
  )
  if (!button) throw new Error(`No button named "${name}" in:\n${wrapper.html()}`)
  return button
}

export const findModal = (wrapper: Wrapper, title: string) =>
  wrapper.find(`[data-testid="modal"][data-title="${title}"]`)
