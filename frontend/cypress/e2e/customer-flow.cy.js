/**
 * Customer Browse → Cart → Checkout → My Tee Times
 */

describe('Customer booking flow', () => {
  it('browses slots, adds to cart, checks out, and manages booking', () => {
    const today = new Date().toISOString().substring(0, 10);

    // Auth bypass: set a token prior to app load
    cy.visit('/browse', {
      onBeforeLoad(win) {
        win.localStorage.setItem('jwt_token', 'test-token');
      },
    });

    // Stub APIs
    cy.intercept('GET', '**/api/v1/tee-times/available*', {
      statusCode: 200,
      body: [
        { id: 'tt-1', tee_sheet_id: 'sheet-1', start_time: `${today}T09:00:00Z`, capacity: 4, remaining: 4, price_total_cents: 1000 },
      ],
    }).as('getAvailable');
    cy.intercept('POST', '**/api/v1/holds/cart', (req) => {
      req.reply({ success: true, expires_in_seconds: 300, hold: { user_id: 'cust-1', source: 'checkout', items: [{ tee_time_id: 'tt-1', party_size: 2 }], created_at: Date.now() } });
    }).as('holdCart');
    cy.intercept('POST', '**/api/v1/bookings', { statusCode: 201, body: { success: true, total_price_cents: 2000 } }).as('createBooking');
    cy.intercept('GET', '**/api/v1/bookings/mine', { statusCode: 200, body: [ { id: 'b-1', tee_sheet_id: 'sheet-1', total_price_cents: 2000, status: 'Active', legs: [ { leg_index: 0, tee_time: { id: 'tt-1', start_time: `${today}T09:00:00Z`, side_id: 'side-1' }, price_cents: 2000 } ] } ] }).as('mine');
    cy.intercept('PATCH', '**/api/v1/bookings/*/reschedule', { statusCode: 200, body: { success: true, total_price_cents: 2000 } }).as('reschedule');
    cy.intercept('DELETE', '**/api/v1/bookings/*', { statusCode: 200, body: { success: true } }).as('cancel');

    // Provide a sheet filter and search
    cy.get('[data-cy="browse"]').within(() => {
      cy.get('input[type="date"]').clear().type(today);
      cy.get('input[placeholder="Sheet IDs (comma)"]').clear().type('sheet-1');
      cy.get('[data-cy="search-button"]').click();
    });
    cy.wait('@getAvailable');

    // Add to cart
    cy.get('[data-cy="add-to-cart"]').first().click();
    cy.wait('@holdCart');
    cy.url().should('include', '/cart');

    // Checkout
    cy.get('[data-cy="checkout"]').click();
    cy.wait('@createBooking');
    cy.url().should('include', '/my-tee-times');

    // My tee times loaded
    cy.wait('@mine');
    cy.get('[data-cy="my-tee-times"]').should('be.visible');

    // Reschedule & cancel paths
    cy.get('[data-cy="reschedule"]').first().click();
    cy.get('input[placeholder="New tee_time_id"]').type('tt-1');
    cy.get('[data-cy="apply-reschedule"]').click();
    cy.wait('@reschedule');
    cy.get('[data-cy="cancel"]').first().click();
    cy.wait('@cancel');
  });
});


