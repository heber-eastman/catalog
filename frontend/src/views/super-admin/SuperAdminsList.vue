<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <h1>Super Admins Management</h1>
          <v-btn
            color="primary"
            prepend-icon="mdi-email-plus"
            @click="showInviteDialog = true"
            data-cy="invite-super-admin-btn"
          >
            Invite Super Admin
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Super Admins Table -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-text-field
              v-model="search"
              append-inner-icon="mdi-magnify"
              label="Search super admins..."
              single-line
              hide-details
              class="ma-2"
              data-cy="super-admin-search"
            />
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="superAdmins"
            :loading="loading"
            :search="search"
            class="elevation-1"
          >
            <template #item.status="{ item }">
              <v-chip
                :color="item.is_active ? 'success' : 'error'"
                size="small"
              >
                {{ item.is_active ? 'Active' : 'Inactive' }}
              </v-chip>
            </template>

            <template #item.invitation_status="{ item }">
              <v-chip
                :color="getInvitationStatusColor(item.invitation_status)"
                size="small"
              >
                {{ item.invitation_status || 'Accepted' }}
              </v-chip>
            </template>

            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-pencil"
                size="small"
                variant="text"
                @click="editSuperAdmin(item)"
                data-cy="edit-super-admin-btn"
              />
              <v-btn
                icon="mdi-email-resend"
                size="small"
                variant="text"
                color="info"
                @click="resendInvitation(item)"
                :disabled="item.invitation_status === 'accepted'"
                data-cy="resend-invitation-btn"
              />
              <v-btn
                icon="mdi-email-remove"
                size="small"
                variant="text"
                color="warning"
                @click="revokeInvitation(item)"
                :disabled="item.invitation_status === 'accepted'"
                data-cy="revoke-invitation-btn"
              />
              <v-btn
                icon="mdi-account-off"
                size="small"
                variant="text"
                color="error"
                @click="deactivateSuperAdmin(item)"
                :disabled="!item.is_active"
                data-cy="deactivate-super-admin-btn"
              />
            </template>

            <template #no-data>
              <v-alert type="info" class="ma-4">
                No super admins found. Invite your first super admin to get
                started!
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
          <v-card-title>Super Admin API Test Results</v-card-title>
          <v-card-text>
            <div class="d-flex ga-2 mb-4">
              <v-btn
                color="primary"
                @click="loadSuperAdmins"
                :loading="loading"
              >
                Reload Super Admins
              </v-btn>
              <v-btn color="secondary" @click="testInviteSuperAdmin">
                Test Invite Super Admin
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

    <!-- Invite Super Admin Dialog -->
    <v-dialog v-model="showInviteDialog" max-width="600px">
      <v-card>
        <v-card-title>Invite Super Admin</v-card-title>
        <v-card-text>
          <v-form ref="inviteForm" v-model="inviteFormValid">
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="newSuperAdmin.first_name"
                  label="First Name"
                  :rules="[v => !!v || 'First name is required']"
                  required
                  data-cy="invite-super-admin-first-name"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="newSuperAdmin.last_name"
                  label="Last Name"
                  :rules="[v => !!v || 'Last name is required']"
                  required
                  data-cy="invite-super-admin-last-name"
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="newSuperAdmin.email"
              label="Email"
              type="email"
              :rules="[
                v => !!v || 'Email is required',
                v => /.+@.+\..+/.test(v) || 'Email must be valid',
              ]"
              required
              data-cy="invite-super-admin-email"
            />
            <v-text-field
              v-model="newSuperAdmin.phone"
              label="Phone"
              data-cy="invite-super-admin-phone"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="showInviteDialog = false"
            data-cy="invite-super-admin-cancel"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            @click="inviteSuperAdmin"
            :disabled="!inviteFormValid"
            :loading="inviting"
            data-cy="invite-super-admin-submit"
          >
            Send Invitation
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Super Admin Dialog -->
    <v-dialog v-model="showEditDialog" max-width="600px">
      <v-card>
        <v-card-title>Edit Super Admin</v-card-title>
        <v-card-text>
          <v-form ref="editForm" v-model="editFormValid">
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="editSuperAdminData.first_name"
                  label="First Name"
                  :rules="[v => !!v || 'First name is required']"
                  required
                  data-cy="edit-super-admin-first-name"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="editSuperAdminData.last_name"
                  label="Last Name"
                  :rules="[v => !!v || 'Last name is required']"
                  required
                  data-cy="edit-super-admin-last-name"
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="editSuperAdminData.email"
              label="Email"
              type="email"
              :rules="[
                v => !!v || 'Email is required',
                v => /.+@.+\..+/.test(v) || 'Email must be valid',
              ]"
              required
              data-cy="edit-super-admin-email"
            />
            <v-text-field
              v-model="editSuperAdminData.phone"
              label="Phone"
              data-cy="edit-super-admin-phone"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="showEditDialog = false"
            data-cy="edit-super-admin-cancel"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            @click="updateSuperAdmin"
            :disabled="!editFormValid"
            :loading="updating"
            data-cy="edit-super-admin-submit"
          >
            Update Super Admin
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Deactivate Confirmation Dialog -->
    <v-dialog v-model="showDeactivateDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Confirm Deactivation</v-card-title>
        <v-card-text>
          Are you sure you want to deactivate
          <strong>{{ selectedSuperAdmin?.full_name }}</strong
          >? This action will prevent them from accessing the system.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="showDeactivateDialog = false"
            data-cy="deactivate-super-admin-cancel"
            >Cancel</v-btn
          >
          <v-btn
            color="error"
            @click="confirmDeactivateSuperAdmin"
            :loading="deactivating"
            data-cy="deactivate-super-admin-confirm"
          >
            Deactivate
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Resend Invitation Confirmation Dialog -->
    <v-dialog v-model="showResendDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Resend Invitation</v-card-title>
        <v-card-text>
          Are you sure you want to resend the invitation to
          <strong>{{ selectedSuperAdmin?.full_name }}</strong
          >?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="showResendDialog = false"
            data-cy="resend-invitation-cancel"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            @click="confirmResendInvitation"
            :loading="resending"
            data-cy="resend-invitation-confirm"
          >
            Resend
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Revoke Invitation Confirmation Dialog -->
    <v-dialog v-model="showRevokeDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Revoke Invitation</v-card-title>
        <v-card-text>
          Are you sure you want to revoke the invitation for
          <strong>{{ selectedSuperAdmin?.full_name }}</strong
          >? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="showRevokeDialog = false"
            data-cy="revoke-invitation-cancel"
            >Cancel</v-btn
          >
          <v-btn
            color="error"
            @click="confirmRevokeInvitation"
            :loading="revoking"
            data-cy="revoke-invitation-confirm"
          >
            Revoke
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar for notifications -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarMessage }}
      <template #actions>
        <v-btn color="white" variant="text" @click="showSnackbar = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script>
