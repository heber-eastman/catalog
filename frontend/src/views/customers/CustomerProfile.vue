<template>
  <v-container fluid class="pa-0">
    <!-- Header Section -->
    <div class="customer-header">
      <!-- Breadcrumb -->
      <v-breadcrumbs
        :items="breadcrumbItems"
        class="pa-0 mb-2"
        density="compact"
      >
        <template v-slot:item="{ item }">
          <v-breadcrumbs-item
            :to="item.to"
            :disabled="item.disabled"
            class="text-body-2"
          >
            {{ item.title }}
          </v-breadcrumbs-item>
        </template>
        <template v-slot:divider>
          <v-icon icon="mdi-chevron-right" size="small" />
        </template>
      </v-breadcrumbs>

      <!-- Header Content -->
      <div class="d-flex justify-space-between align-start mb-4">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1">
            {{ customer.first_name }} {{ customer.last_name }}
          </h1>
          <div class="text-body-2 text-medium-emphasis">
            ID: {{ customer.id }}
          </div>
        </div>

        <!-- Desktop Action Buttons -->
        <div class="d-none d-sm-flex ga-2">
          <v-btn
            icon="mdi-pencil"
            variant="outlined"
            size="small"
            @click="openEditModal"
            :loading="loading"
          />
          <v-btn
            icon="mdi-delete"
            variant="outlined"
            size="small"
            color="error"
            @click="confirmDelete"
            :loading="loading"
          />
        </div>

        <!-- Mobile Action Menu -->
        <div class="d-flex d-sm-none">
          <v-menu>
            <template v-slot:activator="{ props }">
              <v-btn
                icon="mdi-dots-vertical"
                variant="text"
                size="small"
                v-bind="props"
              />
            </template>
            <v-list density="compact">
              <v-list-item @click="openEditModal" :disabled="loading">
                <template v-slot:prepend>
                  <v-icon icon="mdi-pencil" />
                </template>
                <v-list-item-title>Edit Customer</v-list-item-title>
              </v-list-item>
              <v-list-item @click="confirmDelete" :disabled="loading">
                <template v-slot:prepend>
                  <v-icon icon="mdi-delete" color="error" />
                </template>
                <v-list-item-title class="text-error">Delete Customer</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-section">
      <!-- Desktop Tabs -->
      <v-tabs
        v-model="activeTab"
        class="d-none d-sm-flex"
        color="primary"
        slider-color="primary"
      >
        <v-tab value="personal">Personal Information</v-tab>
        <v-tab value="notes">Notes</v-tab>
      </v-tabs>

      <!-- Mobile Tab Dropdown -->
      <div class="d-flex d-sm-none">
        <v-select
          v-model="activeTab"
          :items="tabItems"
          item-title="title"
          item-value="value"
          variant="outlined"
          density="compact"
          hide-details
          class="tab-dropdown"
        />
      </div>
    </div>

    <!-- Tab Content -->
    <v-card flat class="mt-4">
      <v-card-text class="pa-6">
        <v-window v-model="activeTab">
          <!-- Personal Information Tab -->
          <v-window-item value="personal">
            <div class="personal-info-grid">
              <div class="info-item">
                <v-icon icon="mdi-email" class="mr-3" color="primary" />
                <span>{{ customer.email }}</span>
              </div>
              
              <div class="info-item">
                <v-icon icon="mdi-phone" class="mr-3" color="primary" />
                <span>{{ customer.phone || 'Not provided' }}</span>
              </div>
              
              <div class="info-item">
                <v-icon icon="mdi-calendar" class="mr-3" color="primary" />
                <span>{{ getMemberSinceYear() }}</span>
              </div>
              
              <div class="info-item" v-if="customer.membership_type">
                <v-icon icon="mdi-card-account-details" class="mr-3" color="primary" />
                <v-chip
                  :color="getMembershipTypeColor(customer.membership_type)"
                  size="small"
                  class="ml-0"
                >
                  {{ customer.membership_type }}
                </v-chip>
              </div>
            </div>
          </v-window-item>

          <!-- Notes Tab -->
          <v-window-item value="notes">
            <div class="personal-info-grid" v-if="customer.notes">
              <div class="info-item">
                <v-icon icon="mdi-note-text" class="mr-3" color="primary" />
                <div class="note-content">
                  <div class="text-body-1">{{ customer.notes }}</div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    Last updated: {{ formatDate(customer.updated_at) }}
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-medium-emphasis">
              <v-icon icon="mdi-information" size="48" class="mb-2" />
              <div class="text-h6">No Notes</div>
              <div class="text-body-2">No notes have been added for this customer yet.</div>
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>

    <!-- Edit Customer Modal -->
    <v-dialog v-model="editDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title class="text-h5">Edit Customer</v-card-title>
        
        <v-card-text>
          <v-container>
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editForm.first_name"
                  label="First Name*"
                  :rules="[v => !!v || 'First name is required']"
                  required
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editForm.last_name"
                  label="Last Name*"
                  :rules="[v => !!v || 'Last name is required']"
                  required
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editForm.email"
                  label="Email*"
                  type="email"
                  :rules="[
                    v => !!v || 'Email is required',
                    v => /.+@.+\..+/.test(v) || 'Email must be valid'
                  ]"
                  required
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editForm.phone"
                  label="Phone Number"
                  type="tel"
                />
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="editForm.membership_type"
                  :items="membershipTypes"
                  label="Membership Type"
                />
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeEditModal">Cancel</v-btn>
          <v-btn 
            color="primary" 
            @click="saveCustomer"
            :loading="saving"
          >
            Save Changes
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h6">Delete Customer</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ customer.first_name }} {{ customer.last_name }}</strong>? 
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="deleteDialog = false">Cancel</v-btn>
          <v-btn 
            color="error" 
            @click="deleteCustomer"
            :loading="deleting"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success/Error Messages -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="4000"
      top
    >
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="snackbar.show = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import customerAPI from '@/services/api'

