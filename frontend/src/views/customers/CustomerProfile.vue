<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <!-- Header -->
        <div class="d-flex align-center mb-4">
          <v-btn
            icon="mdi-arrow-left"
            variant="text"
            @click="$router.back()"
            class="mr-2"
            data-cy="back-btn"
          />
          <div class="flex-grow-1">
            <h1 class="text-h4" data-cy="customer-name">
              {{ customer.first_name }} {{ customer.last_name }}
            </h1>
            <p class="text-medium-emphasis">Customer ID: {{ customerId }}</p>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row v-if="loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate size="64" />
        <p class="mt-4">Loading customer details...</p>
      </v-col>
    </v-row>

    <v-row v-else-if="customer.id">
      <!-- Customer Information Card -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-account" class="mr-2" />
            Customer Information
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-email" />
                </template>
                <v-list-item-title>{{ customer.email }}</v-list-item-title>
                <v-list-item-subtitle>Email</v-list-item-subtitle>
              </v-list-item>

              <v-list-item v-if="customer.phone">
                <template #prepend>
                  <v-icon icon="mdi-phone" />
                </template>
                <v-list-item-title>{{ customer.phone }}</v-list-item-title>
                <v-list-item-subtitle>Phone</v-list-item-subtitle>
              </v-list-item>

              <v-list-item v-if="customer.membership_type">
                <template #prepend>
                  <v-icon icon="mdi-card-account-details" />
                </template>
                <v-list-item-title>
                  <v-chip
                    :color="getMembershipTypeColor(customer.membership_type)"
                    size="small"
                  >
                    {{ customer.membership_type }}
                  </v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>Membership Type</v-list-item-subtitle>
              </v-list-item>

              <v-list-item v-if="customer.notes">
                <template #prepend>
                  <v-icon icon="mdi-note-text" />
                </template>
                <v-list-item-title>{{ customer.notes }}</v-list-item-title>
                <v-list-item-subtitle>Notes</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-calendar" />
                </template>
                <v-list-item-title>{{
                  formatDate(customer.created_at)
                }}</v-list-item-title>
                <v-list-item-subtitle>Member Since</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Actions</v-card-title>
          <v-card-text>
            <div class="d-flex flex-column ga-2">
              <v-btn
                color="primary"
                prepend-icon="mdi-pencil"
                @click="openEditDialog"
                data-cy="edit-customer-btn"
              >
                Edit Customer
              </v-btn>
              <v-btn
                color="error"
                variant="outlined"
                prepend-icon="mdi-delete"
                @click="confirmDelete"
                data-cy="delete-customer-btn"
              >
                Delete Customer
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Customer not found -->
    <v-row v-else>
      <v-col cols="12" class="text-center">
        <v-icon
          icon="mdi-account-off"
          size="64"
          class="mb-2 text-medium-emphasis"
        />
        <h2 class="mb-2">Customer Not Found</h2>
        <p class="text-medium-emphasis mb-4">
          The customer you're looking for doesn't exist or may have been
          deleted.
        </p>
        <v-btn color="primary" @click="$router.push('/customers')">
          Back to Customers
        </v-btn>
      </v-col>
    </v-row>

    <!-- Edit Customer Dialog -->
    <v-dialog v-model="showEditDialog" max-width="700px">
      <v-card>
        <v-card-title>Edit Customer</v-card-title>
        <v-card-text>
          <v-form ref="customerForm" v-model="customerFormValid">
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="customerData.first_name"
                  label="First Name *"
                  :rules="[v => !!v || 'First name is required']"
                  required
                  data-cy="edit-customer-first-name"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="customerData.last_name"
                  label="Last Name *"
                  :rules="[v => !!v || 'Last name is required']"
                  required
                  data-cy="edit-customer-last-name"
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="customerData.email"
              label="Email *"
              type="email"
              :rules="[
                v => !!v || 'Email is required',
                v => /.+@.+\..+/.test(v) || 'Email must be valid',
              ]"
              required
              data-cy="edit-customer-email"
            />
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="customerData.phone"
                  label="Phone"
                  data-cy="edit-customer-phone"
                />
              </v-col>
              <v-col cols="6">
                <v-select
                  v-model="customerData.membership_type"
                  :items="membershipTypeOptions"
                  label="Membership Type *"
                  :rules="[v => !!v || 'Membership type is required']"
                  required
                  data-cy="edit-customer-membership-type-select"
                />
              </v-col>
            </v-row>
            <v-textarea
              v-model="customerData.notes"
              label="Notes"
              rows="3"
              data-cy="edit-customer-notes"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeEditDialog" data-cy="cancel-edit-customer-btn">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="saveCustomer"
            :disabled="!customerFormValid"
            :loading="saving"
            data-cy="save-edit-customer-btn"
          >
            Update Customer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Confirm Deletion</v-card-title>
        <v-card-text>
          Are you sure you want to delete
          <strong>{{ customer.first_name }} {{ customer.last_name }}</strong
          >? <br /><br />
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showDeleteDialog = false" data-cy="cancel-delete-btn">
            Cancel
          </v-btn>
          <v-btn
            color="error"
            @click="deleteCustomer"
            :loading="deleting"
            data-cy="confirm-delete-btn"
          >
            Delete Customer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success/Error Snackbar -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="4000"
      data-cy="snackbar"
    >
      {{ snackbarMessage }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script>
import { customerAPI } from '@/services/api';

export default {
  name: 'CustomerProfile',
  data() {
    return {
      customerId: this.$route.params.id,
      customer: {},
      loading: false,
      saving: false,
      deleting: false,

      // Dialog states
      showEditDialog: false,
      showDeleteDialog: false,

      // Form data
      customerFormValid: false,
      customerData: {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        membership_type: 'Trial',
        notes: '',
      },

      // Snackbar
      showSnackbar: false,
      snackbarMessage: '',
      snackbarColor: 'success',

      // Options
      membershipTypeOptions: [
        { title: 'Trial', value: 'Trial' },
        { title: 'Full', value: 'Full' },
        { title: 'Junior', value: 'Junior' },
        { title: 'Senior', value: 'Senior' },
        { title: 'Social', value: 'Social' },
      ],
    };
  },
  async mounted() {
    await this.loadCustomer();
  },
  methods: {
    async loadCustomer() {
      this.loading = true;
      try {
        const response = await customerAPI.getById(this.customerId);
        this.customer = response.data.customer || response.data;
      } catch (error) {
        console.error('Error loading customer:', error);
        this.customer = {};
      } finally {
        this.loading = false;
      }
    },

    formatDate(dateString) {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString();
    },

    getMembershipTypeColor(membershipType) {
      const colors = {
        Trial: 'orange',
        Full: 'green',
        Junior: 'blue',
        Senior: 'purple',
        Social: 'teal',
      };
      return colors[membershipType] || 'grey';
    },

    openEditDialog() {
      this.customerData = {
        first_name: this.customer.first_name || '',
        last_name: this.customer.last_name || '',
        email: this.customer.email || '',
        phone: this.customer.phone || '',
        membership_type: this.customer.membership_type || 'Trial',
        notes: this.customer.notes || '',
      };
      this.showEditDialog = true;
    },

    closeEditDialog() {
      this.showEditDialog = false;
      this.customerData = {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        membership_type: 'Trial',
        notes: '',
      };
    },

    async saveCustomer() {
      if (!this.customerFormValid) return;

      this.saving = true;
      try {
        await customerAPI.update(this.customerId, this.customerData);
        this.showNotification('Customer updated successfully');
        this.closeEditDialog();
        await this.loadCustomer(); // Reload to show updated data
      } catch (error) {
        this.showNotification(
          'Error updating customer: ' +
            (error.response?.data?.error || error.message),
          'error'
        );
      } finally {
        this.saving = false;
      }
    },

    confirmDelete() {
      this.showDeleteDialog = true;
    },

    async deleteCustomer() {
      this.deleting = true;
      try {
        await customerAPI.delete(this.customerId);
        this.showNotification('Customer deleted successfully');
        this.showDeleteDialog = false;
        // Navigate back to customers list after successful deletion
        this.$router.push('/customers');
      } catch (error) {
        this.showNotification(
          'Error deleting customer: ' +
            (error.response?.data?.error || error.message),
          'error'
        );
      } finally {
        this.deleting = false;
      }
    },

    showNotification(message, color = 'success') {
      this.snackbarMessage = message;
      this.snackbarColor = color;
      this.showSnackbar = true;
    },
  },
  watch: {
    '$route.params.id': {
      handler(newId) {
        this.customerId = newId;
        this.loadCustomer();
      },
      immediate: false,
    },
  },
};
</script>