import { superAdminAPI } from '@/services/api';

export default {
  name: 'SuperAdminsList',
  data() {
    return {
      superAdmins: [],
      loading: false,
      inviting: false,
      updating: false,
      deactivating: false,
      resending: false,
      revoking: false,
      search: '',
      showInviteDialog: false,
      showEditDialog: false,
      showDeactivateDialog: false,
      showResendDialog: false,
      showRevokeDialog: false,
      inviteFormValid: false,
      editFormValid: false,
      lastApiResponse: '',
      selectedSuperAdmin: null,
      showSnackbar: false,
      snackbarMessage: '',
      snackbarColor: 'success',
      newSuperAdmin: {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
      },
      editSuperAdminData: {
        id: null,
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
      },
      headers: [
        { title: 'Name', key: 'full_name' },
        { title: 'Email', key: 'email' },
        { title: 'Phone', key: 'phone' },
        { title: 'Status', key: 'status' },
        { title: 'Invitation', key: 'invitation_status' },
        { title: 'Created', key: 'created_at' },
        { title: 'Actions', key: 'actions', sortable: false },
      ],
    };
  },
  async mounted() {
    await this.loadSuperAdmins();
  },
  methods: {
    async loadSuperAdmins() {
      this.loading = true;
      try {
        console.log('Loading super admins...');
        const response = await superAdminAPI.getSuperAdmins();
        this.superAdmins = response.data.super_admins || response.data || [];

        // Add computed full_name property
        this.superAdmins = this.superAdmins.map(admin => ({
          ...admin,
          full_name: `${admin.first_name} ${admin.last_name}`,
          is_active: admin.is_active !== false, // Default to true if not specified
        }));

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Super admins loaded:', response.data);
      } catch (error) {
        console.error('Error loading super admins:', error);
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

    async inviteSuperAdmin() {
      if (!this.inviteFormValid) return;

      this.inviting = true;
      try {
        console.log('Inviting super admin:', this.newSuperAdmin);
        const response = await superAdminAPI.inviteSuperAdmin(
          this.newSuperAdmin
        );

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Super admin invitation sent:', response.data);

        // Close dialog and reload super admins
        this.showInviteDialog = false;
        this.newSuperAdmin = {
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
        };
        await this.loadSuperAdmins();
        this.showNotification(
          'Super admin invitation sent successfully!',
          'success'
        );
      } catch (error) {
        console.error('Error inviting super admin:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
        this.showNotification('Failed to send super admin invitation', 'error');
      } finally {
        this.inviting = false;
      }
    },

    async testInviteSuperAdmin() {
      const testSuperAdmin = {
        first_name: 'Test',
        last_name: 'SuperAdmin',
        email: `test.superadmin.${Date.now()}@example.com`,
        phone: '555-0123',
      };

      try {
        console.log('Testing invite super admin API with:', testSuperAdmin);
        const response = await superAdminAPI.inviteSuperAdmin(testSuperAdmin);

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Test super admin invitation sent:', response.data);

        // Reload super admins to show the new one
        await this.loadSuperAdmins();
      } catch (error) {
        console.error('Error in test invite super admin:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      }
    },

    editSuperAdmin(admin) {
      console.log('Edit super admin:', admin);
      this.editSuperAdminData = {
        id: admin.id,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        phone: admin.phone || '',
      };
      this.showEditDialog = true;
    },

    async updateSuperAdmin() {
      if (!this.editFormValid) return;

      this.updating = true;
      try {
        console.log('Updating super admin:', this.editSuperAdminData);
        const response = await superAdminAPI.updateSuperAdmin(
          this.editSuperAdminData.id,
          this.editSuperAdminData
        );

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Super admin updated:', response.data);

        // Close dialog and reload super admins
        this.showEditDialog = false;
        this.editSuperAdminData = {
          id: null,
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
        };
        await this.loadSuperAdmins();
        this.showNotification('Super admin updated successfully!', 'success');
      } catch (error) {
        console.error('Error updating super admin:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
        this.showNotification('Failed to update super admin', 'error');
      } finally {
        this.updating = false;
      }
    },

    deactivateSuperAdmin(admin) {
      console.log('Preparing to deactivate super admin:', admin);
      this.selectedSuperAdmin = admin;
      this.showDeactivateDialog = true;
    },

    async confirmDeactivateSuperAdmin() {
      if (!this.selectedSuperAdmin) return;

      this.deactivating = true;
      try {
        console.log('Deactivating super admin:', this.selectedSuperAdmin);
        const response = await superAdminAPI.deactivateSuperAdmin(
          this.selectedSuperAdmin.id
        );

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Super admin deactivated:', response.data);

        // Close dialog and reload super admins
        this.showDeactivateDialog = false;
        this.selectedSuperAdmin = null;
        await this.loadSuperAdmins();
        this.showNotification(
          'Super admin deactivated successfully!',
          'success'
        );
      } catch (error) {
        console.error('Error deactivating super admin:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
        this.showNotification('Failed to deactivate super admin', 'error');
      } finally {
        this.deactivating = false;
      }
    },

    resendInvitation(admin) {
      console.log('Preparing to resend invitation for super admin:', admin);
      this.selectedSuperAdmin = admin;
      this.showResendDialog = true;
    },

    async confirmResendInvitation() {
      if (!this.selectedSuperAdmin) return;

      this.resending = true;
      try {
        console.log(
          'Resending invitation for super admin:',
          this.selectedSuperAdmin
        );
        const response = await superAdminAPI.resendInvitation(
          this.selectedSuperAdmin.id,
          this.selectedSuperAdmin.email
        );

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Invitation resent:', response.data);

        // Close dialog and reload super admins
        this.showResendDialog = false;
        this.selectedSuperAdmin = null;
        await this.loadSuperAdmins();
        this.showNotification('Invitation resent successfully!', 'success');
      } catch (error) {
        console.error('Error resending invitation:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
        this.showNotification('Failed to resend invitation', 'error');
      } finally {
        this.resending = false;
      }
    },

    revokeInvitation(admin) {
      console.log('Preparing to revoke invitation for super admin:', admin);
      this.selectedSuperAdmin = admin;
      this.showRevokeDialog = true;
    },

    async confirmRevokeInvitation() {
      if (!this.selectedSuperAdmin) return;

      this.revoking = true;
      try {
        console.log(
          'Revoking invitation for super admin:',
          this.selectedSuperAdmin
        );
        const response = await superAdminAPI.revokeInvitation(
          this.selectedSuperAdmin.id,
          this.selectedSuperAdmin.email
        );

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Invitation revoked:', response.data);

        // Close dialog and reload super admins
        this.showRevokeDialog = false;
        this.selectedSuperAdmin = null;
        await this.loadSuperAdmins();
        this.showNotification('Invitation revoked successfully!', 'success');
      } catch (error) {
        console.error('Error revoking invitation:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
        this.showNotification('Failed to revoke invitation', 'error');
      } finally {
        this.revoking = false;
      }
    },

    getInvitationStatusColor(status) {
      const colors = {
        pending: 'warning',
        accepted: 'success',
        expired: 'error',
        revoked: 'error',
      };
      return colors[status] || 'default';
    },

    showNotification(message, color = 'success') {
      this.snackbarMessage = message;
      this.snackbarColor = color;
      this.showSnackbar = true;
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
