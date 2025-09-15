describe('Settings V2 - Calendar and Navigation', () => {
	beforeEach(() => {
		cy.clearLocalStorage();
		cy.clearCookies();
		cy.setAuthToken('fake-jwt-token');
	});

	it('shows calendar badges, loads preview, and navigates to Overrides/Seasons', () => {
		// Tee sheets
		cy.intercept('GET', '**/api/v1/tee-sheets', {
			statusCode: 200,
			body: [{ id: 'sheet-1', name: 'Main Course' }],
		}).as('listSheets');

		// Sides
		cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/sides', {
			statusCode: 200,
			body: [
				{ id: 'side-1', name: 'Front 9' },
				{ id: 'side-2', name: 'Back 9' },
			],
		}).as('listSides');

		// V2 data for badges
		cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/overrides', {
			statusCode: 200,
			body: [{ id: 'ov-1', date: '2025-09-10', status: 'draft' }],
		}).as('listOverrides');
		cy.intercept('GET', '**/api/v1/tee-sheets/sheet-1/v2/seasons', {
			statusCode: 200,
			body: [{ id: 'sea-1', status: 'published', published_version: { start_date: '2025-09-01', end_date_exclusive: '2025-10-01' } }],
		}).as('listSeasons');

		// Availability preview
		cy.intercept('GET', '**/api/v1/tee-times/available*', (req) => {
			const url = new URL(req.url);
			const date = url.searchParams.get('date');
			if (date === '2025-09-10') {
				req.reply({ statusCode: 200, body: [
					{ id: 't1', tee_sheet_id: 'sheet-1', side_id: 'side-1', start_time: '2025-09-10T12:00:00Z', capacity: 4, remaining: 4, price_total_cents: 5000 },
					{ id: 't2', tee_sheet_id: 'sheet-1', side_id: 'side-2', start_time: '2025-09-10T12:08:00Z', capacity: 4, remaining: 2, price_total_cents: 5000 },
				]});
			} else {
				req.reply({ statusCode: 200, body: [] });
			}
		}).as('available');

		cy.visit('/settings/tee-sheet');
		cy.wait('@listSheets');

		// Ensure a sheet is selected
		cy.get('.scoping select').should('exist');
		cy.get('.scoping select').invoke('val').then((val) => {
			if (!val) cy.get('.scoping select').select('sheet-1');
		});

		// Select the 10th and verify actions enable
		cy.get('.calendar .cal-grid .day').contains('10').click({ force: true });
		cy.contains('button', 'Overrides').should('not.be.disabled');
		cy.contains('button', 'Seasons').should('not.be.disabled');
		cy.contains('button', 'Regenerate').should('not.be.disabled');

		// Preview renders
		cy.get('.cal-preview').should('be.visible');
		cy.get('.cal-preview .preview-side .times .time').should('exist');

		// Navigate to Overrides view
		cy.contains('button', 'Overrides').click();
		cy.url().should('include', '/settings/tee-sheets/sheet-1/v2/overrides');

		// Navigate back and to Seasons
		cy.visit('/settings/tee-sheet');
		cy.get('.calendar .cal-grid .day').contains('10').click({ force: true });
		cy.contains('button', 'Seasons').click();
		cy.url().should('include', '/settings/tee-sheets/sheet-1/v2/seasons');
	});
});

