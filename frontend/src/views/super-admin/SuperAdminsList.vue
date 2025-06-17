<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <h1>Super Admins Management</h1>
          <v-btn color="primary" prepend-icon="mdi-email-plus">
            Invite Super Admin
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <v-card-title>Super Admin Users</v-card-title>
          <v-card-text>
            <v-alert type="info">
              This page will contain super admin user management functionality.
              Coming soon...
            </v-alert>

            <div class="mt-4">
              <v-btn color="secondary" @click="testSuperAdminAPI">
                Test Super Admin API
              </v-btn>
            </div>

            <div v-if="lastApiResponse" class="mt-4">
              <h4>Last API Response:</h4>
              <pre class="mt-2 pa-2 bg-grey-lighten-4 rounded">{{
                lastApiResponse
              }}</pre>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { superAdminAPI } from '@/services/api';

export default {
  name: 'SuperAdminsList',
  data() {
    return {
      lastApiResponse: '',
    };
  },
  methods: {
    async testSuperAdminAPI() {
      try {
        console.log('Testing Super Admin API...');
        const response = await superAdminAPI.getSuperAdmins();

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Super Admin API response:', response.data);
      } catch (error) {
        console.error('Super Admin API error:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      }
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
