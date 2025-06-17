<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <h1>Staff Management</h1>
          <v-btn
            color="primary"
            prepend-icon="mdi-email-plus"
            @click="showInviteDialog = true"
          >
            Invite Staff Member
          </v-btn>
        </div>
      </v-col>
    </v-row>
    
    <!-- Staff Table -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-text-field
              v-model="search"
              append-inner-icon="mdi-magnify"
              label="Search staff..."
              single-line
              hide-details
              class="ma-2"
            />
          </v-card-title>
          
          <v-data-table
            :headers="headers"
            :items="staff"
            :loading="loading"
            :search="search"
            class="elevation-1"
          >
            <template #item.role="{ item }">
              <v-chip
                :color="getRoleColor(item.role)"
                size="small"
              >
                {{ item.role }}
              </v-chip>
            </template>
            
            <template #item.is_active="{ item }">
              <v-chip
                :color="item.is_active ? 'success' : 'error'"
                size="small"
              >
                {{ item.is_active ? 'Active' : 'Inactive' }}
              </v-chip>
            </template>
            
            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-pencil"
                size="small"
                variant="text"
                @click="editStaff(item)"
              />
              <v-btn
                icon="mdi-account-off"
                size="small"
                variant="text"
                color="error"
                @click="deactivateStaff(item)"
                :disabled="!item.is_active"
              />
            </template>
            
            <template #no-data>
              <v-alert type="info" class="ma-4">
                No staff members found. Invite your first staff member to get started!
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
          <v-card-title>Staff API Test Results</v-card-title>
          <v-card-text>
            <div class="d-flex ga-2 mb-4">
              <v-btn
                color="primary"
                @click="loadStaff"
                :loading="loading"
              >
                Reload Staff
              </v-btn>
              <v-btn
                color="secondary"
                @click="testInviteStaff"
              >
                Test Invite Staff
              </v-btn>
            </div>
            
            <div v-if="lastApiResponse">
              <h4>Last API Response:</h4>
              <pre class="mt-2 pa-2 bg-grey-lighten-4 rounded">{{ lastApiResponse }}</pre>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    
    <!-- Invite Staff Dialog -->
    <v-dialog v-model="showInviteDialog" max-width="600px">
      <v-card>
        <v-card-title>Invite Staff Member</v-card-title>
        <v-card-text>
          <v-form ref="inviteForm" v-model="inviteFormValid">
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="newStaff.first_name"
                  label="First Name"
                  :rules="[v => !!v || 'First name is required']"
                  required
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="newStaff.last_name"
                  label="Last Name"
                  :rules="[v => !!v || 'Last name is required']"
                  required
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="newStaff.email"
              label="Email"
              type="email"
              :rules="[v => !!v || 'Email is required', v => /.+@.+\..+/.test(v) || 'Email must be valid']"
              required
            />
            <v-select
              v-model="newStaff.role"
              label="Role"
              :items="roleOptions"
              :rules="[v => !!v || 'Role is required']"
              required
            />
            <v-text-field
              v-model="newStaff.phone"
              label="Phone"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showInviteDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            @click="inviteStaff"
            :disabled="!inviteFormValid"
            :loading="inviting"
          >
            Send Invitation
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import { staffAPI } from '@/services/api';

export default {
  name: 'StaffList',
  data() {
    return {
      staff: [],
      loading: false,
      inviting: false,
      search: '',
      showInviteDialog: false,
      inviteFormValid: false,
      lastApiResponse: '',
      newStaff: {
        first_name: '',
        last_name: '',
        email: '',
        role: '',
        phone: '',
      },
      roleOptions: [
        { title: 'Staff', value: 'Staff' },
        { title: 'Manager', value: 'Manager' },
        { title: 'Admin', value: 'Admin' },
      ],
      headers: [
        { title: 'Name', key: 'full_name' },
        { title: 'Email', key: 'email' },
        { title: 'Role', key: 'role' },
        { title: 'Phone', key: 'phone' },
        { title: 'Status', key: 'is_active' },
        { title: 'Actions', key: 'actions', sortable: false },
      ],
    };
  },
  async mounted() {
    await this.loadStaff();
  },
  methods: {
    async loadStaff() {
      this.loading = true;
      try {
        console.log('Loading staff...');
        const response = await staffAPI.getAll();
        this.staff = response.data.staff || response.data || [];
        
        // Add computed full_name property
        this.staff = this.staff.map(staffMember => ({
          ...staffMember,
          full_name: `${staffMember.first_name} ${staffMember.last_name}`,
        }));
        
        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Staff loaded:', response.data);
        
      } catch (error) {
        console.error('Error loading staff:', error);
        this.lastApiResponse = JSON.stringify({
          error: error.response?.data?.error || error.message
        }, null, 2);
      } finally {
        this.loading = false;
      }
    },
    
    async inviteStaff() {
      if (!this.inviteFormValid) return;
      
      this.inviting = true;
      try {
        console.log('Inviting staff member:', this.newStaff);
        const response = await staffAPI.invite(this.newStaff);
        
        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Staff invitation sent:', response.data);
        
        // Close dialog and reload staff
        this.showInviteDialog = false;
        this.newStaff = { first_name: '', last_name: '', email: '', role: '', phone: '' };
        await this.loadStaff();
        
      } catch (error) {
        console.error('Error inviting staff:', error);
        this.lastApiResponse = JSON.stringify({
          error: error.response?.data?.error || error.message
        }, null, 2);
      } finally {
        this.inviting = false;
      }
    },
    
    async testInviteStaff() {
      const testStaff = {
        first_name: 'Test',
        last_name: 'Staff',
        email: `test.staff.${Date.now()}@example.com`,
        role: 'Staff',
        phone: '555-0123',
      };
      
      try {
        console.log('Testing invite staff API with:', testStaff);
        const response = await staffAPI.invite(testStaff);
        
        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Test staff invitation sent:', response.data);
        
        // Reload staff to show the new one
        await this.loadStaff();
        
      } catch (error) {
        console.error('Error in test invite staff:', error);
        this.lastApiResponse = JSON.stringify({
          error: error.response?.data?.error || error.message
        }, null, 2);
      }
    },
    
    getRoleColor(role) {
      const colors = {
        'Admin': 'error',
        'Manager': 'warning',
        'Staff': 'info',
      };
      return colors[role] || 'default';
    },
    
    editStaff(staff) {
      console.log('Edit staff:', staff);
      // TODO: Implement edit functionality
    },
    
    async deactivateStaff(staff) {
      if (!confirm(`Are you sure you want to deactivate ${staff.full_name}?`)) {
        return;
      }
      
      try {
        console.log('Deactivating staff:', staff);
        const response = await staffAPI.deactivate(staff.id);
        
        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Staff deactivated:', response.data);
        
        // Reload staff to show updated status
        await this.loadStaff();
        
      } catch (error) {
        console.error('Error deactivating staff:', error);
        this.lastApiResponse = JSON.stringify({
          error: error.response?.data?.error || error.message
        }, null, 2);
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