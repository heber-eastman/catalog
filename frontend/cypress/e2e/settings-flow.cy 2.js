describe('Admin Settings Flow', () => {
  it('timeframes: validates and previews generation', () => {
    cy.visit('/settings/timeframes', {
      onBeforeLoad(win){ win.localStorage.setItem('jwt_token','test'); }
    });
    // Intercepts
    cy.intercept('GET', '**/api/v1/tee-sheets/check-clean*', { statusCode: 200, body: { clean: true, date: '2025-08-15' } }).as('checkClean');
    cy.intercept('POST', '**/api/v1/internal/generate', { statusCode: 200, body: { ok: true } }).as('generate');

    // No errors initially
    cy.get('.errors').should('not.exist');
    // Click preview generate
    cy.contains('Preview Generate').click();
    cy.wait('@checkClean');
    cy.wait('@generate');
  });
});


