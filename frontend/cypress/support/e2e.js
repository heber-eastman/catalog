// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Custom commands for authentication
Cypress.Commands.add(
  'login',
  (email = 'admin@example.com', password = 'password123') => {
    cy.visit('/login');
    cy.get('[data-cy="email-input"]').type(email);
    cy.get('[data-cy="password-input"]').type(password);
    cy.get('[data-cy="login-button"]').click();

    // Wait for redirect to dashboard
    cy.url().should('include', '/dashboard');
  }
);

Cypress.Commands.add('signup', courseData => {
  const defaultData = {
    course_name: 'Test Golf Course',
    admin_first_name: 'John',
    admin_last_name: 'Doe',
    admin_email: `test.${Date.now()}@example.com`,
    admin_password: 'TestPassword123',
    city: 'Test City',
    state: 'CA',
  };

  const data = { ...defaultData, ...courseData };

  cy.visit('/signup');

  // Fill course information
  cy.get('[data-cy="course-name-input"]').type(data.course_name);
  cy.get('[data-cy="city-input"]').type(data.city);
  cy.get('[data-cy="state-input"]').type(data.state);

  // Fill admin information
  cy.get('[data-cy="admin-first-name-input"]').type(data.admin_first_name);
  cy.get('[data-cy="admin-last-name-input"]').type(data.admin_last_name);
  cy.get('[data-cy="admin-email-input"]').type(data.admin_email);
  cy.get('[data-cy="admin-password-input"]').type(data.admin_password);

  // Submit form
  cy.get('[data-cy="signup-button"]').click();

  return cy.wrap(data);
});

Cypress.Commands.add('logout', () => {
  cy.get('[data-cy="logout-button"]').click();
  cy.url().should('include', '/login');
});

// Clear database before tests (for development/testing)
Cypress.Commands.add('clearDatabase', () => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/test/clear-database`,
    failOnStatusCode: false,
  });
});

// Set authentication token for API requests
Cypress.Commands.add('setAuthToken', token => {
  window.localStorage.setItem('jwt_token', token);
});
