import { config } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

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
    removeEventListener: vi.fn()
  },
  writable: true
})

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
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 0))
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id))

// Mock scroll methods
Element.prototype.scrollTo = vi.fn()
Element.prototype.scrollIntoView = vi.fn()

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
    defaultTheme: 'light'
  }
})

// Configure Vue Test Utils to use Vuetify
config.global.plugins = [vuetify]
config.global.stubs = {
  VIcon: true,
  VProgressCircular: true,
  VSnackbar: true,
  VDialog: true,
  VOverlay: true
}

// Suppress specific console warnings during tests
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

console.warn = (...args) => {
  const message = args.join(' ')
  if (
    message.includes('visualViewport') ||
    message.includes('ResizeObserver') ||
    message.includes('IntersectionObserver') ||
    message.includes('[Vuetify]')
  ) {
    return
  }
  originalConsoleWarn(...args)
}

console.error = (...args) => {
  const message = args.join(' ')
  if (
    message.includes('visualViewport') ||
    message.includes('ResizeObserver') ||
    message.includes('IntersectionObserver') ||
    message.includes('[Vuetify]')
  ) {
    return
  }
  originalConsoleError(...args)
} 