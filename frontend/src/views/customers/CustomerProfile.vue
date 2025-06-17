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
              
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-calendar" />
                </template>
                <v-list-item-title>{{ formatDate(customer.created_at) }}</v-list-item-title>
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
              <v-btn color="primary" prepend-icon="mdi-pencil">
                Edit Customer
              </v-btn>
              <v-btn color="error" variant="outlined" prepend-icon="mdi-delete">
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
        <v-icon icon="mdi-account-off" size="64" class="mb-2 text-medium-emphasis" />
        <h2 class="mb-2">Customer Not Found</h2>
        <p class="text-medium-emphasis mb-4">The customer you're looking for doesn't exist or may have been deleted.</p>
        <v-btn color="primary" @click="$router.push('/customers')">
          Back to Customers
        </v-btn>
      </v-col>
    </v-row>
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