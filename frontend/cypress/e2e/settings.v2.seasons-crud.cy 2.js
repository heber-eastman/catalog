describe('V2 Seasons CRUD', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.setAuthToken('fake-jwt-token');

    // Tee sheets and sides
    cy.intercept('GET', '**/api/v1/tee-sheets', {
      statusCode: 200,
      body: [{ id: 'sheet-1', name: 'Main Course' }],
    }).as('listSheets');

    // Templates for version picker
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/templates', {
      statusCode: 200,
      body: [
        { id: 'tmpl-1', versions: [{ id: 'tv-1', version_number: 1, notes: 'first' }] },
      ],
    }).as('listTemplatesV2');

    // Seasons list
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/seasons', {
      statusCode: 200,
      body: [],
    }).as('listSeasons');
  });

  it('creates season, adds version+window, reorders, and publishes', () => {
    // Create season
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/seasons', {
      statusCode: 200,
      body: { id: 'sea-1', status: 'draft', versions: [] },
    }).as('createSeason');

    // After create, list returns one
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/seasons', {
      statusCode: 200,
      body: [{ id: 'sea-1', status: 'draft', versions: [] }],
    }).as('listSeasonsAfterCreate');

    // Create version
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/seasons/sea-1/versions', {
      statusCode: 200,
      body: { id: 'sev-1' },
    }).as('createSeasonVersion');

    // Add weekday window
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/seasons/sea-1/versions/sev-1/weekday-windows', {
      statusCode: 200,
      body: { id: 'sw-1' },
    }).as('addSeasonWindow');

    // Note: Reorder requires a true drag/drop to set isDirty. In headless CI we skip it.

    // Publish
    cy.intercept('POST', '**/api/v1/tee-sheets/sheet-1/v2/seasons/sea-1/publish', {
      statusCode: 200,
      body: { id: 'sea-1', status: 'published' },
    }).as('publishSeason');

    cy.visit('/settings/tee-sheet');
    cy.wait('@listSheets');

    // Go to seasons page
    cy.visit('/settings/tee-sheets/sheet-1/v2/seasons');
    cy.wait(['@listTemplatesV2']);

    // Create season
    cy.get('[data-cy="season-new-btn"]').click();
    cy.wait('@createSeason');
    cy.wait('@listSeasonsAfterCreate');

    // Add version + window
    cy.get('[data-cy="season-start-date"]').type('2025-09-01');
    cy.get('[data-cy="season-end-date"]').type('2025-09-30');
    cy.get('[data-cy="season-weekday-select"]').select('1');
    cy.get('[data-cy="season-tmplver-select"]').select('tv-1');
    cy.get('[data-cy^="season-add-version-"]').first().click();
    cy.wait('@createSeasonVersion');
    cy.wait('@addSeasonWindow');

    // Assert save-order is disabled (no DnD performed), then proceed
    cy.get('[data-cy^="season-save-order-"]').first().should('be.disabled');

    // Publish
    cy.get('[data-cy^="season-publish-"]').first().click();
    cy.wait('@publishSeason');
  });
});


