<template>
  <div class="card">
    <div class="section-header">
      <h2 class="section-title">
        Categories
      </h2>
      <button
        class="btn-primary category-add-btn"
        @click="showAddModal = true"
      >
        Add Category
      </button>
    </div>

    <div class="category-grid">
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-item"
        :style="{ borderColor: category.color + '20', backgroundColor: category.color + '10' }"
      >
        <div
          class="category-color-dot"
          :style="{ backgroundColor: category.color }"
        />
        <span class="category-name">{{ category.name }}</span>
        <button
          class="edit-category-btn"
          title="Edit category"
          @click="openEditModal(category)"
        >
          <PencilIcon class="w-4 h-4" />
        </button>
        <button
          class="delete-category-btn"
          title="Delete category"
          @click="deleteCategory(category.id)"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Add / Edit Category Modal -->
    <div
      v-if="showAddModal"
      class="modal-overlay"
    >
      <div class="modal-content">
        <h3 class="modal-header">
          {{ categoryToEdit ? 'Edit Category' : 'Add New Category' }}
        </h3>
        <div class="category-form">
          <div class="form-group">
            <label class="form-label">Category Name</label>
            <input
              v-model="newCategory.name"
              type="text"
              class="input-field"
              placeholder="Enter category name"
            >
          </div>
          <div class="form-group">
            <label class="form-label">Color</label>
            <div class="color-picker">
              <button
                v-for="color in availableColors"
                :key="color"
                class="color-option"
                :class="newCategory.color === color ? 'color-option-selected' : 'color-option-default'"
                :style="{ backgroundColor: color }"
                @click="newCategory.color = color"
              />
            </div>
          </div>
          <div class="modal-actions">
            <button
              class="btn-primary modal-button"
              :disabled="!newCategory.name || !newCategory.color"
              @click="categoryToEdit ? updateCategory() : addCategory()"
            >
              {{ categoryToEdit ? 'Save Changes' : 'Add Category' }}
            </button>
            <button
              class="btn-secondary modal-button"
              @click="showAddModal = false; resetForm()"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Category } from '~/types'
import { where } from 'firebase/firestore'
import { XMarkIcon, PencilIcon } from '@heroicons/vue/24/outline'

const { user } = useAuth()
const { addDocument, updateDocument, deleteDocument, getDocuments, subscribeToCollection } = useFirestore()

const categories = ref<Category[]>([])
const showAddModal = ref(false)
const categoryToEdit = ref<Category | null>(null)
const newCategory = ref({
  name: '',
  color: '#3B82F6'
})

const availableColors = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
]

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

const deleteCategory = async (categoryId: string) => {
  if (!confirm('Are you sure you want to delete this category?')) return

  try {
    await deleteDocument('categories', categoryId)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting category:', error)
  }
}

const resetForm = () => {
  newCategory.value = { name: '', color: '#3B82F6' }
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
.category-add-btn {
  @apply text-sm;
}

.category-grid {
  @apply grid grid-cols-2 gap-2 mb-4;
}

.category-item {
  @apply flex items-center space-x-2 p-2 rounded-lg border;
}

.category-color-dot {
  @apply w-4 h-4 rounded-full;
}

.category-name {
  @apply text-sm font-medium text-gray-700;
}

.edit-category-btn {
  @apply ml-3 p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors duration-200;
}

.delete-category-btn {
  @apply ml-3 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200;
}

.category-form {
  @apply space-y-4;
}

.form-group {
  @apply flex flex-col;
}

.color-picker {
  @apply flex space-x-2;
}

.color-option {
  @apply w-8 h-8 rounded-full border-2;
}

.color-option-selected {
  @apply border-gray-800;
}

.color-option-default {
  @apply border-gray-300;
}
</style>
