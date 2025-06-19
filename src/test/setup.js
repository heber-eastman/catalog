import { beforeEach, afterEach, vi } from 'vitest';
import { mount, shallowMount, config } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

// Mock browser APIs that Vuetify needs
Object.defineProperty(window, 'visualViewport', {
  value: {
    width: 1024,
    height: 768,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  writable: true,
});

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

// Mock ResizeObserver
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

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id));

// Mock scroll methods
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// Mock configuration
const globalMocks = {
  $router: {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    currentRoute: {
      value: {
        path: '/',
        name: 'home',
        params: {},
        query: {},
      },
    },
  },
  $route: {
    path: '/',
    name: 'home',
    params: {},
    query: {},
  },
};

// Mock API calls (exported for use in tests)
export const mockAPI = {
  get: vi.fn(() => Promise.resolve({ data: [] })),
  post: vi.fn(() => Promise.resolve({ data: {} })),
  put: vi.fn(() => Promise.resolve({ data: {} })),
  delete: vi.fn(() => Promise.resolve({ data: {} })),
};

export const mockAPIError = {
  get: vi.fn(() => Promise.reject(new Error('API Error'))),
  post: vi.fn(() => Promise.reject(new Error('API Error'))),
  put: vi.fn(() => Promise.reject(new Error('API Error'))),
  delete: vi.fn(() => Promise.reject(new Error('API Error'))),
};

// Store the original fetch
const originalFetch = global.fetch;
const originalConsoleError = console.error;

// Mock console.error to reduce noise in tests
console.error = vi.fn();

// Create Vuetify instance for testing
const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'light',
  },
});

// Configure Vue Test Utils to use Vuetify
config.global.plugins = [vuetify];
config.global.stubs = {
  VIcon: true,
  VProgressCircular: true,
  VSnackbar: true,
  VDialog: true,
  VOverlay: true,
};

// Suppress specific console warnings during tests
const originalConsoleWarn = console.warn;

console.warn = (...args) => {
  const message = args.join(' ');
  if (
    message.includes('visualViewport') ||
    message.includes('ResizeObserver') ||
    message.includes('IntersectionObserver') ||
    message.includes('[Vuetify]')
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

// Helper function to create Vuetify instance for tests
export function createTestVuetify() {
  return createVuetify({
    components,
    directives,
  });
}

// Helper to create wrapper with all global mocks
export function createWrapper(component, options = {}) {
  const vuetify = createTestVuetify();
  return mount(component, {
    global: {
      plugins: [vuetify],
      mocks: globalMocks,
      ...options.global,
    },
    ...options,
  });
}

// Helper to create shallow wrapper
export function createShallowWrapper(component, options = {}) {
  const vuetify = createTestVuetify();
  return shallowMount(component, {
    global: {
      plugins: [vuetify],
      mocks: globalMocks,
      ...options.global,
    },
    ...options,
  });
}

// Mock fetch globally
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  })
);

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  global.fetch = originalFetch;
  console.error = originalConsoleError;
});

// Global setup for all tests
beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })
  );
  console.error = vi.fn();
});

// Configure Vue Test Utils globally
config.global.plugins = [createTestVuetify()];
config.global.mocks = globalMocks;
