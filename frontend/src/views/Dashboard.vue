<template>
  <v-container>
    <!-- Status Cards Row -->
    <v-row class="mb-4">
      <v-col cols="12" sm="6" md="3">
        <StatusCard
          title="Total Customers"
          :value="dashboardStats.totalCustomers"
          icon="mdi-account-group"
          color="primary"
          :trend="customersTrend"
          action-text="View All"
          @action="$router.push('/customers')"
          data-cy="customers-status-card"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <StatusCard
          title="Active Staff"
          :value="dashboardStats.totalStaff"
          icon="mdi-account-tie"
          color="secondary"
          :trend="staffTrend"
          action-text="Manage Staff"
          @action="$router.push('/staff')"
          data-cy="staff-status-card"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <StatusCard
          title="Course Status"
          :value="dashboardStats.courseStatus"
          icon="mdi-golf"
          color="success"
          subtitle="Operational"
          action-text="View Courses"
          @action="$router.push('/super-admin/courses')"
          data-cy="course-status-card"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <StatusCard
          title="This Month"
          :value="dashboardStats.monthlyBookings"
          icon="mdi-calendar-check"
          color="info"
          subtitle="Bookings"
          :trend="bookingsTrend"
          action-text="View Details"
          @action="showBookingsDetail"
          data-cy="bookings-status-card"
        />
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
                data-cy="manage-customers-btn"
              >
                Manage Customers
              </v-btn>
              <v-btn
                color="secondary"
                prepend-icon="mdi-account-group"
                @click="$router.push('/staff')"
                data-cy="manage-staff-btn"
              >
                Manage Staff
              </v-btn>
              <v-btn
                color="success"
                prepend-icon="mdi-note-plus"
                @click="testCustomersAPI"
                :loading="loading.customers"
                data-cy="test-customers-api-btn"
              >
                Test Customers API
              </v-btn>
              <v-btn
                color="info"
                prepend-icon="mdi-account-supervisor"
                @click="testStaffAPI"
                :loading="loading.staff"
                data-cy="test-staff-api-btn"
              >
                Test Staff API
              </v-btn>
              <v-btn
                color="warning"
                prepend-icon="mdi-refresh"
                @click="loadDashboardData"
                :loading="loading.dashboard"
                data-cy="refresh-dashboard-btn"
              >
                Refresh Dashboard
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

    <!-- Recent Activity -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card class="pa-4">
          <v-card-title>Recent Activity</v-card-title>
          <v-card-text>
            <v-list v-if="recentActivity.length > 0">
              <v-list-item
                v-for="(activity, index) in recentActivity"
                :key="index"
                :prepend-icon="activity.icon"
              >
                <v-list-item-title>{{ activity.title }}</v-list-item-title>
                <v-list-item-subtitle>{{
                  activity.subtitle
                }}</v-list-item-subtitle>
                <template #append>
                  <v-chip :color="activity.color" size="small">
                    {{ activity.status }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center text-medium-emphasis py-8">
              <v-icon icon="mdi-history" size="48" class="mb-2"></v-icon>
              <p>No recent activity</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { customerAPI, staffAPI } from '@/services/api';
import StatusCard from '@/components/StatusCard.vue';

export default {
  name: 'Dashboard',
  components: {
    StatusCard,
  },
  data() {
    return {
      loading: {
        customers: false,
        staff: false,
        dashboard: false,
      },
      apiResponses: [],
      expandedPanel: 0,
      dashboardStats: {
        totalCustomers: 0,
        totalStaff: 0,
        courseStatus: 'Active',
        monthlyBookings: 0,
      },
      recentActivity: [],
    };
  },
  computed: {
    customersTrend() {
      return {
        direction: 'up',
        text: '+12.5% from last month',
      };
    },
    staffTrend() {
      return {
        direction: 'up',
        text: '+2 new this week',
      };
    },
    bookingsTrend() {
      return {
        direction: 'up',
        text: '+8.3% from last month',
      };
    },
  },
  async mounted() {
    await this.loadDashboardData();
  },
  methods: {
    async loadDashboardData() {
      this.loading.dashboard = true;
      try {
        // Load dashboard statistics
        await Promise.all([
          this.loadCustomersCount(),
          this.loadStaffCount(),
          this.loadRecentActivity(),
        ]);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        this.loading.dashboard = false;
      }
    },

    async loadCustomersCount() {
      try {
        const response = await customerAPI.getAll({ limit: 1000 });
        this.dashboardStats.totalCustomers =
          response.data.customers?.length || response.data.length || 0;
      } catch (error) {
        console.error('Error loading customers count:', error);
        this.dashboardStats.totalCustomers = 'N/A';
      }
    },

    async loadStaffCount() {
      try {
        const response = await staffAPI.getAll();
        this.dashboardStats.totalStaff =
          response.data.staff?.length || response.data.length || 0;
      } catch (error) {
        console.error('Error loading staff count:', error);
        this.dashboardStats.totalStaff = 'N/A';
      }
    },

    async loadRecentActivity() {
      // Simulate recent activity data
      this.recentActivity = [
        {
          title: 'New customer registered',
          subtitle: 'John Doe - 2 hours ago',
          icon: 'mdi-account-plus',
          color: 'success',
          status: 'New',
        },
        {
          title: 'Staff member invited',
          subtitle: 'Jane Smith invited as Manager - 4 hours ago',
          icon: 'mdi-email-send',
          color: 'info',
          status: 'Pending',
        },
        {
          title: 'Course status updated',
          subtitle: 'Maintenance completed - 1 day ago',
          icon: 'mdi-golf',
          color: 'success',
          status: 'Active',
        },
      ];
    },

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
          { error: error.response?.data?.error || error.message }
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
          { error: error.response?.data?.error || error.message }
        );
      } finally {
        this.loading.staff = false;
      }
    },

    showBookingsDetail() {
      console.log('Show bookings detail functionality coming soon...');
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