export default {
  name: 'CustomerProfile',
  setup() {
    const route = useRoute()
    const router = useRouter()
    
    // Reactive data
    const customer = ref({})
    const loading = ref(false)
    const saving = ref(false)
    const deleting = ref(false)
    const activeTab = ref('personal')
    const editDialog = ref(false)
    const deleteDialog = ref(false)
    
    const editForm = reactive({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      membership_type: ''
    })

    const snackbar = reactive({
      show: false,
      message: '',
      color: 'success'
    })

    // Static data
    const membershipTypes = [
      'Trial',
      'Basic',
      'Premium',
      'VIP'
    ]

    const tabItems = [
      { title: 'Personal Information', value: 'personal' },
      { title: 'Notes', value: 'notes' }
    ]

    // Computed properties
    const breadcrumbItems = computed(() => [
      {
        title: 'Customers',
        to: '/customers',
        disabled: false
      },
      {
        title: `${customer.value.first_name || ''} ${customer.value.last_name || ''}`.trim() || 'Customer',
        disabled: true
      }
    ])

    // Methods
    const loadCustomer = async () => {
      loading.value = true
      try {
        const response = await customerAPI.get(`/customers/${route.params.id}`)
        customer.value = response.data
      } catch (error) {
        showNotification('Error loading customer: ' + (error.response?.data?.error || error.message), 'error')
        router.push('/customers')
      } finally {
        loading.value = false
      }
    }

    const getMemberSinceYear = () => {
      if (!customer.value.created_at) return 'Unknown'
      return new Date(customer.value.created_at).getFullYear()
    }

    const formatDate = (dateString) => {
      if (!dateString) return 'Unknown'
      return new Date(dateString).toLocaleDateString()
    }

    const getMembershipTypeColor = (type) => {
      const colorMap = {
        'Trial': 'grey',
        'Basic': 'blue',
        'Premium': 'purple',
        'VIP': 'amber'
      }
      return colorMap[type] || 'primary'
    }

    const openEditModal = () => {
      // Pre-fill the form with current customer data
      editForm.first_name = customer.value.first_name || ''
      editForm.last_name = customer.value.last_name || ''
      editForm.email = customer.value.email || ''
      editForm.phone = customer.value.phone || ''
      editForm.membership_type = customer.value.membership_type || ''
      editDialog.value = true
    }

    const closeEditModal = () => {
      editDialog.value = false
      // Reset form
      Object.keys(editForm).forEach(key => {
        editForm[key] = ''
      })
    }

    const saveCustomer = async () => {
      saving.value = true
      try {
        const response = await customerAPI.put(`/customers/${route.params.id}`, editForm)
        customer.value = response.data
        showNotification('Customer updated successfully', 'success')
        closeEditModal()
      } catch (error) {
        showNotification('Error updating customer: ' + (error.response?.data?.error || error.message), 'error')
      } finally {
        saving.value = false
      }
    }

    const confirmDelete = () => {
      deleteDialog.value = true
    }

    const deleteCustomer = async () => {
      deleting.value = true
      try {
        await customerAPI.delete(`/customers/${route.params.id}`)
        showNotification('Customer deleted successfully', 'success')
        router.push('/customers')
      } catch (error) {
        showNotification('Error deleting customer: ' + (error.response?.data?.error || error.message), 'error')
        deleteDialog.value = false
      } finally {
        deleting.value = false
      }
    }

    const showNotification = (message, color = 'success') => {
      snackbar.message = message
      snackbar.color = color
      snackbar.show = true
    }

    // Lifecycle
    onMounted(() => {
      loadCustomer()
    })

    return {
      customer,
      loading,
      saving,
      deleting,
      activeTab,
      editDialog,
      deleteDialog,
      editForm,
      snackbar,
      membershipTypes,
      tabItems,
      breadcrumbItems,
      loadCustomer,
      getMemberSinceYear,
      formatDate,
      getMembershipTypeColor,
      openEditModal,
      closeEditModal,
      saveCustomer,
      confirmDelete,
      deleteCustomer,
      showNotification
    }
  }
}
</script>

<style scoped>
.customer-header {
  padding: 24px 24px 0 24px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.tab-section {
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 0 24px;
}

.tab-dropdown {
  max-width: 300px;
  margin: 16px 0;
}

.personal-info-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-item {
  display: flex;
  align-items: center;
  font-size: 16px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .v-icon {
  opacity: 0.7;
}

.note-content {
  flex: 1;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.note-content .text-body-1 {
  white-space: pre-wrap;
  line-height: 1.5;
}

/* Mobile responsive adjustments */
@media (max-width: 599px) {
  .customer-header {
    padding: 16px 16px 0 16px;
  }
  
  .tab-section {
    padding: 0 16px;
  }
  
  .personal-info-grid {
    gap: 16px;
  }
  
  .info-item {
    font-size: 14px;
    padding: 8px 0;
  }
}
</style>
