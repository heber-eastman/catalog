<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <h1>Customers</h1>
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            @click="showCreateDialog = true"
          >
            Add Customer
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Customers Table -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-text-field
              v-model="search"
              append-inner-icon="mdi-magnify"
              label="Search customers..."
              single-line
              hide-details
              class="ma-2"
              @input="searchCustomers"
            />
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="customers"
            :loading="loading"
            :search="search"
            class="elevation-1"
          >
            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-eye"
                size="small"
                variant="text"
                @click="viewCustomer(item)"
              />
              <v-btn
                icon="mdi-pencil"
                size="small"
                variant="text"
                @click="editCustomer(item)"
              />
              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                color="error"
                @click="deleteCustomer(item)"
              />
            </template>

            <template #no-data>
              <v-alert type="info" class="ma-4">
                No customers found. Add your first customer to get started!
              </v-alert>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- API Test Section -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>API Test Results</v-card-title>
          <v-card-text>
            <div class="d-flex ga-2 mb-4">
              <v-btn color="primary" @click="loadCustomers" :loading="loading">
                Reload Customers
              </v-btn>
              <v-btn color="secondary" @click="testCreateCustomer">
                Test Create Customer
              </v-btn>
            </div>

            <div v-if="lastApiResponse">
              <h4>Last API Response:</h4>
              <pre class="mt-2 pa-2 bg-grey-lighten-4 rounded">{{
                lastApiResponse
              }}</pre>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create Customer Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="600px">
      <v-card>
        <v-card-title>Add New Customer</v-card-title>
        <v-card-text>
          <v-form ref="createForm" v-model="createFormValid">
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="newCustomer.first_name"
                  label="First Name"
                  :rules="[v => !!v || 'First name is required']"
                  required
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="newCustomer.last_name"
                  label="Last Name"
                  :rules="[v => !!v || 'Last name is required']"
                  required
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="newCustomer.email"
              label="Email"
              type="email"
              :rules="[
                v => !!v || 'Email is required',
                v => /.+@.+\..+/.test(v) || 'Email must be valid',
              ]"
              required
            />
            <v-text-field v-model="newCustomer.phone" label="Phone" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showCreateDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            @click="createCustomer"
            :disabled="!createFormValid"
            :loading="creating"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import { customerAPI } from '@/services/api';

export default {
  name: 'CustomersList',
  data() {
    return {
      customers: [],
      loading: false,
      creating: false,
      search: '',
      showCreateDialog: false,
      createFormValid: false,
      lastApiResponse: '',
      newCustomer: {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
      },
      headers: [
        { title: 'Name', key: 'full_name' },
        { title: 'Email', key: 'email' },
        { title: 'Phone', key: 'phone' },
        { title: 'Created', key: 'created_at' },
        { title: 'Actions', key: 'actions', sortable: false },
      ],
    };
  },
  async mounted() {
    await this.loadCustomers();
  },
  methods: {
    async loadCustomers() {
      this.loading = true;
      try {
        console.log('Loading customers...');
        const response = await customerAPI.getAll();
        this.customers = response.data.customers || response.data || [];

        // Add computed full_name property
        this.customers = this.customers.map(customer => ({
          ...customer,
          full_name: `${customer.first_name} ${customer.last_name}`,
        }));

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Customers loaded:', response.data);
      } catch (error) {
        console.error('Error loading customers:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      } finally {
        this.loading = false;
      }
    },

    async createCustomer() {
      if (!this.createFormValid) return;

      this.creating = true;
      try {
        console.log('Creating customer:', this.newCustomer);
        const response = await customerAPI.create(this.newCustomer);

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Customer created:', response.data);

        // Close dialog and reload customers
        this.showCreateDialog = false;
        this.newCustomer = {
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
        };
        await this.loadCustomers();
      } catch (error) {
        console.error('Error creating customer:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      } finally {
        this.creating = false;
      }
    },

    async testCreateCustomer() {
      const testCustomer = {
        first_name: 'Test',
        last_name: 'Customer',
        email: `test.customer.${Date.now()}@example.com`,
        phone: '555-0123',
      };

      try {
        console.log('Testing create customer API with:', testCustomer);
        const response = await customerAPI.create(testCustomer);

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Test customer created:', response.data);

        // Reload customers to show the new one
        await this.loadCustomers();
      } catch (error) {
        console.error('Error in test create customer:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      }
    },

    searchCustomers() {
      // Search is handled by v-data-table automatically
      console.log('Searching customers for:', this.search);
    },

    viewCustomer(customer) {
      console.log('View customer:', customer);
      this.$router.push(`/customers/${customer.id}`);
    },

    editCustomer(customer) {
      console.log('Edit customer:', customer);
      // TODO: Implement edit functionality
    },

    deleteCustomer(customer) {
      console.log('Delete customer:', customer);
      // TODO: Implement delete functionality
    },
  },
};
</script>

<style scoped>
pre {
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
}
</style>
