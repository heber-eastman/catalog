import { vi } from 'vitest';
import { config } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// Create Vuetify instance for testing
const vuetify = createVuetify({
  components,
  directives,
})

// Configure Vue Test Utils to use Vuetify
config.global.plugins = [vuetify]

// Mock the router
const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  forward: vi.fn(),
  currentRoute: {
    value: {
      params: { id: '1' },
      query: {},
      path: '/',
      name: 'Home'
    }
  }
}

config.global.mocks = {
  $router: mockRouter,
  $route: mockRouter.currentRoute.value
}

// Mock API functions
const mockAPI = {
  customerAPI: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  staffAPI: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  superAdminAPI: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  authAPI: {
    login: vi.fn(),
    signup: vi.fn(),
    confirm: vi.fn(),
    logout: vi.fn(),
  },
  apiUtils: {
    isAuthenticated: vi.fn(),
    getToken: vi.fn(),
    removeToken: vi.fn(),
  }
}

// Make API mocks available globally
config.global.provide = {
  api: mockAPI
}

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

export { mockAPI, mockRouter }

// Mock ResizeObserver which is used by Vuetify components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
