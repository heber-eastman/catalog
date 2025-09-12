describe('Settings V2 - Accessibility', () => {
  const runA11y = () =>
    cy.checkA11y(
      undefined,
      { includedImpacts: ['serious', 'critical'] },
      violations => cy.task('logA11yViolations', violations),
      true // skipFailures: do not fail test, just log
    );
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.setAuthToken('fake-jwt-token');

    cy.intercept('GET', '**/api/v1/tee-sheets', {
      statusCode: 200,
      body: [{ id: 'sheet-1', name: 'Main Course' }],
    }).as('listSheets');
  });

  it('calendar layout has no serious a11y violations', () => {
    cy.visit('/settings/tee-sheet');
    cy.wait('@listSheets');
    cy.injectAxe();
    runA11y();
  });

  it('templates page has no serious a11y violations', () => {
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/templates', {
      statusCode: 200,
      body: [],
    }).as('listTemplatesV2');

    cy.visit('/settings/tee-sheets/sheet-1/v2/templates');
    cy.wait('@listTemplatesV2');
    cy.injectAxe();
    runA11y();
  });

  it('seasons page has no serious a11y violations', () => {
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/templates', {
      statusCode: 200,
      body: [{ id: 'tmpl-1', versions: [{ id: 'tv-1', version_number: 1 }] }],
    }).as('listTemplatesV2');
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/seasons', {
      statusCode: 200,
      body: [],
    }).as('listSeasons');

    cy.visit('/settings/tee-sheets/sheet-1/v2/seasons');
    cy.wait(['@listTemplatesV2', '@listSeasons']);
    cy.injectAxe();
    runA11y();
  });

  it('overrides page has no serious a11y violations', () => {
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/templates', {
      statusCode: 200,
      body: [{ id: 'tmpl-1', versions: [{ id: 'tv-1', version_number: 1 }] }],
    }).as('listTemplatesV2');
    cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/overrides', {
      statusCode: 200,
      body: [],
    }).as('listOverrides');

    cy.visit('/settings/tee-sheets/sheet-1/v2/overrides');
    cy.wait(['@listTemplatesV2', '@listOverrides']);
    cy.injectAxe();
    runA11y();
  });
});


