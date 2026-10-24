import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockComponent, mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import { where } from 'firebase/firestore'
import CategoryManager from '~/components/CategoryManager.vue'
import { CATEGORY_PALETTE } from '~/constants'
import { createFirestoreMock, type FirestoreMock } from '../helpers/firestore'
import { findButton, findModal } from '../helpers/dom'

const mocks = vi.hoisted(() => ({
  firestore: undefined as unknown as FirestoreMock,
  user: undefined as unknown as Ref<{ uid: string } | null>
}))

mockNuxtImport('useAuth', () => () => ({ user: mocks.user }))
mockNuxtImport('useFirestore', () => () => mocks.firestore)
mockComponent('UModal', async () => (await import('../helpers/stubs')).ModalStub)

const CATEGORIES = [
  { id: 'food', name: 'Food', color: CATEGORY_PALETTE.green, userId: 'u1' },
  { id: 'travel', name: 'Travel', color: CATEGORY_PALETTE.red, userId: 'u1' }
]

const mountManager = async () => {
  const wrapper = await mountSuspended(CategoryManager)
  mocks.firestore.emit('categories', CATEGORIES)
  await wrapper.vm.$nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountManager>>

const categoryItem = (wrapper: Wrapper, name: string) =>
  wrapper.findAll('.category-item').find(item => item.text().includes(name))!

const formModal = (wrapper: Wrapper) =>
  wrapper.find('[data-testid="modal"]')

// The header button; the modal's own "Add Category" only exists once it opens.
const openAddModal = async (wrapper: Wrapper) => {
  await findButton(wrapper, 'Add Category').trigger('click')
  return formModal(wrapper)
}

beforeEach(() => {
  mocks.firestore = createFirestoreMock()
  mocks.user = ref({ uid: 'u1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CategoryManager', () => {
  it('lists the user\'s categories in their theme colour', async () => {
    const wrapper = await mountManager()

    expect(mocks.firestore.subscribeToCollection).toHaveBeenCalledWith(
      'categories',
      [where('userId', '==', 'u1')],
      expect.any(Function)
    )
    expect(wrapper.findAll('.category-name').map(name => name.text())).toEqual(['Food', 'Travel'])
    expect(categoryItem(wrapper, 'Food').find('.category-color-dot').attributes('style'))
      .toContain('var(--category-green)')
  })

  describe('adding', () => {
    it('opens an empty form with the default colour', async () => {
      const wrapper = await mountManager()

      const modal = await openAddModal(wrapper)

      expect(modal.attributes('data-title')).toBe('Add New Category')
      expect(modal.find<HTMLInputElement>('input').element.value).toBe('')
      expect(findButton(modal, 'blue colour').attributes('aria-pressed')).toBe('true')
      expect(findButton(modal, 'Add Category').attributes('disabled')).toBeDefined()
    })

    it('saves the name and the picked colour', async () => {
      const wrapper = await mountManager()
      const modal = await openAddModal(wrapper)

      await modal.find('input').setValue('Groceries')
      await findButton(modal, 'violet colour').trigger('click')
      expect(findButton(modal, 'violet colour').attributes('aria-pressed')).toBe('true')
      await findButton(modal, 'Add Category').trigger('click')
      await flushPromises()

      expect(mocks.firestore.addDocument).toHaveBeenCalledWith('categories', {
        name: 'Groceries',
        color: CATEGORY_PALETTE.violet,
        userId: 'u1'
      })
      expect(formModal(wrapper).exists()).toBe(false)
    })

    it('keeps the form open when saving fails', async () => {
      mocks.firestore.addDocument.mockRejectedValue(new Error('offline'))
      const wrapper = await mountManager()
      const modal = await openAddModal(wrapper)

      await modal.find('input').setValue('Groceries')
      await findButton(modal, 'Add Category').trigger('click')
      await flushPromises()

      expect(console.error).toHaveBeenCalledWith('Error adding category:', expect.any(Error))
      expect(formModal(wrapper).exists()).toBe(true)
    })

    it('starts fresh after cancelling', async () => {
      const wrapper = await mountManager()
      let modal = await openAddModal(wrapper)
      await modal.find('input').setValue('Draft')
      await findButton(modal, 'red colour').trigger('click')

      await findButton(modal, 'Cancel').trigger('click')
      modal = await openAddModal(wrapper)

      expect(modal.find<HTMLInputElement>('input').element.value).toBe('')
      expect(findButton(modal, 'blue colour').attributes('aria-pressed')).toBe('true')
    })
  })

  describe('editing', () => {
    it('opens the form filled with the category', async () => {
      const wrapper = await mountManager()

      await findButton(categoryItem(wrapper, 'Travel'), 'Edit category').trigger('click')
      const modal = formModal(wrapper)

      expect(modal.attributes('data-title')).toBe('Edit Category')
      expect(modal.find<HTMLInputElement>('input').element.value).toBe('Travel')
      expect(findButton(modal, 'red colour').attributes('aria-pressed')).toBe('true')
    })

    it('renames the category and the expenses filed under it', async () => {
      mocks.firestore.getDocuments.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }])
      const wrapper = await mountManager()
      await findButton(categoryItem(wrapper, 'Travel'), 'Edit category').trigger('click')
      const modal = formModal(wrapper)

      await modal.find('input').setValue('Trips')
      await findButton(modal, 'cyan colour').trigger('click')
      await findButton(modal, 'Save Changes').trigger('click')
      await flushPromises()

      const change = { categoryName: 'Trips', categoryColor: CATEGORY_PALETTE.cyan }
      expect(mocks.firestore.updateDocument).toHaveBeenCalledWith('categories', 'travel', { name: 'Trips', color: CATEGORY_PALETTE.cyan })
      expect(mocks.firestore.getDocuments).toHaveBeenCalledWith('expenses', [
        where('categoryId', '==', 'travel'),
        where('userId', '==', 'u1')
      ])
      expect(mocks.firestore.updateDocument).toHaveBeenCalledWith('expenses', 'e1', change)
      expect(mocks.firestore.updateDocument).toHaveBeenCalledWith('expenses', 'e2', change)
      expect(formModal(wrapper).exists()).toBe(false)
    })

    it('returns to adding once the edit is closed', async () => {
      const wrapper = await mountManager()
      await findButton(categoryItem(wrapper, 'Travel'), 'Edit category').trigger('click')

      await findButton(formModal(wrapper), 'Dismiss').trigger('click')
      const modal = await openAddModal(wrapper)

      expect(modal.attributes('data-title')).toBe('Add New Category')
      expect(modal.find<HTMLInputElement>('input').element.value).toBe('')
    })

    it('logs a failed update', async () => {
      mocks.firestore.updateDocument.mockRejectedValue(new Error('offline'))
      const wrapper = await mountManager()
      await findButton(categoryItem(wrapper, 'Travel'), 'Edit category').trigger('click')

      await findButton(formModal(wrapper), 'Save Changes').trigger('click')
      await flushPromises()

      expect(console.error).toHaveBeenCalledWith('Error updating category:', expect.any(Error))
    })
  })

  describe('deleting', () => {
    it('deletes after confirmation', async () => {
      const wrapper = await mountManager()

      await findButton(categoryItem(wrapper, 'Food'), 'Delete category').trigger('click')
      await findButton(findModal(wrapper, 'Delete Category'), 'Delete').trigger('click')
      await flushPromises()

      expect(mocks.firestore.deleteDocument).toHaveBeenCalledWith('categories', 'food')
      expect(findModal(wrapper, 'Delete Category').exists()).toBe(false)
    })

    it.each(['Cancel', 'Dismiss'])('keeps the category on %s', async (action) => {
      const wrapper = await mountManager()

      await findButton(categoryItem(wrapper, 'Food'), 'Delete category').trigger('click')
      await findButton(findModal(wrapper, 'Delete Category'), action).trigger('click')

      expect(mocks.firestore.deleteDocument).not.toHaveBeenCalled()
      expect(findModal(wrapper, 'Delete Category').exists()).toBe(false)
    })

    it('logs a failed delete', async () => {
      mocks.firestore.deleteDocument.mockRejectedValue(new Error('offline'))
      const wrapper = await mountManager()

      await findButton(categoryItem(wrapper, 'Food'), 'Delete category').trigger('click')
      await findButton(findModal(wrapper, 'Delete Category'), 'Delete').trigger('click')
      await flushPromises()

      expect(console.error).toHaveBeenCalledWith('Error deleting category:', expect.any(Error))
    })
  })

  it('does nothing while signed out', async () => {
    mocks.user.value = null
    const wrapper = await mountSuspended(CategoryManager)
    const modal = await openAddModal(wrapper)

    await modal.find('input').setValue('Groceries')
    await findButton(modal, 'Add Category').trigger('click')

    expect(mocks.firestore.subscribeToCollection).not.toHaveBeenCalled()
    expect(mocks.firestore.addDocument).not.toHaveBeenCalled()
  })

  it('stops listening when unmounted', async () => {
    const wrapper = await mountManager()

    wrapper.unmount()

    expect(mocks.firestore.listeners[0]!.unsubscribe).toHaveBeenCalled()
  })
})
