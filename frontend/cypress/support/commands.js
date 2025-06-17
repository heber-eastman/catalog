// Custom commands will be imported in e2e.js

// Example of a custom command:
// Cypress.Commands.add('dataCy', (value) => {
//   return cy.get(`[data-cy=${value}]`)
// })

// Add data-cy attribute helper
Cypress.Commands.add('dataCy', value => {
  return cy.get(`[data-cy=${value}]`);
});

// Wait for element to be visible
Cypress.Commands.add('waitForVisible', (selector, timeout = 10000) => {
  return cy.get(selector, { timeout }).should('be.visible');
});

// Fill form helper
Cypress.Commands.add('fillForm', formData => {
  Object.entries(formData).forEach(([key, value]) => {
    cy.dataCy(`${key}-input`).type(value);
  });
});
