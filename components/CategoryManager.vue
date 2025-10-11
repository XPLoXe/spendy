<template>
  <div class="card">
    <div class="section-header">
      <h2 class="section-title">Categories</h2>
      <button 
        @click="showAddModal = true"
        class="btn-primary category-add-btn"
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
        ></div>
        <span class="category-name">{{ category.name }}</span>
        <button 
          @click="deleteCategory(category.id)"
          class="category-delete-btn"
        >
          ×
        </button>
      </div>
    </div>
    
    <!-- Add Category Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-content">
        <h3 class="modal-header">Add New Category</h3>
        <div class="category-form">
          <div class="form-group">
            <label class="form-label">Category Name</label>
            <input 
              v-model="newCategory.name"
              type="text"
              class="input-field"
              placeholder="Enter category name"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Color</label>
            <div class="color-picker">
              <button 
                v-for="color in availableColors"
                :key="color"
                @click="newCategory.color = color"
                class="color-option"
                :class="newCategory.color === color ? 'color-option-selected' : 'color-option-default'"
                :style="{ backgroundColor: color }"
              ></button>
            </div>
          </div>
          <div class="modal-actions">
            <button 
              @click="addCategory"
              class="btn-primary modal-button"
              :disabled="!newCategory.name || !newCategory.color"
            >
              Add Category
            </button>
            <button 
              @click="showAddModal = false; resetForm()"
              class="btn-secondary modal-button"
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

const { user } = useAuth()
const { addDocument, deleteDocument, subscribeToCollection } = useFirestore()

const categories = ref<Category[]>([])
const showAddModal = ref(false)
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
    console.error('Error adding category:', error)
  }
}

const deleteCategory = async (categoryId: string) => {
  if (!confirm('Are you sure you want to delete this category?')) return
  
  try {
    await deleteDocument('categories', categoryId)
  } catch (error) {
    console.error('Error deleting category:', error)
  }
}

const resetForm = () => {
  newCategory.value = {
    name: '',
    color: '#3B82F6'
  }
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

<style lang="postcss" scoped>
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

.category-delete-btn {
  @apply ml-auto text-red-500 hover:text-red-700 text-xs;
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
