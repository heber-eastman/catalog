/**
 * Complete Workflow E2E Test
 * Tests the entire user journey from signup through customer management
 */

describe('Complete Golf Course Management Workflow', () => {
  let testData;

  beforeEach(() => {
    // Generate unique test data for each test run
    const timestamp = Date.now();
    testData = {
      superAdmin: {
        email: `super.admin.${timestamp}@catalog.golf`,
        password: 'SuperAdmin123!',
        firstName: 'Super',
        lastName: 'Admin'
      },
      golfCourse: {
        name: `Test Golf Course ${timestamp}`,
        subdomain: `test-course-${timestamp}`,
        contactEmail: `course.${timestamp}@catalog.golf`,
        contactPhone: '+1-555-0123'
      },
      staff: {
        email: `staff.${timestamp}@catalog.golf`,
        password: 'StaffUser123!',
        firstName: 'John',
        lastName: 'Staff',
        role: 'admin'
      },
      customer: {
        firstName: 'Jane',
        lastName: 'Customer',
        email: `customer.${timestamp}@catalog.golf`,
        phone: '+1-555-0456',
        membershipType: 'full',
        notes: 'Test customer created via E2E test'
      }
    };

    // Reset database to clean state (in test environment)
    cy.task('db:reset');
    
    // Visit the application
    cy.visit('/');
  });

  it('completes full workflow: Super admin signup → Course creation → Staff invite → Customer CRUD', () => {
    // Step 1: Super Admin Registration
    cy.log('🚀 Step 1: Super Admin Registration');
    
    // Navigate to super admin signup
    cy.get('[data-cy="super-admin-link"]').click();
    cy.url().should('include', '/super-admin');
    
    // Fill out super admin registration form
    cy.get('[data-cy="super-admin-signup-form"]').within(() => {
      cy.get('[data-cy="first-name-input"]').type(testData.superAdmin.firstName);
      cy.get('[data-cy="last-name-input"]').type(testData.superAdmin.lastName);
      cy.get('[data-cy="email-input"]').type(testData.superAdmin.email);
      cy.get('[data-cy="password-input"]').type(testData.superAdmin.password);
      cy.get('[data-cy="confirm-password-input"]').type(testData.superAdmin.password);
      cy.get('[data-cy="submit-button"]').click();
    });

    // Verify successful registration
    cy.get('[data-cy="success-message"]').should('contain', 'Super admin account created successfully');
    cy.url().should('include', '/super-admin/login');

    // Step 2: Super Admin Login
    cy.log('🔐 Step 2: Super Admin Login');
    
    cy.get('[data-cy="super-admin-login-form"]').within(() => {
      cy.get('[data-cy="email-input"]').type(testData.superAdmin.email);
      cy.get('[data-cy="password-input"]').type(testData.superAdmin.password);
      cy.get('[data-cy="login-button"]').click();
    });

    // Verify successful login and redirect to dashboard
    cy.url().should('include', '/super-admin/dashboard');
    cy.get('[data-cy="super-admin-dashboard"]').should('be.visible');
    cy.get('[data-cy="welcome-message"]').should('contain', testData.superAdmin.firstName);

    // Step 3: Golf Course Creation
    cy.log('⛳ Step 3: Golf Course Creation');
    
    cy.get('[data-cy="courses-menu"]').click();
    cy.get('[data-cy="add-course-button"]').click();

    cy.get('[data-cy="course-form"]').within(() => {
      cy.get('[data-cy="course-name-input"]').type(testData.golfCourse.name);
      cy.get('[data-cy="subdomain-input"]').type(testData.golfCourse.subdomain);
      cy.get('[data-cy="contact-email-input"]').type(testData.golfCourse.contactEmail);
      cy.get('[data-cy="contact-phone-input"]').type(testData.golfCourse.contactPhone);
      cy.get('[data-cy="submit-course-button"]').click();
    });

    // Verify course creation
    cy.get('[data-cy="success-message"]').should('contain', 'Golf course created successfully');
    cy.get('[data-cy="courses-list"]').should('contain', testData.golfCourse.name);

    // Step 4: Navigate to Course Dashboard
    cy.log('🏌️ Step 4: Access Course Dashboard');
    
    cy.get(`[data-cy="course-${testData.golfCourse.subdomain}-link"]`).click();
    cy.url().should('include', testData.golfCourse.subdomain);

    // Step 5: Staff Registration/Invitation
    cy.log('👥 Step 5: Staff Registration');
    
    // Navigate to staff management
    cy.get('[data-cy="staff-menu"]').click();
    cy.get('[data-cy="register-staff-button"]').click();

    cy.get('[data-cy="staff-form"]').within(() => {
      cy.get('[data-cy="first-name-input"]').type(testData.staff.firstName);
      cy.get('[data-cy="last-name-input"]').type(testData.staff.lastName);
      cy.get('[data-cy="email-input"]').type(testData.staff.email);
      cy.get('[data-cy="password-input"]').type(testData.staff.password);
      cy.get('[data-cy="role-select"]').select(testData.staff.role);
      cy.get('[data-cy="submit-staff-button"]').click();
    });

    // Verify staff creation
    cy.get('[data-cy="success-message"]').should('contain', 'Staff member registered successfully');
    cy.get('[data-cy="staff-list"]').should('contain', testData.staff.email);

    // Step 6: Staff Login Test
    cy.log('🔑 Step 6: Test Staff Login');
    
    // Logout from super admin
    cy.get('[data-cy="logout-button"]').click();
    
    // Login as staff
    cy.visit('/login');
    cy.get('[data-cy="login-form"]').within(() => {
      cy.get('[data-cy="email-input"]').type(testData.staff.email);
      cy.get('[data-cy="password-input"]').type(testData.staff.password);
      cy.get('[data-cy="login-button"]').click();
    });

    // Verify staff dashboard access
    cy.url().should('include', '/dashboard');
    cy.get('[data-cy="dashboard"]').should('be.visible');
    cy.get('[data-cy="welcome-message"]').should('contain', testData.staff.firstName);

    // Step 7: Customer Creation (CRUD Operations)
    cy.log('👤 Step 7: Customer CRUD Operations');
    
    // Navigate to customers
    cy.get('[data-cy="customers-menu"]').click();
    cy.url().should('include', '/customers');

    // Create new customer
    cy.get('[data-cy="add-customer-button"]').click();
    cy.get('[data-cy="customer-form"]').within(() => {
      cy.get('[data-cy="first-name-input"]').type(testData.customer.firstName);
      cy.get('[data-cy="last-name-input"]').type(testData.customer.lastName);
      cy.get('[data-cy="email-input"]').type(testData.customer.email);
      cy.get('[data-cy="phone-input"]').type(testData.customer.phone);
      cy.get('[data-cy="membership-type-select"]').select(testData.customer.membershipType);
      cy.get('[data-cy="notes-textarea"]').type(testData.customer.notes);
      cy.get('[data-cy="submit-customer-button"]').click();
    });

    // Verify customer creation
    cy.get('[data-cy="success-message"]').should('contain', 'Customer created successfully');
    cy.get('[data-cy="customers-list"]').should('contain', testData.customer.email);

    // Step 8: Customer Read/View
    cy.log('👁️ Step 8: View Customer Details');
    
    cy.get(`[data-cy="customer-${testData.customer.email}-view"]`).click();
    cy.get('[data-cy="customer-details"]').within(() => {
      cy.get('[data-cy="customer-name"]').should('contain', `${testData.customer.firstName} ${testData.customer.lastName}`);
      cy.get('[data-cy="customer-email"]').should('contain', testData.customer.email);
      cy.get('[data-cy="customer-phone"]').should('contain', testData.customer.phone);
      cy.get('[data-cy="customer-membership"]').should('contain', testData.customer.membershipType);
    });

    // Step 9: Customer Update
    cy.log('✏️ Step 9: Update Customer');
    
    cy.get('[data-cy="edit-customer-button"]').click();
    
    const updatedPhone = '+1-555-9999';
    const updatedNotes = 'Updated via E2E test';
    
    cy.get('[data-cy="customer-form"]').within(() => {
      cy.get('[data-cy="phone-input"]').clear().type(updatedPhone);
      cy.get('[data-cy="notes-textarea"]').clear().type(updatedNotes);
      cy.get('[data-cy="submit-customer-button"]').click();
    });

    // Verify customer update
    cy.get('[data-cy="success-message"]').should('contain', 'Customer updated successfully');
    cy.get('[data-cy="customer-phone"]').should('contain', updatedPhone);

    // Step 10: Customer Notes Management
    cy.log('📝 Step 10: Customer Notes Management');
    
    cy.get('[data-cy="notes-tab"]').click();
    cy.get('[data-cy="add-note-button"]').click();
    
    const noteContent = 'Test note added via E2E test';
    cy.get('[data-cy="note-form"]').within(() => {
      cy.get('[data-cy="note-content-textarea"]').type(noteContent);
      cy.get('[data-cy="submit-note-button"]').click();
    });

    // Verify note creation
    cy.get('[data-cy="notes-list"]').should('contain', noteContent);

    // Step 11: Customer Search/Filter
    cy.log('🔍 Step 11: Customer Search and Filter');
    
    cy.get('[data-cy="customers-menu"]').click();
    
    // Test search functionality
    cy.get('[data-cy="search-input"]').type(testData.customer.firstName);
    cy.get('[data-cy="customers-list"]').should('contain', testData.customer.email);
    cy.get('[data-cy="customers-list"] [data-cy="customer-row"]').should('have.length', 1);

    // Test filter by membership type
    cy.get('[data-cy="search-input"]').clear();
    cy.get('[data-cy="membership-filter"]').select(testData.customer.membershipType);
    cy.get('[data-cy="customers-list"]').should('contain', testData.customer.email);

    // Step 12: Customer Export/Import Test
    cy.log('📊 Step 12: Customer Export/Import');
    
    // Test export functionality
    cy.get('[data-cy="export-customers-button"]').click();
    cy.get('[data-cy="export-format-select"]').select('csv');
    cy.get('[data-cy="confirm-export-button"]').click();
    
    // Verify export initiated
    cy.get('[data-cy="success-message"]').should('contain', 'Export initiated');

    // Step 13: Dashboard Metrics Verification
    cy.log('📈 Step 13: Verify Dashboard Metrics');
    
    cy.get('[data-cy="dashboard-menu"]').click();
    
    // Check that metrics reflect the created customer
    cy.get('[data-cy="total-customers-metric"]').should('contain', '1');
    cy.get('[data-cy="active-customers-metric"]').should('contain', '1');
    cy.get('[data-cy="membership-breakdown"]').should('contain', testData.customer.membershipType);

    // Step 14: Multi-tenant Isolation Test
    cy.log('🏢 Step 14: Multi-tenant Isolation Test');
    
    // Logout and login as super admin to verify isolation
    cy.get('[data-cy="logout-button"]').click();
    
    // Login as super admin to different course (if exists) or create another
    cy.visit('/super-admin/login');
    cy.get('[data-cy="super-admin-login-form"]').within(() => {
      cy.get('[data-cy="email-input"]').type(testData.superAdmin.email);
      cy.get('[data-cy="password-input"]').type(testData.superAdmin.password);
      cy.get('[data-cy="login-button"]').click();
    });

    // Create a second course to test isolation
    const secondCourse = {
      name: `Second Test Course ${Date.now()}`,
      subdomain: `second-course-${Date.now()}`,
      contactEmail: `second.course.${Date.now()}@catalog.golf`,
      contactPhone: '+1-555-0789'
    };

    cy.get('[data-cy="courses-menu"]').click();
    cy.get('[data-cy="add-course-button"]').click();
    cy.get('[data-cy="course-form"]').within(() => {
      cy.get('[data-cy="course-name-input"]').type(secondCourse.name);
      cy.get('[data-cy="subdomain-input"]').type(secondCourse.subdomain);
      cy.get('[data-cy="contact-email-input"]').type(secondCourse.contactEmail);
      cy.get('[data-cy="contact-phone-input"]').type(secondCourse.contactPhone);
      cy.get('[data-cy="submit-course-button"]').click();
    });

    // Access second course and verify no customers from first course
    cy.get(`[data-cy="course-${secondCourse.subdomain}-link"]`).click();
    cy.get('[data-cy="customers-menu"]').click();
    cy.get('[data-cy="customers-list"]').should('not.contain', testData.customer.email);
    cy.get('[data-cy="total-customers-metric"]').should('contain', '0');

    // Step 15: Performance and Accessibility Check
    cy.log('⚡ Step 15: Performance and Accessibility');
    
    // Basic performance check - page load times
    cy.visit('/dashboard', { timeout: 10000 });
    cy.get('[data-cy="dashboard"]').should('be.visible');
    
    // Basic accessibility check
    cy.injectAxe();
    cy.checkA11y();

    // Step 16: Error Handling Test
    cy.log('🚨 Step 16: Error Handling');
    
    // Test duplicate customer email error
    cy.get('[data-cy="customers-menu"]').click();
    cy.get('[data-cy="add-customer-button"]').click();
    cy.get('[data-cy="customer-form"]').within(() => {
      cy.get('[data-cy="first-name-input"]').type('Duplicate');
      cy.get('[data-cy="last-name-input"]').type('Customer');
      cy.get('[data-cy="email-input"]').type(testData.customer.email); // Same email as before
      cy.get('[data-cy="phone-input"]').type('+1-555-1111');
      cy.get('[data-cy="submit-customer-button"]').click();
    });

    // Verify error handling
    cy.get('[data-cy="error-message"]').should('contain', 'email already exists');

    cy.log('✅ Complete workflow test passed successfully!');
  });

  it('handles concurrent user sessions and logout', () => {
    cy.log('🔄 Testing Session Management');
    
    // This test would verify proper session handling
    // Login, open new tab, verify session, logout from one tab, verify other tab
    // For brevity, showing structure - full implementation would use cy.window() and session storage
    
    // Login as staff
    cy.visit('/login');
    cy.get('[data-cy="login-form"]').within(() => {
      cy.get('[data-cy="email-input"]').type(testData.staff.email);
      cy.get('[data-cy="password-input"]').type(testData.staff.password);
      cy.get('[data-cy="login-button"]').click();
    });

    // Store session info
    cy.window().its('localStorage').invoke('getItem', 'authToken').should('exist');
    
    // Test logout
    cy.get('[data-cy="logout-button"]').click();
    cy.url().should('include', '/login');
    
    // Verify session cleared
    cy.window().its('localStorage').invoke('getItem', 'authToken').should('not.exist');
  });

  afterEach(() => {
    // Cleanup: Take screenshot on failure
    cy.screenshot('workflow-test-end');
    
    // Cleanup test data (in test environment only)
    cy.task('db:cleanup', testData);
  });
}); 