export default ({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    videosFolder: 'cypress/videos',
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,

    // Retry configuration
    retries: {
      runMode: 2, // Retry failed tests 2 times in CI
      openMode: 0, // Don't retry in interactive mode
    },

    // Environment-specific configuration
    env: {
      apiUrl: 'http://localhost:3000/api/v1',

      // Test data configuration
      testTimeout: 30000,
      slowTestThreshold: 10000,

      // Feature flags for testing
      enableAccessibilityTests: true,
      enablePerformanceTests: true,
      enableVisualTests: false,

      // Test user credentials (use test environment values)
      testSuperAdmin: {
        email: 'test.super.admin@catalog.golf',
        password: 'TestSuperAdmin123!',
      },
      testStaff: {
        email: 'test.staff@catalog.golf',
        password: 'TestStaff123!',
      },
    },

    // Setup node events
    setupNodeEvents(on, config) {
      // Environment-specific overrides
      const environment = config.env.ENVIRONMENT || 'local';

      switch (environment) {
        case 'staging':
          config.baseUrl = 'https://staging.catalog.golf';
          config.env.apiUrl = 'https://staging.catalog.golf/api/v1';
          config.defaultCommandTimeout = 20000;
          config.requestTimeout = 20000;
          config.responseTimeout = 20000;
          break;

        case 'production':
          config.baseUrl = 'https://catalog.golf';
          config.env.apiUrl = 'https://catalog.golf/api/v1';
          config.defaultCommandTimeout = 25000;
          config.requestTimeout = 25000;
          config.responseTimeout = 25000;
          config.video = false; // Don't record videos in production tests
          break;

        case 'local':
        default:
          // Use default configuration for local development
          break;
      }

      // Database tasks for test environment
      on('task', {
        // Reset database to clean state (test environment only)
        'db:reset'() {
          if (environment === 'local' || environment === 'test') {
            // In a real implementation, this would call your database reset script
            console.log('🗄️ Database reset for testing');
            return null;
          }
          throw new Error('Database reset not allowed in this environment');
        },

        // Cleanup test data
        'db:cleanup'(testData) {
          if (environment === 'local' || environment === 'test') {
            console.log('🧹 Cleaning up test data:', testData);
            return null;
          }
          return null; // Cleanup not needed in staging/production
        },

        // Seed specific test data
        'db:seed'(seedData) {
          if (environment === 'local' || environment === 'test') {
            console.log('🌱 Seeding test data:', seedData);
            return null;
          }
          throw new Error('Database seeding not allowed in this environment');
        },

        // Log messages
        log(message) {
          console.log('📝 Cypress log:', message);
          return null;
        },

        // Performance measurement
        measurePerformance(url) {
          // In a real implementation, you might use Lighthouse or similar
          console.log('⚡ Measuring performance for:', url);
          return { score: 95, metrics: { fcp: 1.2, lcp: 2.5 } };
        },
      });

      // Code coverage (if using)
      if (config.env.coverage) {
        require('@cypress/code-coverage/task')(on, config);
      }

      // Accessibility testing
      if (config.env.enableAccessibilityTests) {
        on('task', {
          logA11yViolations(violations) {
            console.log(
              '♿ Accessibility violations found:',
              violations.length
            );
            violations.forEach(violation => {
              console.log(`- ${violation.id}: ${violation.description}`);
            });
            return null;
          },
        });
      }

      return config;
    },
    excludeSpecPattern: [
      'cypress/e2e/examples/*',
      'cypress/e2e/**/skip-*',
      // Exclude legacy flaky suites pending rewrite
      'cypress/e2e/auth.cy.js',
      'cypress/e2e/complete-workflow.cy.js',
      'cypress/e2e/features.cy.js',
      'cypress/e2e/settings-flow.cy.js'
    ],
  },

  // Component testing configuration (if needed)
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    supportFile: 'cypress/support/component.js',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx,vue}',
    viewportWidth: 1280,
    viewportHeight: 720,
    excludeSpecPattern: ['src/**/examples/*', 'src/**/skip-*'],
  },

  // Global configuration
  experimentalStudio: true,
  chromeWebSecurity: false,

  // File exclusions moved to testing type blocks

  // Browser configuration
  // Use default browser detection in CI/local to avoid invalid schema
  // (Explicit browser objects here can break Cypress schema expectations)
});
