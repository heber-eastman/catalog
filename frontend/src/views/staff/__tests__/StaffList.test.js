import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import StaffList from '../StaffList.vue'

// Mock the API
vi.mock('@/services/api', () => ({
  staffAPI: {
    getAll: vi.fn(),
    invite: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  }
}))

// Create Vuetify instance
const vuetify = createVuetify()

// Mock staff data
const mockStaff = [
  {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    role: 'Manager',
    phone: '555-0123',
    is_active: true,
    full_name: 'John Doe'
  },
  {
    id: 2,
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@example.com',
    role: 'Staff',
    phone: '555-0456',
    is_active: false,
    full_name: 'Jane Smith'
  }
]

describe('StaffList', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = mount(StaffList, {
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
            template: '<div data-testid="data-table"><slot /></div>',
            props: ['headers', 'items', 'loading', 'search']
          },
          VTextField: { 
            template: '<input v-model="modelValue" />',
            props: ['modelValue', 'label', 'rules'],
            emits: ['update:modelValue']
          },
          VSelect: { 
            template: '<select v-model="modelValue"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items', 'label', 'rules'],
            emits: ['update:modelValue']
          },
          VBtn: { 
            template: '<button @click="$emit(\'click\')" :disabled="disabled"><slot /></button>',
            props: ['disabled', 'loading', 'color'],
            emits: ['click']
          },
          VDialog: { 
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue', 'maxWidth'],
            emits: ['update:modelValue']
          },
          VForm: { 
            template: '<form><slot /></form>',
            props: ['modelValue'],
            emits: ['update:modelValue']
          },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' }
        }
      }
    })
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('Component Initialization', () => {
    it('renders correctly', () => {
      expect(wrapper.find('h1').text()).toBe('Staff Management')
      expect(wrapper.find('[data-cy="invite-staff-btn"]').exists()).toBe(true)
    })

    it('initializes with correct data', () => {
      expect(wrapper.vm.staff).toEqual([])
      expect(wrapper.vm.loading).toBe(false)
      expect(wrapper.vm.showInviteDialog).toBe(false)
      expect(wrapper.vm.showEditDialog).toBe(false)
      expect(wrapper.vm.showDeactivateDialog).toBe(false)
    })
  })

  describe('Staff Loading', () => {
    it('loads staff on mount', async () => {
      const { staffAPI } = await import('@/services/api')
      staffAPI.getAll.mockResolvedValue({ data: { staff: mockStaff } })

      const wrapper = mount(StaffList, {
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
              template: '<div data-testid="data-table"><slot /></div>',
              props: ['headers', 'items', 'loading', 'search']
            },
            VTextField: { 
              template: '<input v-model="modelValue" />',
              props: ['modelValue'],
              emits: ['update:modelValue']
            },
            VBtn: { template: '<button><slot /></button>' },
            VDialog: { template: '<div><slot /></div>' },
            VForm: { template: '<form><slot /></form>' },
            VChip: { template: '<span><slot /></span>' },
            VAlert: { template: '<div><slot /></div>' },
            VSpacer: { template: '<div></div>' }
          }
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(staffAPI.getAll).toHaveBeenCalled()
    })

    it('handles loading error gracefully', async () => {
      const { staffAPI } = await import('@/services/api')
      staffAPI.getAll.mockRejectedValue(new Error('API Error'))

      await wrapper.vm.loadStaff()

      expect(wrapper.vm.lastApiResponse).toContain('API Error')
    })
  })

  describe('Invite Staff Dialog', () => {
    it('opens invite dialog when invite button is clicked', async () => {
      await wrapper.find('[data-cy="invite-staff-btn"]').trigger('click')
      expect(wrapper.vm.showInviteDialog).toBe(true)
    })

    it('validates required fields in invite form', async () => {
      wrapper.vm.showInviteDialog = true
      await wrapper.vm.$nextTick()

      // Test empty form validation
      wrapper.vm.newStaff = {
        first_name: '',
        last_name: '',
        email: '',
        role: '',
        phone: ''
      }

      expect(wrapper.vm.inviteFormValid).toBe(false)
    })

    it('submits invite form with valid data', async () => {
      const { staffAPI } = await import('@/services/api')
      staffAPI.invite.mockResolvedValue({ data: { success: true } })
      staffAPI.getAll.mockResolvedValue({ data: { staff: mockStaff } })

      wrapper.vm.showInviteDialog = true
      wrapper.vm.inviteFormValid = true
      wrapper.vm.newStaff = {
        first_name: 'New',
        last_name: 'Staff',
        email: 'new.staff@example.com',
        role: 'Staff',
        phone: '555-0789'
      }

      await wrapper.vm.inviteStaff()

      expect(staffAPI.invite).toHaveBeenCalledWith(expect.objectContaining({
        email: 'new.staff@example.com',
        first_name: 'New',
        last_name: 'Staff',
        phone: '555-0789',
        role: 'Staff'
      }))
      expect(wrapper.vm.showInviteDialog).toBe(false)
    })
  })

  describe('Edit Staff Dialog', () => {
    it('opens edit dialog with staff data', async () => {
      const staff = mockStaff[0]
      await wrapper.vm.editStaff(staff)

      expect(wrapper.vm.showEditDialog).toBe(true)
      expect(wrapper.vm.editStaffData.first_name).toBe(staff.first_name)
      expect(wrapper.vm.editStaffData.email).toBe(staff.email)
    })

    it('updates staff with valid data', async () => {
      const { staffAPI } = await import('@/services/api')
      staffAPI.update.mockResolvedValue({ data: { success: true } })
      staffAPI.getAll.mockResolvedValue({ data: { staff: mockStaff } })

      wrapper.vm.showEditDialog = true
      wrapper.vm.editFormValid = true
      wrapper.vm.editStaffData = {
        id: 1,
        first_name: 'Updated',
        last_name: 'Name',
        email: 'updated@example.com',
        role: 'Manager',
        phone: '555-9999'
      }

      await wrapper.vm.updateStaff()

      expect(staffAPI.update).toHaveBeenCalledWith(1, expect.objectContaining({
        email: 'updated@example.com',
        first_name: 'Updated',
        last_name: 'Name',
        phone: '555-9999',
        role: 'Manager'
      }))
      expect(wrapper.vm.showEditDialog).toBe(false)
    })
  })

  describe('Deactivate Staff', () => {
    it('opens deactivate confirmation dialog', async () => {
      const staff = mockStaff[0]
      await wrapper.vm.deactivateStaff(staff)

      expect(wrapper.vm.showDeactivateDialog).toBe(true)
      expect(wrapper.vm.selectedStaff).toStrictEqual(staff)
    })

    it('confirms staff deactivation', async () => {
      const { staffAPI } = await import('@/services/api')
      staffAPI.deactivate.mockResolvedValue({ data: { success: true } })
      staffAPI.getAll.mockResolvedValue({ data: { staff: mockStaff } })

      wrapper.vm.selectedStaff = mockStaff[0]
      wrapper.vm.showDeactivateDialog = true

      await wrapper.vm.confirmDeactivateStaff()

      expect(staffAPI.deactivate).toHaveBeenCalledWith(mockStaff[0].id)
      expect(wrapper.vm.showDeactivateDialog).toBe(false)
      expect(wrapper.vm.selectedStaff).toStrictEqual(null)
    })
  })

  describe('Search Functionality', () => {
    it('updates search value', async () => {
      const wrapper = mount(StaffList)
      
      // Set search value directly on component
      wrapper.vm.search = 'John'
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.search).toBe('John')
    })
  })

  describe('Role Color Helper', () => {
    it('returns correct colors for roles', () => {
      expect(wrapper.vm.getRoleColor('Admin')).toBe('error')
      expect(wrapper.vm.getRoleColor('Manager')).toBe('warning')
      expect(wrapper.vm.getRoleColor('Staff')).toBe('info')
      expect(wrapper.vm.getRoleColor('Unknown')).toBe('default')
    })
  })

  describe('Error Handling', () => {
    it('handles invite error gracefully', async () => {
      const { staffAPI } = await import('@/services/api')
      staffAPI.invite.mockRejectedValue(new Error('Invite failed'))

      wrapper.vm.inviteFormValid = true
      wrapper.vm.newStaff = {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        role: 'Staff',
        phone: ''
      }

      await wrapper.vm.inviteStaff()

      expect(wrapper.vm.lastApiResponse).toContain('Invite failed')
    })

    it('handles update error gracefully', async () => {
      const { staffAPI } = await import('@/services/api')
      staffAPI.update.mockRejectedValue(new Error('Update failed'))

      wrapper.vm.editFormValid = true
      wrapper.vm.editStaffData = {
        id: 1,
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        role: 'Staff',
        phone: ''
      }

      await wrapper.vm.updateStaff()

      expect(wrapper.vm.lastApiResponse).toContain('Update failed')
    })

    it('handles deactivate error gracefully', async () => {
      const { staffAPI } = await import('@/services/api')
      staffAPI.deactivate.mockRejectedValue(new Error('Deactivate failed'))

      wrapper.vm.selectedStaff = mockStaff[0]

      await wrapper.vm.confirmDeactivateStaff()

      expect(wrapper.vm.lastApiResponse).toContain('Deactivate failed')
    })
  })
}) 