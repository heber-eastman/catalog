describe('Section 10 - Feature UIs & E2E Tests', () => {
  beforeEach(() => {
    // Clear any existing auth state
    cy.clearLocalStorage()
    cy.clearCookies()
    
    // Mock successful login for protected routes
    cy.window().then((win) => {
      win.localStorage.setItem('token', 'mock-jwt-token')
    })
  })

  describe('Dashboard StatusCard Components', () => {
    it('should display status cards on dashboard', () => {
      cy.visit('/dashboard')
      
      // Check that status cards are displayed
      cy.dataCy('customers-status-card').should('be.visible')
      cy.dataCy('staff-status-card').should('be.visible')
      cy.dataCy('course-status-card').should('be.visible')
      cy.dataCy('bookings-status-card').should('be.visible')
    })

    it('should navigate to customers when status card action is clicked', () => {
      cy.visit('/dashboard')
      
      cy.dataCy('customers-status-card').within(() => {
        cy.contains('View All').click()
      })
      
      cy.url().should('include', '/customers')
    })

    it('should display trend indicators in status cards', () => {
      cy.visit('/dashboard')
      
      // Check for trend indicators (icons and text)
      cy.dataCy('customers-status-card').within(() => {
        cy.get('.text-success').should('exist') // Up trend
      })
    })
  })

  describe('Enhanced CustomersList Features', () => {
    beforeEach(() => {
      cy.visit('/customers')
      cy.wait(1000) // Wait for API calls
    })

    it('should display enhanced customers management interface', () => {
      cy.contains('Customers Management').should('be.visible')
      
      // Check for new action buttons
      cy.dataCy('import-customers-btn').should('be.visible')
      cy.dataCy('export-customers-btn').should('be.visible')
      cy.dataCy('add-customer-btn').should('be.visible')
    })

    it('should display filtering options', () => {
      cy.dataCy('search-customers').should('be.visible')
      cy.dataCy('status-filter').should('be.visible')
      cy.dataCy('sort-by').should('be.visible')
      cy.dataCy('clear-filters-btn').should('be.visible')
    })

    it('should filter customers by search term', () => {
      cy.dataCy('search-customers').type('john')
      cy.wait(500) // Wait for debounced search
      
      // Should filter results (assuming there's test data)
      cy.dataCy('customers-table').should('be.visible')
    })

    it('should filter customers by status', () => {
      cy.dataCy('status-filter').click()
      cy.get('.v-list-item').contains('Active').click()
      
      // Should apply status filter
      cy.dataCy('customers-table').should('be.visible')
    })

    it('should clear all filters', () => {
      // Set some filters first
      cy.dataCy('search-customers').type('test')
      cy.dataCy('status-filter').click()
      cy.get('.v-list-item').contains('Active').click()
      
      // Clear filters
      cy.dataCy('clear-filters-btn').click()
      
      // Verify filters are cleared
      cy.dataCy('search-customers').should('have.value', '')
    })

    it('should open import dialog', () => {
      cy.dataCy('import-customers-btn').click()
      
      cy.get('.v-dialog').should('be.visible')
      cy.contains('Import Customers').should('be.visible')
      cy.dataCy('import-file-input').should('be.visible')
      
      // Close dialog
      cy.dataCy('cancel-import-btn').click()
      cy.get('.v-dialog').should('not.exist')
    })

    it('should open export dialog with options', () => {
      cy.dataCy('export-customers-btn').click()
      
      cy.get('.v-dialog').should('be.visible')
      cy.contains('Export Customers').should('be.visible')
      
      // Check export options
      cy.dataCy('export-type').should('be.visible')
      cy.dataCy('export-format').should('be.visible')
      
      // Test different export types
      cy.get('input[value="all"]').should('be.checked')
      cy.get('label').contains('Selected customers only').click()
      cy.get('input[value="selected"]').should('be.checked')
      
      // Close dialog
      cy.dataCy('cancel-export-btn').click()
    })

    it('should show bulk actions when customers are selected', () => {
      // This test assumes there are customers in the table
      cy.get('.v-data-table .v-checkbox').first().click({ force: true })
      
      // Should show bulk delete button
      cy.dataCy('bulk-delete-btn').should('be.visible')
    })

    it('should open customer creation dialog', () => {
      cy.dataCy('add-customer-btn').click()
      
      cy.get('.v-dialog').should('be.visible')
      cy.contains('Add New Customer').should('be.visible')
      
      // Check form fields
      cy.dataCy('customer-first-name').should('be.visible')
      cy.dataCy('customer-last-name').should('be.visible')
      cy.dataCy('customer-email').should('be.visible')
      cy.dataCy('customer-phone').should('be.visible')
      cy.dataCy('customer-status-select').should('be.visible')
      
      // Close dialog
      cy.dataCy('cancel-customer-btn').click()
    })

    it('should validate customer form', () => {
      cy.dataCy('add-customer-btn').click()
      
      // Try to save without required fields
      cy.dataCy('save-customer-btn').should('be.disabled')
      
      // Fill required fields
      cy.dataCy('customer-first-name').type('John')
      cy.dataCy('customer-last-name').type('Doe')
      cy.dataCy('customer-email').type('john.doe@example.com')
      
      // Now save button should be enabled
      cy.dataCy('save-customer-btn').should('not.be.disabled')
      
      // Close dialog
      cy.dataCy('cancel-customer-btn').click()
    })
  })

  describe('CustomerProfile Page', () => {
    it('should navigate to customer profile from list', () => {
      cy.visit('/customers')
      cy.wait(1000)
      
      // Click on view button for first customer (if exists)
      cy.get('[data-cy="view-customer-btn"]').first().click({ force: true })
      
      // Should navigate to profile page
      cy.url().should('match', /\/customers\/\d+/)
    })

    it('should display customer profile information', () => {
      // Visit a customer profile directly
      cy.visit('/customers/1')
      
      cy.dataCy('back-btn').should('be.visible')
      cy.dataCy('customer-name').should('be.visible')
      
      // Check for customer information sections
      cy.contains('Customer Information').should('be.visible')
      cy.contains('Actions').should('be.visible')
    })

    it('should navigate back from customer profile', () => {
      cy.visit('/customers/1')
      
      cy.dataCy('back-btn').click()
      
      // Should navigate back to customers list
      cy.url().should('include', '/customers')
      cy.url().should('not.match', /\/customers\/\d+/)
    })
  })

  describe('Dashboard Enhanced Features', () => {
    it('should display enhanced dashboard with status cards', () => {
      cy.visit('/dashboard')
      
      // Check for status cards row
      cy.get('.v-row').contains('Total Customers').should('be.visible')
      
      // Check for quick actions
      cy.dataCy('manage-customers-btn').should('be.visible')
      cy.dataCy('manage-staff-btn').should('be.visible')
      cy.dataCy('test-customers-api-btn').should('be.visible')
      cy.dataCy('test-staff-api-btn').should('be.visible')
      cy.dataCy('refresh-dashboard-btn').should('be.visible')
    })

    it('should display recent activity section', () => {
      cy.visit('/dashboard')
      
      cy.contains('Recent Activity').should('be.visible')
    })

    it('should refresh dashboard data', () => {
      cy.visit('/dashboard')
      
      cy.dataCy('refresh-dashboard-btn').click()
      
      // Should show loading state and then complete
      cy.get('.v-progress-circular').should('not.exist', { timeout: 5000 })
    })

    it('should test API endpoints from dashboard', () => {
      cy.visit('/dashboard')
      
      // Test customers API
      cy.dataCy('test-customers-api-btn').click()
      
      // Should show API response
      cy.contains('API Test Results').should('be.visible')
      
      // Test staff API
      cy.dataCy('test-staff-api-btn').click()
    })
  })

  describe('Error Handling and Loading States', () => {
    it('should handle loading states gracefully', () => {
      cy.visit('/customers')
      
      // Should show loading initially
      cy.get('.v-data-table-progress').should('be.visible')
      
      // Wait for loading to complete
      cy.get('.v-data-table-progress').should('not.exist', { timeout: 10000 })
    })

    it('should display empty states correctly', () => {
      cy.visit('/customers')
      cy.wait(2000)
      
      // If no customers, should show empty state
      cy.get('.v-data-table').within(() => {
        cy.get('tbody tr').then(($rows) => {
          if ($rows.length === 0) {
            cy.contains('No customers found').should('be.visible')
          }
        })
      })
    })

    it('should handle form validation errors', () => {
      cy.visit('/customers')
      
      cy.dataCy('add-customer-btn').click()
      
      // Enter invalid email
      cy.dataCy('customer-first-name').type('John')
      cy.dataCy('customer-last-name').type('Doe')
      cy.dataCy('customer-email').type('invalid-email')
      
      // Click away to trigger validation
      cy.dataCy('customer-phone').click()
      
      // Should show validation error
      cy.contains('Email must be valid').should('be.visible')
    })
  })

  describe('Staff Management Enhanced', () => {
    beforeEach(() => {
      cy.visit('/staff')
    })

    it('should display staff management page with enhanced features', () => {
      cy.contains('h1', 'Staff Management').should('be.visible')
      cy.dataCy('invite-staff-btn').should('be.visible')
      cy.dataCy('staff-search').should('be.visible')
    })

    it('should open and validate invite staff dialog', () => {
      cy.dataCy('invite-staff-btn').click()
      
      // Check dialog elements
      cy.dataCy('invite-first-name').should('be.visible')
      cy.dataCy('invite-last-name').should('be.visible')
      cy.dataCy('invite-email').should('be.visible')
      cy.dataCy('invite-role').should('be.visible')
      cy.dataCy('invite-phone').should('be.visible')
      
      // Test form validation
      cy.dataCy('invite-submit').should('be.disabled')
      
      // Fill required fields
      cy.dataCy('invite-first-name').type('John')
      cy.dataCy('invite-last-name').type('Doe')
      cy.dataCy('invite-email').type('john.doe@example.com')
      cy.dataCy('invite-role').click()
      cy.contains('.v-list-item', 'Staff').click()
      
      cy.dataCy('invite-submit').should('not.be.disabled')
      
      // Cancel dialog
      cy.dataCy('invite-cancel').click()
    })

    it('should handle edit staff functionality', () => {
      // Assuming staff data exists
      cy.get('[data-cy="edit-staff-btn"]', { timeout: 10000 }).first().click({ force: true })
      
      cy.dataCy('edit-first-name').should('be.visible')
      cy.dataCy('edit-last-name').should('be.visible')
      cy.dataCy('edit-email').should('be.visible')
      cy.dataCy('edit-role').should('be.visible')
      
      // Cancel edit
      cy.dataCy('edit-cancel').click()
    })

    it('should handle deactivate staff confirmation', () => {
      cy.get('[data-cy="deactivate-staff-btn"]', { timeout: 10000 }).first().click({ force: true })
      
      cy.dataCy('deactivate-confirm').should('be.visible')
      cy.dataCy('deactivate-cancel').should('be.visible')
      
      // Cancel deactivation
      cy.dataCy('deactivate-cancel').click()
    })

    it('should search staff members', () => {
      cy.dataCy('staff-search').type('John')
      cy.dataCy('staff-search').should('have.value', 'John')
      
      // Clear search
      cy.dataCy('staff-search').clear()
    })
  })

  describe('Courses Management Enhanced', () => {
    beforeEach(() => {
      cy.visit('/super-admin/courses')
    })

    it('should display courses management page', () => {
      cy.contains('h1', 'Golf Courses Management').should('be.visible')
      cy.dataCy('add-course-btn').should('be.visible')
    })

    it('should open and validate create course dialog', () => {
      cy.dataCy('add-course-btn').click()
      
      // Check dialog elements
      cy.dataCy('create-course-name').should('be.visible')
      cy.dataCy('create-course-street').should('be.visible')
      cy.dataCy('create-course-city').should('be.visible')
      cy.dataCy('create-course-state').should('be.visible')
      cy.dataCy('create-course-zip').should('be.visible')
      cy.dataCy('create-course-country').should('be.visible')
      
      // Test form validation
      cy.dataCy('create-course-submit').should('be.disabled')
      
      // Fill required field
      cy.dataCy('create-course-name').type('Test Golf Course')
      cy.dataCy('create-course-submit').should('not.be.disabled')
      
      // Cancel dialog
      cy.dataCy('create-course-cancel').click()
    })

    it('should handle edit course functionality', () => {
      cy.get('[data-cy="edit-course-btn"]', { timeout: 10000 }).first().click({ force: true })
      
      cy.dataCy('edit-course-name').should('be.visible')
      cy.dataCy('edit-course-status').should('be.visible')
      
      // Cancel edit
      cy.dataCy('edit-course-cancel').click()
    })

    it('should handle status change confirmation', () => {
      cy.get('[data-cy="toggle-status-btn"]', { timeout: 10000 }).first().click({ force: true })
      
      cy.dataCy('status-change-confirm').should('be.visible')
      cy.dataCy('status-change-cancel').should('be.visible')
      
      // Cancel status change
      cy.dataCy('status-change-cancel').click()
    })
  })

  describe('Super Admins Management Enhanced', () => {
    beforeEach(() => {
      cy.visit('/super-admin/super-admins')
    })

    it('should display super admins management page', () => {
      cy.contains('h1', 'Super Admins Management').should('be.visible')
      cy.dataCy('invite-super-admin-btn').should('be.visible')
      cy.dataCy('super-admin-search').should('be.visible')
    })

    it('should open and validate invite super admin dialog', () => {
      cy.dataCy('invite-super-admin-btn').click()
      
      // Check dialog elements
      cy.dataCy('invite-super-admin-first-name').should('be.visible')
      cy.dataCy('invite-super-admin-last-name').should('be.visible')
      cy.dataCy('invite-super-admin-email').should('be.visible')
      cy.dataCy('invite-super-admin-phone').should('be.visible')
      
      // Test form validation
      cy.dataCy('invite-super-admin-submit').should('be.disabled')
      
      // Fill required fields
      cy.dataCy('invite-super-admin-first-name').type('Jane')
      cy.dataCy('invite-super-admin-last-name').type('Admin')
      cy.dataCy('invite-super-admin-email').type('jane.admin@example.com')
      
      cy.dataCy('invite-super-admin-submit').should('not.be.disabled')
      
      // Cancel dialog
      cy.dataCy('invite-super-admin-cancel').click()
    })

    it('should handle super admin actions', () => {
      // Test edit functionality
      cy.get('[data-cy="edit-super-admin-btn"]', { timeout: 10000 }).first().click({ force: true })
      cy.dataCy('edit-super-admin-first-name').should('be.visible')
      cy.dataCy('edit-super-admin-cancel').click()

      // Test resend invitation
      cy.get('[data-cy="resend-invitation-btn"]', { timeout: 10000 }).first().click({ force: true })

      // Test revoke invitation
      cy.get('[data-cy="revoke-invitation-btn"]', { timeout: 10000 }).first().click({ force: true })

      // Test deactivate
      cy.get('[data-cy="deactivate-super-admin-btn"]', { timeout: 10000 }).first().click({ force: true })
      cy.dataCy('deactivate-super-admin-cancel').click()
    })

    it('should search super admins', () => {
      cy.dataCy('super-admin-search').type('Admin')
      cy.dataCy('super-admin-search').should('have.value', 'Admin')
      
      // Clear search
      cy.dataCy('super-admin-search').clear()
    })
  })

  describe('Responsive Design Tests', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x')
      cy.visit('/customers')
      
      // Elements should still be visible and functional
      cy.dataCy('add-customer-btn').should('be.visible')
      cy.dataCy('search-customers').should('be.visible')
    })

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2')
      cy.visit('/dashboard')
      
      // Status cards should stack appropriately
      cy.dataCy('customers-status-card').should('be.visible')
      cy.dataCy('staff-status-card').should('be.visible')
    })
  })

  describe('Accessibility Tests', () => {
    it('should have proper ARIA labels and roles', () => {
      cy.visit('/customers')
      
      // Check for proper table roles
      cy.get('.v-data-table').should('have.attr', 'role')
      
      // Check for proper button labels
      cy.dataCy('add-customer-btn').should('have.attr', 'aria-label').or('contain.text', 'Add Customer')
    })

    it('should be keyboard navigable', () => {
      cy.visit('/customers')
      
      // Tab through interactive elements
      cy.get('body').tab()
      cy.focused().should('be.visible')
      
      // Continue tabbing
      cy.focused().tab()
      cy.focused().should('be.visible')
    })
  })

  describe('Data Persistence Tests', () => {
    it('should maintain filter state during navigation', () => {
      cy.visit('/customers')
      
      // Set a filter
      cy.dataCy('search-customers').type('test-filter')
      
      // Navigate away and back
      cy.visit('/dashboard')
      cy.visit('/customers')
      
      // Filter should be cleared (expected behavior for fresh page load)
      cy.dataCy('search-customers').should('have.value', '')
    })

    it('should handle browser back/forward correctly', () => {
      cy.visit('/customers')
      cy.visit('/dashboard')
      
      // Go back
      cy.go('back')
      cy.url().should('include', '/customers')
      
      // Go forward
      cy.go('forward')
      cy.url().should('include', '/dashboard')
    })
  })
}) 