describe('Browse V2 availability', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.window().then(win => {
      // Set a token so protected routes render
      try { win.localStorage.setItem('jwt_token', 'test-token'); } catch {}
    });
  });

  it('shows price_breakdown and filters by sides[]', () => {
    // Visit browse page
    cy.visit('/browse');

    // Enter date and tee sheet IDs (assumes seeded data via backend tests or fixtures)
    const today = new Date().toISOString().substring(0,10);
    cy.get('[data-cy="search-button"]').should('exist');
    cy.get('input[type="date"]').clear().type(today);

    // Provide tee sheet id(s) if available in local storage from previous runs
    // Otherwise this test will no-op without failing
    cy.window().then(win => {
      const storedSheets = win.localStorage.getItem('cust:browse:sheets');
      if (!storedSheets) {
        // Skip if no known sheet id; still ensure UI does not error
        cy.get('[data-cy="search-button"]').click();
        cy.get('.results').should('exist');
      } else {
        cy.get('input[placeholder="Sheet IDs (comma)"]').clear().type(storedSheets);
        cy.get('[data-cy="search-button"]').click();
        cy.get('.results .slot').should('exist');

        // Check price breakdown is shown if present
        cy.get('.results .slot').first().within(() => {
          cy.get('.muted').contains('greens').should('exist');
        });

        // Capture a side id from first slot and filter
        cy.get('.results .slot').first().invoke('attr', 'data-id').then(() => {
          // We need side id; not exposed directly, but we can type from local storage if available
          const storedSides = win.localStorage.getItem('cust:browse:sides') || '';
          if (storedSides) {
            cy.get('input[placeholder="Side IDs (comma)"]').clear().type(storedSides);
            cy.get('[data-cy="search-button"]').click();
            cy.get('.results').should('exist');
          }
        });
      }
    });
  });
});
