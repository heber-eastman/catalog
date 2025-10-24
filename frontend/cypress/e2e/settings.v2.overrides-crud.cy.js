describe('V2 Overrides CRUD', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.setAuthToken('fake-jwt-token');

    // Tee sheets and sides
    cy.intercept('GET', '**/api/v1/tee-sheets', {
      statusCode: 200,
      body: [{ id: 'sheet-1', name: 'Main Course' }],
    }).as('listSheets');
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/sides', {
      statusCode: 200,
      body: [
        { id: 'side-1', name: 'Front 9' },
        { id: 'side-2', name: 'Back 9' },
      ],
    }).as('listSides');

    // Templates for version picker
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/templates', {
      statusCode: 200,
      body: [
        { id: 'tmpl-1', versions: [{ id: 'tv-1', version_number: 1, notes: 'first' }] },
      ],
    }).as('listTemplatesV2');

    // Overrides list
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/overrides', {
      statusCode: 200,
      body: [],
    }).as('listOverrides');
  });

  it('creates override, adds version and window, and publishes', () => {
    // Create override date flow
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/overrides', {
      statusCode: 200,
      body: { id: 'ov-1', date: '2025-09-10', status: 'draft' },
    }).as('createOverride');

    // After create, list returns the new one
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/overrides', {
      statusCode: 200,
      body: [{ id: 'ov-1', date: '2025-09-10', status: 'draft' }],
    }).as('listOverridesAfterCreate');

    // Create version
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/overrides/ov-1/versions', {
      statusCode: 200,
      body: { id: 'ovv-1' },
    }).as('createOverrideVersion');

    // Add window
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/overrides/ov-1/versions/ovv-1/windows', {
      statusCode: 200,
      body: { id: 'win-1' },
    }).as('addOverrideWindow');

    // Publish
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/overrides/ov-1/publish', {
      statusCode: 200,
      body: { id: 'ov-1', status: 'published' },
    }).as('publishOverride');

    cy.visit('/settings/tee-sheet');
    cy.wait('@listSheets');
    cy.get('.scoping select').select('sheet-1');

    // Go to overrides page
    cy.visit('/settings/tee-sheets/sheet-1/v2/overrides');
    cy.wait(['@listTemplatesV2', '@listSides']);

    // Create override
    cy.get('[data-cy="override-date-input"]').type('2025-09-10');
    cy.get('[data-cy="override-new-btn"]').click();
    cy.wait('@createOverride');
    cy.wait('@listOverridesAfterCreate');

    // Add version
    cy.get('[data-cy="override-add-version-ov-1"]').click();
    cy.wait('@createOverrideVersion');

    // Add window
    cy.get('[data-cy="override-side-select"]').select('side-1');
    cy.get('[data-cy="override-mode-select"]').select('fixed');
    cy.get('[data-cy="override-start-time"]').clear().type('06:30');
    cy.get('[data-cy="override-end-time"]').clear().type('09:30');
    cy.get('[data-cy="override-editor-tmplver-select"]').select('tv-1');
    cy.get('[data-cy="override-add-window-ov-1"]').click();
    cy.wait('@addOverrideWindow');

    // Publish
    cy.get('[data-cy="override-publish-ov-1"]').click();
    cy.wait('@publishOverride');
  });
});


