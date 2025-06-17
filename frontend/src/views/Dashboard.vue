<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>Dashboard</h1>
        <p>Welcome to your golf course management system!</p>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <v-card class="pa-4">
          <v-card-title>Quick Actions</v-card-title>
          <v-card-text>
            <div class="d-flex flex-column ga-3">
              <v-btn
                color="primary"
                prepend-icon="mdi-account-plus"
                @click="$router.push('/customers')"
              >
                Manage Customers
              </v-btn>
              <v-btn
                color="secondary"
                prepend-icon="mdi-account-group"
                @click="$router.push('/staff')"
              >
                Manage Staff
              </v-btn>
              <v-btn
                color="success"
                prepend-icon="mdi-note-plus"
                @click="testCustomersAPI"
                :loading="loading.customers"
              >
                Test Customers API
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="pa-4">
          <v-card-title>API Test Results</v-card-title>
          <v-card-text>
            <div v-if="apiResponses.length === 0" class="text-medium-emphasis">
              Click the buttons to test API endpoints
            </div>
            <div v-else>
              <v-expansion-panels v-model="expandedPanel">
                <v-expansion-panel
                  v-for="(response, index) in apiResponses"
                  :key="index"
                  :title="`${response.method} ${response.endpoint}`"
                  :text="response.timestamp"
                >
                  <v-expansion-panel-text>
                    <div class="pa-2">
                      <h4>Status: {{ response.status }}</h4>
                      <pre class="mt-2 pa-2 bg-grey-lighten-4 rounded">{{
                        response.data
                      }}</pre>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { customerAPI, staffAPI } from '@/services/api';

export default {
  name: 'Dashboard',
  data() {
    return {
      loading: {
        customers: false,
        staff: false,
        notes: false,
      },
      apiResponses: [],
      expandedPanel: 0,
    };
  },
  methods: {
    async testCustomersAPI() {
      this.loading.customers = true;

      try {
        console.log('Testing Customers API...');
        const response = await customerAPI.getAll({ limit: 5 });

        this.logAPIResponse(
          'GET',
          '/customers',
          response.status,
          response.data
        );
        console.log('Customers API response:', response.data);
      } catch (error) {
        console.error('Customers API error:', error);
        this.logAPIResponse(
          'GET',
          '/customers',
          error.response?.status || 'Error',
          {
            error: error.response?.data?.error || error.message,
          }
        );
      } finally {
        this.loading.customers = false;
      }
    },

    async testStaffAPI() {
      this.loading.staff = true;

      try {
        console.log('Testing Staff API...');
        const response = await staffAPI.getAll();

        this.logAPIResponse('GET', '/staff', response.status, response.data);
        console.log('Staff API response:', response.data);
      } catch (error) {
        console.error('Staff API error:', error);
        this.logAPIResponse(
          'GET',
          '/staff',
          error.response?.status || 'Error',
          {
            error: error.response?.data?.error || error.message,
          }
        );
      } finally {
        this.loading.staff = false;
      }
    },

    logAPIResponse(method, endpoint, status, data) {
      this.apiResponses.unshift({
        method,
        endpoint,
        status,
        data: JSON.stringify(data, null, 2),
        timestamp: new Date().toLocaleTimeString(),
      });

      // Keep only last 10 responses
      if (this.apiResponses.length > 10) {
        this.apiResponses = this.apiResponses.slice(0, 10);
      }

      // Expand the first panel to show the latest response
      this.expandedPanel = 0;
    },
  },
};
</script>

<style scoped>
pre {
  font-size: 12px;
  max-height: 200px;
  overflow: auto;
}
</style>
