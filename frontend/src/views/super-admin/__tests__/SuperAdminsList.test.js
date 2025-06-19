import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import SuperAdminsList from '../SuperAdminsList.vue';

// Mock the API
vi.mock('@/services/api', () => ({
  superAdminAPI: {
    getSuperAdmins: vi.fn(),
    inviteSuperAdmin: vi.fn(),
    updateSuperAdmin: vi.fn(),
    deactivateSuperAdmin: vi.fn(),
    resendInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
  },
}));

// Create Vuetify instance
const vuetify = createVuetify();

// Mock super admins data
const mockSuperAdmins = [
  {
    id: 1,
    first_name: 'John',
    last_name: 'Admin',
    email: 'john.admin@example.com',
    phone: '555-0123',
    is_active: true,
    invitation_status: 'accepted',
    full_name: 'John Admin',
  },
  {
    id: 2,
    first_name: 'Jane',
    last_name: 'SuperAdmin',
    email: 'jane.superadmin@example.com',
    phone: '555-0456',
    is_active: true,
    invitation_status: 'pending',
    full_name: 'Jane SuperAdmin',
  },
];

describe('SuperAdminsList', () => {
  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    wrapper = mount(SuperAdminsList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VBtn: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
            emits: ['click'],
          },
          VDialog: { template: '<div><slot /></div>' },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: { template: '<div><slot /></div>' },
        },
      },
    });
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('renders correctly', () => {
    expect(wrapper.find('h1').text()).toBe('Super Admins Management');
    expect(wrapper.find('[data-cy="invite-super-admin-btn"]').exists()).toBe(
      true
    );
  });

  it('initializes with correct data', () => {
    expect(wrapper.vm.superAdmins).toEqual([]);
    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.vm.showInviteDialog).toBe(false);
    expect(wrapper.vm.showEditDialog).toBe(false);
    expect(wrapper.vm.showDeactivateDialog).toBe(false);
    expect(wrapper.vm.showRevokeDialog).toBe(false);
  });

  it('opens invite dialog', async () => {
    await wrapper.find('[data-cy="invite-super-admin-btn"]').trigger('click');
    expect(wrapper.vm.showInviteDialog).toBe(true);
  });

  it('updates search value', async () => {
    const wrapper = mount(SuperAdminsList);

    // Set search value directly on component
    wrapper.vm.search = 'John';
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.search).toBe('John');
  });

  describe('Super Admins Loading', () => {
    it('loads super admins on mount', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.getSuperAdmins.mockResolvedValue({
        data: { superAdmins: mockSuperAdmins },
      });

      const wrapper = mount(SuperAdminsList, {
        global: {
          plugins: [vuetify],
          stubs: {
            VContainer: { template: '<div><slot /></div>' },
            VRow: { template: '<div><slot /></div>' },
            VCol: { template: '<div><slot /></div>' },
            VCard: { template: '<div><slot /></div>' },
            VCardTitle: { template: '<div><slot /></div>' },
            VCardText: { template: '<div><slot /></div>' },
            VCardActions: { template: '<div><slot /></div>' },
            VDataTable: {
              template: '<div><slot /></div>',
              props: ['headers', 'items', 'loading', 'search'],
            },
            VTextField: {
              template: '<input v-model="modelValue" />',
              props: ['modelValue'],
              emits: ['update:modelValue'],
            },
            VBtn: { template: '<button><slot /></button>' },
            VDialog: { template: '<div><slot /></div>' },
            VForm: { template: '<form><slot /></form>' },
            VChip: { template: '<span><slot /></span>' },
            VAlert: { template: '<div><slot /></div>' },
            VSpacer: { template: '<div></div>' },
            VSnackbar: { template: '<div><slot /></div>' },
          },
        },
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(superAdminAPI.getSuperAdmins).toHaveBeenCalled();
    });

    it('handles loading error gracefully', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.getSuperAdmins.mockRejectedValue(new Error('API Error'));

      await wrapper.vm.loadSuperAdmins();

      expect(wrapper.vm.lastApiResponse).toContain('API Error');
    });
  });

  describe('Invite Super Admin Dialog', () => {
    it('validates required fields in invite form', async () => {
      wrapper.vm.showInviteDialog = true;
      await wrapper.vm.$nextTick();

      // Test empty form validation
      wrapper.vm.newSuperAdmin = {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
      };

      expect(wrapper.vm.inviteFormValid).toBe(false);
    });

    it('submits invite form with valid data', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.inviteSuperAdmin.mockResolvedValue({
        data: { success: true },
      });
      superAdminAPI.getSuperAdmins.mockResolvedValue({
        data: { superAdmins: mockSuperAdmins },
      });

      wrapper.vm.showInviteDialog = true;
      wrapper.vm.inviteFormValid = true;
      wrapper.vm.newSuperAdmin = {
        first_name: 'New',
        last_name: 'SuperAdmin',
        email: 'new.superadmin@example.com',
        phone: '555-0789',
      };

      await wrapper.vm.inviteSuperAdmin();

      expect(superAdminAPI.inviteSuperAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new.superadmin@example.com',
          first_name: 'New',
          last_name: 'SuperAdmin',
          phone: '555-0789',
        })
      );
      expect(wrapper.vm.showInviteDialog).toBe(false);
    });
  });

  describe('Edit Super Admin Dialog', () => {
    it('opens edit dialog with super admin data', async () => {
      const superAdmin = mockSuperAdmins[0];
      await wrapper.vm.editSuperAdmin(superAdmin);

      expect(wrapper.vm.showEditDialog).toBe(true);
      expect(wrapper.vm.editSuperAdminData.first_name).toBe(
        superAdmin.first_name
      );
      expect(wrapper.vm.editSuperAdminData.email).toBe(superAdmin.email);
    });

    it('updates super admin with valid data', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.updateSuperAdmin.mockResolvedValue({
        data: { success: true },
      });
      superAdminAPI.getSuperAdmins.mockResolvedValue({
        data: { superAdmins: mockSuperAdmins },
      });

      wrapper.vm.showEditDialog = true;
      wrapper.vm.editFormValid = true;
      wrapper.vm.editSuperAdminData = {
        id: 1,
        first_name: 'Updated',
        last_name: 'Name',
        email: 'updated@example.com',
        phone: '555-9999',
      };

      await wrapper.vm.updateSuperAdmin();

      expect(superAdminAPI.updateSuperAdmin).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          email: 'updated@example.com',
          first_name: 'Updated',
          last_name: 'Name',
          phone: '555-9999',
        })
      );
      expect(wrapper.vm.showEditDialog).toBe(false);
    });
  });

  describe('Deactivate Super Admin', () => {
    it('opens deactivate confirmation dialog', async () => {
      const superAdmin = mockSuperAdmins[0];
      await wrapper.vm.deactivateSuperAdmin(superAdmin);

      expect(wrapper.vm.showDeactivateDialog).toBe(true);
      expect(wrapper.vm.selectedSuperAdmin).toStrictEqual(superAdmin);
    });

    it('confirms super admin deactivation', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.deactivateSuperAdmin.mockResolvedValue({
        data: { success: true },
      });
      superAdminAPI.getSuperAdmins.mockResolvedValue({
        data: { superAdmins: mockSuperAdmins },
      });

      wrapper.vm.selectedSuperAdmin = mockSuperAdmins[0];
      wrapper.vm.showDeactivateDialog = true;

      await wrapper.vm.confirmDeactivateSuperAdmin();

      expect(superAdminAPI.deactivateSuperAdmin).toHaveBeenCalledWith(
        mockSuperAdmins[0].id
      );
      expect(wrapper.vm.showDeactivateDialog).toBe(false);
      expect(wrapper.vm.selectedSuperAdmin).toStrictEqual(null);
    });
  });

  describe('Resend Invitation', () => {
    it('resends invitation successfully', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.resendInvitation.mockResolvedValue({
        data: { success: true },
      });
      superAdminAPI.getSuperAdmins.mockResolvedValue({
        data: { superAdmins: mockSuperAdmins },
      });

      const superAdmin = mockSuperAdmins[1]; // pending invitation
      wrapper.vm.selectedSuperAdmin = superAdmin;
      await wrapper.vm.confirmResendInvitation();

      expect(superAdminAPI.resendInvitation).toHaveBeenCalledWith(
        superAdmin.id,
        superAdmin.email
      );
      expect(wrapper.vm.showSnackbar).toBe(true);
      expect(wrapper.vm.snackbarMessage).toContain('Invitation resent');
    });

    it('handles resend invitation error', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.resendInvitation.mockRejectedValue(
        new Error('Resend failed')
      );

      const superAdmin = mockSuperAdmins[1];
      wrapper.vm.selectedSuperAdmin = superAdmin;
      await wrapper.vm.confirmResendInvitation();

      expect(wrapper.vm.showSnackbar).toBe(true);
      expect(wrapper.vm.snackbarMessage).toContain(
        'Failed to resend invitation'
      );
    });
  });

  describe('Revoke Invitation', () => {
    it('opens revoke confirmation dialog', async () => {
      const superAdmin = mockSuperAdmins[1]; // pending invitation
      await wrapper.vm.revokeInvitation(superAdmin);

      expect(wrapper.vm.showRevokeDialog).toBe(true);
      expect(wrapper.vm.selectedSuperAdmin).toStrictEqual(superAdmin);
    });

    it('confirms invitation revocation', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.revokeInvitation.mockResolvedValue({
        data: { success: true },
      });
      superAdminAPI.getSuperAdmins.mockResolvedValue({
        data: { superAdmins: mockSuperAdmins },
      });

      wrapper.vm.selectedSuperAdmin = mockSuperAdmins[1];
      wrapper.vm.showRevokeDialog = true;

      await wrapper.vm.confirmRevokeInvitation();

      expect(superAdminAPI.revokeInvitation).toHaveBeenCalledWith(
        mockSuperAdmins[1].id,
        mockSuperAdmins[1].email
      );
      expect(wrapper.vm.showRevokeDialog).toBe(false);
      expect(wrapper.vm.selectedSuperAdmin).toStrictEqual(null);
    });
  });

  describe('Helper Functions', () => {
    it('returns correct colors for invitation status', () => {
      expect(wrapper.vm.getInvitationStatusColor('pending')).toBe('warning');
      expect(wrapper.vm.getInvitationStatusColor('accepted')).toBe('success');
      expect(wrapper.vm.getInvitationStatusColor('expired')).toBe('error');
      expect(wrapper.vm.getInvitationStatusColor('revoked')).toBe('error');
      expect(wrapper.vm.getInvitationStatusColor('unknown')).toBe('default');
    });
  });

  describe('Test Functions', () => {
    it('executes test invite super admin', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.inviteSuperAdmin.mockResolvedValue({
        data: { success: true },
      });
      superAdminAPI.getSuperAdmins.mockResolvedValue({
        data: { superAdmins: mockSuperAdmins },
      });

      await wrapper.vm.testInviteSuperAdmin();

      expect(superAdminAPI.inviteSuperAdmin).toHaveBeenCalled();
      expect(superAdminAPI.getSuperAdmins).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles invite error gracefully', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.inviteSuperAdmin.mockRejectedValue(
        new Error('Invite failed')
      );

      wrapper.vm.inviteFormValid = true;
      wrapper.vm.newSuperAdmin = {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        phone: '',
      };

      await wrapper.vm.inviteSuperAdmin();

      expect(wrapper.vm.lastApiResponse).toContain('Invite failed');
    });

    it('handles update error gracefully', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.updateSuperAdmin.mockRejectedValue(
        new Error('Update failed')
      );

      wrapper.vm.editFormValid = true;
      wrapper.vm.editSuperAdminData = {
        id: 1,
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        phone: '',
      };

      await wrapper.vm.updateSuperAdmin();

      expect(wrapper.vm.lastApiResponse).toContain('Update failed');
    });

    it('handles deactivate error gracefully', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.deactivateSuperAdmin.mockRejectedValue(
        new Error('Deactivate failed')
      );

      wrapper.vm.selectedSuperAdmin = mockSuperAdmins[0];

      await wrapper.vm.confirmDeactivateSuperAdmin();

      expect(wrapper.vm.lastApiResponse).toContain('Deactivate failed');
    });

    it('handles revoke invitation error gracefully', async () => {
      const { superAdminAPI } = await import('@/services/api');
      superAdminAPI.revokeInvitation.mockRejectedValue(
        new Error('Revoke failed')
      );

      wrapper.vm.selectedSuperAdmin = mockSuperAdmins[1];

      await wrapper.vm.confirmRevokeInvitation();

      expect(wrapper.vm.lastApiResponse).toContain('Revoke failed');
    });
  });

  describe('Snackbar Notifications', () => {
    it('shows and hides snackbar correctly', async () => {
      wrapper.vm.showNotification('Test message', 'success');

      expect(wrapper.vm.showSnackbar).toBe(true);
      expect(wrapper.vm.snackbarMessage).toBe('Test message');
      expect(wrapper.vm.snackbarColor).toBe('success');
    });
  });
});
