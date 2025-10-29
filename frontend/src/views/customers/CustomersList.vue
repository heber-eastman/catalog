<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <h1>Customers</h1>
          <div class="d-flex ga-2">
            <v-btn
              color="success"
              prepend-icon="'fa:fal fa-file-import'"
              @click="showImportDialog = true"
              data-cy="import-customers-btn"
            >
              Import
            </v-btn>
            <v-btn
              color="info"
              prepend-icon="'fa:fal fa-file-export'"
              @click="showExportDialog = true"
              data-cy="export-customers-btn"
            >
              Export
            </v-btn>
            <v-btn
              color="primary"
              prepend-icon="'fa:fal fa-plus'"
              @click="showCreateDialog = true"
              data-cy="add-customer-btn"
            >
              Add Customer
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Filters Row -->
    <v-row class="mb-4">
      <v-col cols="12" md="4">
        <v-text-field
          v-model="search"
          prepend-inner-icon="fa:fal fa-magnifying-glass"
          label="Search customers..."
          single-line
          hide-details
          clearable
          data-cy="search-customers"
          @input="debouncedSearch"
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-select
          v-model="membershipFilter"
          :items="membershipTypeOptions"
          label="Membership Filter"
          clearable
          hide-details
          data-cy="membership-filter"
          @update:model-value="applyFilters"
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-select
          v-model="sortBy"
          :items="sortOptions"
          label="Sort By"
          hide-details
          data-cy="sort-by"
          @update:model-value="applySorting"
        />
      </v-col>
      <v-col cols="12" md="2">
        <v-btn
          variant="outlined"
          prepend-icon="'fa:fal fa-filter-circle-xmark'"
          @click="clearFilters"
          data-cy="clear-filters-btn"
        >
          Clear
        </v-btn>
      </v-col>
    </v-row>

    <!-- Customers Table -->
    <v-row>
      <v-col cols="12" class="pa-0">
        <v-card variant="text" class="pa-0">

          <v-data-table
            :headers="headers"
            :items="filteredCustomers"
            :loading="loading"
            :search="search"
            hide-default-footer
            :items-per-page="-1"
            class="elevation-1"
            data-cy="customers-table"
          >
            <template #item="{ item }">
              <tr
                class="clickable-row"
                @click="viewCustomer(item)"
                data-cy="customer-row"
              >
                <td>
                  <div class="d-flex align-center">
                    <v-avatar size="32" class="mr-2" color="primary">
                      <v-icon icon="fa:fal fa-user" />
                    </v-avatar>
                    <div>
                      <div class="font-weight-medium">{{ item.full_name }}</div>
                      <div class="text-caption text-medium-emphasis">
                        ID: {{ item.id }}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{{ item.email }}</td>
                <td>{{ item.phone }}</td>
                <td>
                  <v-chip
                    :color="getMembershipTypeColor(item.membership_type)"
                    size="small"
                    data-cy="customer-membership-chip"
                  >
                    {{ item.membership_type || 'Trial' }}
                  </v-chip>
                </td>
                <td>{{ formatDate(item.created_at) }}</td>
              </tr>
            </template>

            <template #no-data>
              <div class="text-center pa-6">
                <v-icon
                  icon="fa:fal fa-users"
                  size="64"
                  class="mb-2 text-medium-emphasis"
                />
                <p class="text-h6 mb-2">No customers found</p>
                <p class="text-medium-emphasis mb-4">
                  {{
                    search
                      ? 'Try adjusting your search or filters'
                      : 'Add your first customer to get started!'
                  }}
                </p>
                <v-btn color="primary" @click="showCreateDialog = true">
                  Add Customer
                </v-btn>
              </div>
            </template>
          </v-data-table>
          <!-- Infinite scroll sentinel -->
          <div ref="infiniteSentinel" style="height: 1px"></div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create/Edit Customer Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="700px">
      <v-card>
        <v-card-title>{{
          editingCustomer ? 'Edit Customer' : 'Add New Customer'
        }}</v-card-title>
        <v-card-text>
          <v-form ref="customerForm" v-model="customerFormValid">
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="customerData.first_name"
                  label="First Name *"
                  :rules="[v => !!v || 'First name is required']"
                  required
                  data-cy="customer-first-name"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="customerData.last_name"
                  label="Last Name *"
                  :rules="[v => !!v || 'Last name is required']"
                  required
                  data-cy="customer-last-name"
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
              data-cy="customer-email"
            />
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="customerData.phone"
                  label="Phone"
                  data-cy="customer-phone"
                />
              </v-col>
              <v-col cols="6">
                <v-select
                  v-model="customerData.membership_type"
                  :items="membershipTypeOptions"
                  label="Membership Type *"
                  :rules="[v => !!v || 'Membership type is required']"
                  required
                  data-cy="customer-membership-type-select"
                />
              </v-col>
            </v-row>
            <v-textarea
              v-model="customerData.notes"
              label="Notes"
              rows="3"
              data-cy="customer-notes"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeCustomerDialog" data-cy="cancel-customer-btn"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            @click="saveCustomer"
            :disabled="!customerFormValid"
            :loading="saving"
            data-cy="save-customer-btn"
          >
            {{ editingCustomer ? 'Update' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Import Dialog -->
    <v-dialog v-model="showImportDialog" max-width="600px">
      <v-card>
        <v-card-title>Import Customers</v-card-title>
        <v-card-text>
          <div class="mb-4">
            <p class="text-subtitle-1 mb-2">
              Upload CSV file with customer data
            </p>
            <p class="text-caption text-medium-emphasis">
              Required columns: first_name, last_name, email<br />
              Optional columns: phone, status, notes
            </p>
          </div>

          <v-file-input
            v-model="importFile"
            label="Select CSV file"
            accept=".csv"
            prepend-icon="'fa:fal fa-file-csv'"
            show-size
            data-cy="import-file-input"
          />

          <v-alert v-if="importPreview.length > 0" type="info" class="mt-3">
            Found {{ importPreview.length }} customers in file
          </v-alert>

          <div v-if="importErrors.length > 0" class="mt-3">
            <v-alert type="error">
              Import validation errors:
              <ul class="mt-2">
                <li v-for="error in importErrors" :key="error">{{ error }}</li>
              </ul>
            </v-alert>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeImportDialog" data-cy="cancel-import-btn"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            @click="processImport"
            :disabled="!importFile || importErrors.length > 0"
            :loading="importing"
            data-cy="process-import-btn"
          >
            Import
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Export Dialog -->
    <v-dialog v-model="showExportDialog" max-width="500px">
      <v-card>
        <v-card-title>Export Customers</v-card-title>
        <v-card-text>
          <div class="mb-4">
            <p class="text-subtitle-1 mb-2">Export Options</p>
          </div>

          <v-radio-group v-model="exportType" data-cy="export-type">
            <v-radio label="All customers" value="all" />
            <v-radio
              label="Selected customers only"
              value="selected"
              :disabled="selectedCustomers.length === 0"
            />
            <v-radio label="Filtered customers" value="filtered" />
          </v-radio-group>

          <v-select
            v-model="exportFormat"
            :items="exportFormats"
            label="Format"
            data-cy="export-format"
          />

          <div class="mt-3">
            <p class="text-caption">
              {{ getExportDescription() }}
            </p>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showExportDialog = false" data-cy="cancel-export-btn"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            @click="processExport"
            :loading="exporting"
            data-cy="process-export-btn"
          >
            Export
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Bulk Delete Confirmation Dialog -->
    <v-dialog v-model="showBulkDeleteDialog" max-width="400px">
      <v-card>
        <v-card-title>Confirm Bulk Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete
          {{ selectedCustomers.length }} selected customers? This action cannot
          be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showBulkDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="processBulkDelete" :loading="deleting">
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar for notifications -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" timeout="4000">
      {{ snackbarMessage }}
      <template #actions>
        <v-btn @click="showSnackbar = false" icon="fa:fal fa-xmark" />
      </template>
    </v-snackbar>
  </v-container>
</template>

<script>
import { customerAPI } from '@/services/api';
import { debounce } from 'lodash-es';

export default {
  name: 'CustomersList',
  data() {
    return {
      customers: [],
      filteredCustomers: [],
      selectedCustomers: [],
      loading: false,
      saving: false,
      importing: false,
      exporting: false,
      deleting: false,
      search: '',
      membershipFilter: null,
      sortBy: 'created_at_desc',
      debouncedSearch: null, // Initialize here to avoid Vue warnings

      // Dialog states
      showCreateDialog: false,
      showImportDialog: false,
      showExportDialog: false,
      showBulkDeleteDialog: false,

      // Form data
      customerFormValid: false,
      editingCustomer: null,
      customerData: {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        membership_type: 'Trial',
        notes: '',
      },

      // Import/Export data
      importFile: null,
      importPreview: [],
      importErrors: [],
      exportType: 'all',
      exportFormat: 'csv',

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
      sortOptions: [
        { title: 'Name (A-Z)', value: 'name_asc' },
        { title: 'Name (Z-A)', value: 'name_desc' },
        { title: 'Email (A-Z)', value: 'email_asc' },
        { title: 'Email (Z-A)', value: 'email_desc' },
        { title: 'Newest First', value: 'created_at_desc' },
        { title: 'Oldest First', value: 'created_at_asc' },
      ],
      exportFormats: [
        { title: 'CSV', value: 'csv' },
        { title: 'Excel', value: 'xlsx' },
        { title: 'JSON', value: 'json' },
      ],

      headers: [
        { title: 'Customer', key: 'full_name', sortable: true },
        { title: 'Email', key: 'email', sortable: true },
        { title: 'Phone', key: 'phone', sortable: true },
        { title: 'Membership', key: 'membership_type', sortable: true },
        { title: 'Created', key: 'created_at', sortable: true },
      ],

      // Infinite scroll state
      page: 1,
      limit: 50,
      moreAvailable: true,
      observer: null,
    };
  },
  async mounted() {
    await this.resetAndLoad();
    this.debouncedSearch = debounce(this.performSearch, 300);

    // Setup intersection observer for infinite scroll
    try {
      this.observer = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (e.isIntersecting) this.loadNextPage();
        }
      }, { root: null, rootMargin: '800px 0px 800px 0px', threshold: 0 });
      if (this.$refs.infiniteSentinel) this.observer.observe(this.$refs.infiniteSentinel);
    } catch (_) {}
  },
  methods: {
    async loadCustomers() {
      this.loading = true;
      try {
        const params = {
          page: this.page,
          limit: this.limit,
          search: this.search || undefined,
          membership_type: this.membershipFilter || undefined,
          sort: 'created_at',
          order: 'DESC',
        };
        const response = await customerAPI.getAll(params);
        const items = (response.data.customers || response.data || []).map(c => ({
          ...c,
          full_name: `${c.first_name} ${c.last_name}`,
        }));
        if (this.page === 1) this.customers = items; else this.customers.push(...items);
        this.moreAvailable = items.length >= this.limit;
        this.applyFilters();
      } catch (error) {
        this.showNotification(
          'Error loading customers: ' +
            (error.response?.data?.error || error.message),
          'error'
        );
      } finally {
        this.loading = false;
      }
    },

    async resetAndLoad() {
      this.page = 1;
      this.moreAvailable = true;
      await this.loadCustomers();
    },

    async loadNextPage() {
      if (this.loading || !this.moreAvailable) return;
      this.page += 1;
      await this.loadCustomers();
    },

    applyFilters() {
      let filtered = [...this.customers];

      // Apply membership filter
      if (this.membershipFilter) {
        filtered = filtered.filter(
          customer => customer.membership_type === this.membershipFilter
        );
      }

      // Apply search filter
      if (this.search) {
        const searchLower = this.search.toLowerCase();
        filtered = filtered.filter(
          customer =>
            customer.full_name.toLowerCase().includes(searchLower) ||
            customer.email.toLowerCase().includes(searchLower) ||
            customer.phone?.toLowerCase().includes(searchLower)
        );
      }

      this.filteredCustomers = filtered;
      this.applySorting();
    },

    applySorting() {
      const [field, direction] = this.sortBy.split('_');
      const isAsc = direction === 'asc';

      this.filteredCustomers.sort((a, b) => {
        let aVal, bVal;

        switch (field) {
          case 'name':
            aVal = a.full_name;
            bVal = b.full_name;
            break;
          case 'email':
            aVal = a.email;
            bVal = b.email;
            break;
          case 'created':
            aVal = new Date(a.created_at);
            bVal = new Date(b.created_at);
            break;
          default:
            aVal = a[field];
            bVal = b[field];
        }

        if (aVal < bVal) return isAsc ? -1 : 1;
        if (aVal > bVal) return isAsc ? 1 : -1;
        return 0;
      });
    },

    performSearch() {
      this.resetAndLoad();
    },

    clearFilters() {
      this.search = '';
      this.membershipFilter = null;
      this.sortBy = 'created_at_desc';
      this.resetAndLoad();
    },

    viewCustomer(customer) {
      this.$router.push(`/customers/${customer.id}`);
    },

    editCustomer(customer) {
      this.editingCustomer = customer;
      this.customerData = { ...customer };
      this.showCreateDialog = true;
    },

    async deleteCustomer(customer) {
      if (confirm(`Are you sure you want to delete ${customer.full_name}?`)) {
        try {
          await customerAPI.delete(customer.id);
          this.showNotification('Customer deleted successfully');
          await this.loadCustomers();
        } catch (error) {
          this.showNotification(
            'Error deleting customer: ' +
              (error.response?.data?.error || error.message),
            'error'
          );
        }
      }
    },

    async saveCustomer() {
      if (!this.customerFormValid) return;

      this.saving = true;
      try {
        if (this.editingCustomer) {
          await customerAPI.update(this.editingCustomer.id, this.customerData);
          this.showNotification('Customer updated successfully');
        } else {
          await customerAPI.create(this.customerData);
          this.showNotification('Customer created successfully');
        }

        this.closeCustomerDialog();
        await this.loadCustomers();
      } catch (error) {
        this.showNotification(
          'Error saving customer: ' +
            (error.response?.data?.error || error.message),
          'error'
        );
      } finally {
        this.saving = false;
      }
    },

    closeCustomerDialog() {
      this.showCreateDialog = false;
      this.editingCustomer = null;
      this.customerData = {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        membership_type: 'Trial',
        notes: '',
      };
    },

    // Import functionality
    async processImport() {
      if (!this.importFile) return;

      this.importing = true;
      try {
        // In a real app, this would parse CSV and validate data
        // For now, we'll simulate the process

        const text = await this.importFile.text();
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());

        this.importErrors = [];
        this.importPreview = [];

        // Validate headers
        const requiredHeaders = ['first_name', 'last_name', 'email'];
        const missingHeaders = requiredHeaders.filter(
          h => !headers.includes(h)
        );
        if (missingHeaders.length > 0) {
          this.importErrors.push(
            `Missing required columns: ${missingHeaders.join(', ')}`
          );
          return;
        }

        // Process data rows
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const customer = {};

          headers.forEach((header, index) => {
            customer[header] = values[index] || '';
          });

          // Validate required fields
          if (!customer.first_name || !customer.last_name || !customer.email) {
            this.importErrors.push(`Row ${i + 1}: Missing required fields`);
            continue;
          }

          // Validate email format
          if (!/\S+@\S+\.\S+/.test(customer.email)) {
            this.importErrors.push(`Row ${i + 1}: Invalid email format`);
            continue;
          }

          this.importPreview.push(customer);
        }

        if (this.importErrors.length === 0) {
          // Process import (simulate API calls)
          for (const customer of this.importPreview) {
            await customerAPI.create(customer);
          }

          this.showNotification(
            `Successfully imported ${this.importPreview.length} customers`
          );
          this.closeImportDialog();
          await this.loadCustomers();
        }
      } catch (error) {
        this.showNotification(
          'Error processing import: ' + error.message,
          'error'
        );
      } finally {
        this.importing = false;
      }
    },

    closeImportDialog() {
      this.showImportDialog = false;
      this.importFile = null;
      this.importPreview = [];
      this.importErrors = [];
    },

    // Export functionality
    getExportDescription() {
      const counts = {
        all: this.customers.length,
        filtered: this.filteredCustomers.length,
      };
      const key = this.exportType === 'all' ? 'all' : 'filtered';
      return `This will export ${counts[key]} customers in ${this.exportFormat.toUpperCase()} format.`;
    },

    async processExport() {
      this.exporting = true;
      try {
        let dataToExport = [];

        switch (this.exportType) {
          case 'all':
            dataToExport = this.customers;
            break;
          case 'selected':
            dataToExport = this.customers.filter(c =>
              this.selectedCustomers.includes(c.id)
            );
            break;
          case 'filtered':
            dataToExport = this.filteredCustomers;
            break;
        }

        // In a real app, you'd generate and download the file
        // For now, we'll just simulate the process

        const blob = this.generateExportFile(dataToExport);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_export_${new Date().toISOString().split('T')[0]}.${this.exportFormat}`;
        a.click();

        this.showNotification(
          `Successfully exported ${dataToExport.length} customers`
        );
        this.showExportDialog = false;
      } catch (error) {
        this.showNotification(
          'Error processing export: ' + error.message,
          'error'
        );
      } finally {
        this.exporting = false;
      }
    },

    generateExportFile(data) {
      switch (this.exportFormat) {
        case 'csv':
          return this.generateCSV(data);
        case 'json':
          return new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json',
          });
        default:
          return this.generateCSV(data);
      }
    },

    generateCSV(data) {
      const headers = [
        'ID',
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Status',
        'Created',
      ];
      const csvContent = [
        headers.join(','),
        ...data.map(customer =>
          [
            customer.id,
            customer.first_name,
            customer.last_name,
            customer.email,
            customer.phone || '',
            customer.status || 'Active',
            customer.created_at,
          ].join(',')
        ),
      ].join('\n');

      return new Blob([csvContent], { type: 'text/csv' });
    },

    async processBulkDelete() {
      this.deleting = true;
      try {
        // In a real app, you'd have a bulk delete API
        for (const customerId of this.selectedCustomers) {
          await customerAPI.delete(customerId);
        }

        this.showNotification(
          `Successfully deleted ${this.selectedCustomers.length} customers`
        );
        this.selectedCustomers = [];
        this.showBulkDeleteDialog = false;
        await this.loadCustomers();
      } catch (error) {
        this.showNotification(
          'Error deleting customers: ' +
            (error.response?.data?.error || error.message),
          'error'
        );
      } finally {
        this.deleting = false;
      }
    },

    getMembershipTypeColor(membershipType) {
      switch (membershipType) {
        case 'Full':
          return 'success';
        case 'Trial':
          return 'info';
        case 'Junior':
          return 'purple';
        case 'Senior':
          return 'orange';
        case 'Social':
          return 'blue';
        default:
          return 'primary';
      }
    },

    formatDate(dateString) {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString();
    },

    showNotification(message, color = 'success') {
      this.snackbarMessage = message;
      this.snackbarColor = color;
      this.showSnackbar = true;
    },

    toggleCustomerSelection(customerId, isSelected) {
      const index = this.selectedCustomers.indexOf(customerId);
      if (isSelected) {
        if (index === -1) {
          this.selectedCustomers.push(customerId);
        }
      } else {
        if (index !== -1) {
          this.selectedCustomers.splice(index, 1);
        }
      }
    },
  },
};
</script>

<style scoped>
.v-data-table {
  background: transparent;
}

/* Clickable row styles */
.clickable-row {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.clickable-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04) !important;
  box-shadow: inset 2px 0 0 rgba(var(--v-theme-primary), 0.3);
}

/* Ensure checkbox area doesn't interfere with row click */
.clickable-row td:first-child {
  pointer-events: auto;
}

.clickable-row td:first-child .v-checkbox-btn {
  pointer-events: auto;
}

/* Make sure the row styling works with Vuetify's table */
.v-data-table__wrapper table tbody tr.clickable-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04) !important;
}
</style>
