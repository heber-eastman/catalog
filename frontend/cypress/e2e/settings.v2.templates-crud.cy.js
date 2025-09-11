describe('V2 Templates CRUD', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.setAuthToken('fake-jwt-token');

    // Tee sheets
    cy.intercept('GET', '**/api/v1/tee-sheets', {
      statusCode: 200,
      body: [{ id: 'sheet-1', name: 'Main Course' }],
    }).as('listSheets');

    // Templates list
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/templates', {
      statusCode: 200,
      body: [],
    }).as('listTemplatesV2');
  });

  it('creates template, adds version, publishes, and triggers regen', () => {
    // Create template
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/templates', {
      statusCode: 200,
      body: { id: 'tmpl-1', status: 'draft', interval_mins: 10 },
    }).as('createTemplate');

    // After create, list returns one
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/templates', {
      statusCode: 200,
      body: [{ id: 'tmpl-1', status: 'draft', interval_mins: 10, versions: [] }],
    }).as('listAfterCreate');

    // Create version
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/templates/tmpl-1/versions', {
      statusCode: 200,
      body: { id: 'tv-1' },
    }).as('createTemplateVersion');

    // After version, list returns one with version
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/templates', {
      statusCode: 200,
      body: [{ id: 'tmpl-1', status: 'draft', interval_mins: 10, versions: [{ id: 'tv-1', version_number: 1 }] }],
    }).as('listAfterVersion');

    // Publish
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/templates/tmpl-1/publish', {
      statusCode: 200,
      body: { id: 'tmpl-1', status: 'published' },
    }).as('publishTemplate');

    // Regen date and range
    cy.intercept('POST', '**/api/v1/internal/tee-sheets/sheet-1/regenerate', {
      statusCode: 200,
      body: { ok: true },
    }).as('regenDate');
    cy.intercept('POST', '**/api/v1/internal/tee-sheets/sheet-1/regenerate-range', {
      statusCode: 200,
      body: { ok: true },
    }).as('regenRange');

    cy.visit('/settings/tee-sheet');
    cy.wait('@listSheets');

    // Go to Templates page
    cy.visit('/settings/tee-sheets/sheet-1/v2/templates');
    cy.get('[data-cy="template-new-btn"]').should('be.visible');

    // Create template
    cy.get('[data-cy="template-new-btn"]').click();
    cy.wait('@createTemplate');
    cy.get('[data-cy^="template-add-version-"]', { timeout: 20000 }).first().should('be.visible');

    // Add version
    cy.get('[data-cy^="template-notes-"]').first().type('initial');
    cy.get('[data-cy^="template-add-version-"]').first().click();
    cy.wait('@createTemplateVersion');
    cy.get('[data-cy^="template-publish-"]').first().should('be.visible');

    // Publish
    cy.get('[data-cy^="template-publish-"]').first().click();
    cy.wait('@publishTemplate');

    // Regen date
    cy.get('[data-cy="regen-date-input"]').type('2025-09-10');
    cy.get('[data-cy="regen-date-go"]').click();
    cy.wait('@regenDate');

    // Regen range
    cy.get('[data-cy="regen-start-input"]').type('2025-09-01');
    cy.get('[data-cy="regen-end-input"]').type('2025-09-30');
    cy.get('[data-cy="regen-range-go"]').click();
    cy.wait('@regenRange');
  });
});
