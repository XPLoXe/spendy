<template>
  <UCard>
    <template #header>
      <UiCardHeader title="Categories">
        <UButton @click="showAddModal = true">
          Add Category
        </UButton>
      </UiCardHeader>
    </template>

    <div class="category-grid">
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-item"
        :style="categoryTint(category.color)"
      >
        <div
          class="category-color-dot"
          :style="{ backgroundColor: categoryColorVar(category.color) }"
        />
        <span
          class="category-name"
          :title="category.name"
        >{{ category.name }}</span>
        <div class="category-actions">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            title="Edit category"
            aria-label="Edit category"
            @click="openEditModal(category)"
          />
          <UButton
            icon="i-lucide-x"
            color="error"
            variant="ghost"
            size="xs"
            title="Delete category"
            aria-label="Delete category"
            @click="categoryToDelete = category"
          />
        </div>
      </div>
    </div>

    <!-- Add / Edit Category Modal -->
    <UModal
      v-model:open="showAddModal"
      :title="categoryToEdit ? 'Edit Category' : 'Add New Category'"
      @after:leave="resetForm"
    >
      <template #body>
        <div class="category-form">
          <UFormField label="Category Name">
            <UInput
              v-model="newCategory.name"
              class="w-full"
              type="text"
              placeholder="Enter category name"
            />
          </UFormField>
          <UFormField label="Color">
            <div class="color-picker">
              <UButton
                v-for="(color, index) in availableColors"
                :key="color"
                color="neutral"
                variant="ghost"
                square
                :aria-label="`${colorNames[index]} colour`"
                :aria-pressed="newCategory.color === color"
                @click="newCategory.color = color"
              >
                <span
                  class="color-option"
                  :class="newCategory.color === color ? 'color-option-selected' : 'color-option-default'"
                  :style="{ backgroundColor: categoryColorVar(color) }"
                />
              </UButton>
            </div>
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="modal-actions">
          <UButton
            class="modal-button"
            :disabled="!newCategory.name || !newCategory.color"
            @click="categoryToEdit ? updateCategory() : addCategory()"
          >
            {{ categoryToEdit ? 'Save Changes' : 'Add Category' }}
          </UButton>
          <UButton
            class="modal-button"
            color="neutral"
            variant="outline"
            @click="showAddModal = false; resetForm()"
          >
            Cancel
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete Category confirmation -->
    <UModal
      :open="!!categoryToDelete"
      title="Delete Category"
      @update:open="categoryToDelete = null"
    >
      <template #body>
        <p class="modal-text">
          Are you sure you want to delete this category?
        </p>
      </template>

      <template #footer>
        <div class="modal-actions">
          <UButton
            class="modal-button"
            color="error"
            @click="deleteCategory"
          >
            Delete
          </UButton>
          <UButton
            class="modal-button"
            color="neutral"
            variant="outline"
            @click="categoryToDelete = null"
          >
            Cancel
          </UButton>
        </div>
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
import type { Category } from '~/types'
import { where } from 'firebase/firestore'
import { CATEGORY_COLORS, CATEGORY_PALETTE, DEFAULT_CATEGORY_COLOR, categoryColorVar } from '~/constants'

const { user } = useAuth()
const { addDocument, updateDocument, deleteDocument, getDocuments, subscribeToCollection } = useFirestore()

const categories = ref<Category[]>([])
const showAddModal = ref(false)
const categoryToEdit = ref<Category | null>(null)
const categoryToDelete = ref<Category | null>(null)
const newCategory = ref({
  name: '',
  color: DEFAULT_CATEGORY_COLOR as string
})

const availableColors = CATEGORY_COLORS
// Same order as CATEGORY_COLORS, for the swatches' accessible names.
const colorNames = Object.keys(CATEGORY_PALETTE)

// Faint wash of the category colour behind its chip (it used to be the hex
// colour with a 10/20 alpha suffix, which a theme token can't take).
const categoryTint = (color: string) => ({
  borderColor: `color-mix(in oklab, ${categoryColorVar(color)} 12.5%, transparent)`,
  backgroundColor: `color-mix(in oklab, ${categoryColorVar(color)} 6.25%, transparent)`
})

const addCategory = async () => {
  if (!user.value || !newCategory.value.name || !newCategory.value.color) return

  try {
    await addDocument('categories', {
      name: newCategory.value.name,
      color: newCategory.value.color,
      userId: user.value.uid
    })

    showAddModal.value = false
    resetForm()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error adding category:', error)
  }
}

const openEditModal = (category: Category) => {
  categoryToEdit.value = category
  newCategory.value = { name: category.name, color: category.color }
  showAddModal.value = true
}

const updateCategory = async () => {
  if (!user.value || !categoryToEdit.value || !newCategory.value.name || !newCategory.value.color) return

  const { id } = categoryToEdit.value
  const { name, color } = newCategory.value

  try {
    await updateDocument('categories', id, { name, color })

    const expenses = await getDocuments('expenses', [
      where('categoryId', '==', id),
      where('userId', '==', user.value.uid)
    ])

    await Promise.all(
      expenses.map(expense =>
        updateDocument('expenses', expense.id, { categoryName: name, categoryColor: color })
      )
    )

    showAddModal.value = false
    resetForm()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating category:', error)
  }
}

const deleteCategory = async () => {
  if (!categoryToDelete.value) return

  const categoryId = categoryToDelete.value.id
  categoryToDelete.value = null

  try {
    await deleteDocument('categories', categoryId)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting category:', error)
  }
}

const resetForm = () => {
  newCategory.value = { name: '', color: DEFAULT_CATEGORY_COLOR }
  categoryToEdit.value = null
}

// Subscribe to categories changes
watch(user, () => {
  if (user.value) {
    const unsubscribe = subscribeToCollection(
      'categories',
      [where('userId', '==', user.value.uid)],
      (docs) => {
        categories.value = docs as Category[]
      }
    )

    onUnmounted(() => {
      unsubscribe()
    })
  }
}, { immediate: true })
</script>

<style scoped>
@reference "~/assets/css/main.css";

.category-grid {
  @apply grid grid-cols-2 gap-2;
}

.category-item {
  @apply flex items-center gap-2 p-2 rounded-lg border;
}

.category-color-dot {
  @apply size-4 shrink-0 rounded-full;
}

.category-name {
  @apply min-w-0 truncate text-sm font-medium text-highlighted;
}

.category-actions {
  @apply ml-auto flex shrink-0;
}

.category-form {
  @apply space-y-4;
}

.color-picker {
  @apply flex flex-wrap gap-1;
}

.color-option {
  @apply size-7 rounded-full border-2;
}

.color-option-selected {
  @apply border-inverted;
}

.color-option-default {
  @apply border-accented;
}

.modal-text {
  @apply text-toned;
}

.modal-actions {
  @apply flex w-full gap-3;
}

.modal-button {
  @apply flex-1 justify-center;
}
</style>
