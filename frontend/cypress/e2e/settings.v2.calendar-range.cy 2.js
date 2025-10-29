describe('Settings V2 - Calendar Range Regeneration', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.setAuthToken('fake-jwt-token');
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
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/overrides', { statusCode: 200, body: [] }).as('listOverrides');
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/seasons', { statusCode: 200, body: [] }).as('listSeasons');
  });

  it('shows legend and queues range regeneration', () => {
    // Range endpoints
    cy.intercept('POST', '**/api/v1/internal/tee-sheets/sheet-1/regenerate-range', {
      statusCode: 200,
      body: { ok: true },
    }).as('regenRange');

    cy.visit('/settings/tee-sheet');
    cy.wait('@listSheets');

    // Check legend exists
    cy.get('[data-cy="cal-legend"]').should('be.visible').and('contain', 'Override').and('contain', 'Season');

    // Select a day to enable actions
    cy.get('.calendar .cal-grid .day').contains('10').click({ force: true });

    // Open dialog
    cy.get('[data-cy="cal-btn-regenerate-range"]').click();
    cy.get('[data-cy="regen-range-dialog"]').should('be.visible');

    // Fill dates and queue
    cy.get('[data-cy="regen-range-start"]').clear().type('2025-09-10');
    cy.get('[data-cy="regen-range-end"]').clear().type('2025-09-12');
    cy.get('[data-cy="regen-range-queue"]').click();
    cy.wait('@regenRange');
  });
});
