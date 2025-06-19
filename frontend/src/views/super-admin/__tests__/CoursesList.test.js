import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import CoursesList from '../CoursesList.vue'

// Mock the API
vi.mock('@/services/api', () => ({
  superAdminAPI: {
    getCourses: vi.fn(),
    createCourse: vi.fn(),
    updateCourse: vi.fn(),
    updateCourseStatus: vi.fn(),
  }
}))

// Create Vuetify instance
const vuetify = createVuetify()

// Mock courses data
const mockCourses = [
  {
    id: 1,
    name: 'Pine Valley Golf Club',
    street: '123 Golf Course Dr',
    city: 'Pine Valley',
    state: 'CA',
    postal_code: '90210',
    country: 'US',
    status: 'active',
    created_at: '2023-01-01T00:00:00Z',
    location: 'Pine Valley, CA'
  },
  {
    id: 2,
    name: 'Oak Hill Country Club',
    street: '456 Oak Hill Rd',
    city: 'Oak Hill',
    state: 'NY',
    postal_code: '14618',
    country: 'US',
    status: 'inactive',
    created_at: '2023-01-02T00:00:00Z',
    location: 'Oak Hill, NY'
  }
]

describe('CoursesList', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = mount(CoursesList, {
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
      expect(wrapper.find('h1').text()).toBe('Golf Courses Management')
      expect(wrapper.find('[data-cy="add-course-btn"]').exists()).toBe(true)
    })

    it('initializes with correct data', () => {
      expect(wrapper.vm.courses).toEqual([])
      expect(wrapper.vm.loading).toBe(false)
      expect(wrapper.vm.showCreateDialog).toBe(false)
      expect(wrapper.vm.showEditDialog).toBe(false)
      expect(wrapper.vm.showStatusDialog).toBe(false)
    })
  })

  describe('Courses Loading', () => {
    it('loads courses on mount', async () => {
      const { superAdminAPI } = await import('@/services/api')
      superAdminAPI.getCourses.mockResolvedValue({ data: { courses: mockCourses } })

      const wrapper = mount(CoursesList, {
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

      expect(superAdminAPI.getCourses).toHaveBeenCalled()
    })

    it('handles loading error gracefully', async () => {
      const { superAdminAPI } = await import('@/services/api')
      superAdminAPI.getCourses.mockRejectedValue(new Error('API Error'))

      await wrapper.vm.loadCourses()

      expect(wrapper.vm.lastApiResponse).toContain('API Error')
    })
  })

  describe('Create Course Dialog', () => {
    it('opens create dialog when add button is clicked', async () => {
      await wrapper.find('[data-cy="add-course-btn"]').trigger('click')
      expect(wrapper.vm.showCreateDialog).toBe(true)
    })

    it('validates required fields in create form', async () => {
      wrapper.vm.showCreateDialog = true
      await wrapper.vm.$nextTick()

      // Test empty form validation
      wrapper.vm.newCourse = {
        name: '',
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: ''
      }

      expect(wrapper.vm.createFormValid).toBe(false)
    })

    it('submits create form with valid data', async () => {
      const { superAdminAPI } = await import('@/services/api')
      superAdminAPI.createCourse.mockResolvedValue({ data: { success: true } })
      superAdminAPI.getCourses.mockResolvedValue({ data: { courses: mockCourses } })

      wrapper.vm.showCreateDialog = true
      wrapper.vm.createFormValid = true
      wrapper.vm.newCourse = {
        name: 'New Golf Course',
        street: '789 New Course Ln',
        city: 'New City',
        state: 'FL',
        postal_code: '33101',
        country: 'US'
      }

      await wrapper.vm.createCourse()

      expect(superAdminAPI.createCourse).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Golf Course',
        street: '789 New Course Ln',
        city: 'New City',
        state: 'FL',
        postal_code: '33101',
        country: 'US'
      }))
      expect(wrapper.vm.showCreateDialog).toBe(false)
    })
  })

  describe('Edit Course Dialog', () => {
    it('opens edit dialog with course data', async () => {
      const course = mockCourses[0]
      await wrapper.vm.editCourse(course)

      expect(wrapper.vm.showEditDialog).toBe(true)
      expect(wrapper.vm.editCourseData.name).toBe(course.name)
      expect(wrapper.vm.editCourseData.city).toBe(course.city)
    })

    it('updates course with valid data', async () => {
      const { superAdminAPI } = await import('@/services/api')
      superAdminAPI.updateCourse.mockResolvedValue({ data: { success: true } })
      superAdminAPI.getCourses.mockResolvedValue({ data: { courses: mockCourses } })

      wrapper.vm.showEditDialog = true
      wrapper.vm.editFormValid = true
      wrapper.vm.editCourseData = {
        id: 1,
        name: 'Updated Course Name',
        street: '123 Updated St',
        city: 'Updated City',
        state: 'CA',
        postal_code: '90210',
        country: 'US',
        status: 'active'
      }

      await wrapper.vm.updateCourse()

      expect(superAdminAPI.updateCourse).toHaveBeenCalledWith(1, expect.objectContaining({
        name: 'Updated Course Name',
        street: '123 Updated St',
        city: 'Updated City',
        state: 'CA',
        postal_code: '90210',
        country: 'US',
        status: 'active'
      }))
      expect(wrapper.vm.showEditDialog).toBe(false)
    })
  })

  describe('Status Change Dialog', () => {
    it('opens status change confirmation dialog', async () => {
      const course = mockCourses[0]
      await wrapper.vm.toggleCourseStatus(course)

      expect(wrapper.vm.showStatusDialog).toBe(true)
      expect(wrapper.vm.selectedCourse).toStrictEqual(course)
      expect(wrapper.vm.newStatus).toBe('inactive') // since course is active
    })

    it('confirms status change', async () => {
      const { superAdminAPI } = await import('@/services/api')
      superAdminAPI.updateCourseStatus.mockResolvedValue({ data: { success: true } })
      superAdminAPI.getCourses.mockResolvedValue({ data: { courses: mockCourses } })

      wrapper.vm.selectedCourse = mockCourses[0]
      wrapper.vm.newStatus = 'inactive'
      wrapper.vm.showStatusDialog = true

      await wrapper.vm.confirmStatusChange()

      expect(superAdminAPI.updateCourseStatus).toHaveBeenCalledWith(mockCourses[0].id, 'inactive')
      expect(wrapper.vm.showStatusDialog).toBe(false)
      expect(wrapper.vm.selectedCourse).toBe(null)
    })
  })

  describe('Helper Functions', () => {
    it('formats location correctly', () => {
      const course = {
        city: 'Test City',
        state: 'CA'
      }
      expect(wrapper.vm.formatLocation(course)).toBe('Test City, CA')

      const courseNoLocation = {}
      expect(wrapper.vm.formatLocation(courseNoLocation)).toBe('No location specified')
    })

    it('returns correct colors for status', () => {
      expect(wrapper.vm.getStatusColor('active')).toBe('success')
      expect(wrapper.vm.getStatusColor('inactive')).toBe('error')
      expect(wrapper.vm.getStatusColor('pending')).toBe('warning')
      expect(wrapper.vm.getStatusColor('unknown')).toBe('default')
    })
  })

  describe('Search Functionality', () => {
    it('updates search value', async () => {
      const wrapper = mount(CoursesList)
      
      // Set search value directly on component
      wrapper.vm.search = 'Pine Valley'
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.search).toBe('Pine Valley')
    })
  })

  describe('Test Functions', () => {
    it('executes test create course', async () => {
      const { superAdminAPI } = await import('@/services/api')
      superAdminAPI.createCourse.mockResolvedValue({ data: { success: true } })
      superAdminAPI.getCourses.mockResolvedValue({ data: { courses: mockCourses } })

      await wrapper.vm.testCreateCourse()

      expect(superAdminAPI.createCourse).toHaveBeenCalled()
      expect(superAdminAPI.getCourses).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('handles create error gracefully', async () => {
      const { superAdminAPI } = await import('@/services/api')
      superAdminAPI.createCourse.mockRejectedValue(new Error('Create failed'))

      wrapper.vm.createFormValid = true
      wrapper.vm.newCourse = {
        name: 'Test Course',
        street: '123 Test St',
        city: 'Test City',
        state: 'CA',
        postal_code: '90210',
        country: 'US'
      }

      await wrapper.vm.createCourse()

      expect(wrapper.vm.lastApiResponse).toContain('Create failed')
    })

    it('handles update error gracefully', async () => {
      const { superAdminAPI } = await import('@/services/api')
      superAdminAPI.updateCourse.mockRejectedValue(new Error('Update failed'))

      wrapper.vm.editFormValid = true
      wrapper.vm.editCourseData = {
        id: 1,
        name: 'Test Course',
        street: '123 Test St',
        city: 'Test City',
        state: 'CA',
        postal_code: '90210',
        country: 'US',
        status: 'active'
      }

      await wrapper.vm.updateCourse()

      expect(wrapper.vm.lastApiResponse).toContain('Update failed')
    })

    it('handles status change error gracefully', async () => {
      const { superAdminAPI } = await import('@/services/api')
      superAdminAPI.updateCourseStatus.mockRejectedValue(new Error('Status update failed'))

      wrapper.vm.selectedCourse = mockCourses[0]
      wrapper.vm.newStatus = 'inactive'

      await wrapper.vm.confirmStatusChange()

      expect(wrapper.vm.lastApiResponse).toContain('Status update failed')
    })
  })
}) 