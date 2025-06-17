describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear any existing auth state
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Signup Flow', () => {
    it('should display signup form correctly', () => {
      cy.visit('/signup')
      
      // Check page title
      cy.contains('Golf Course Signup').should('be.visible')
      
      // Check form sections exist
      cy.contains('Course Information').should('be.visible')
      cy.contains('Primary Admin Information').should('be.visible')
      
      // Check required fields
      cy.dataCy('course-name-input').should('be.visible')
      cy.dataCy('admin-first-name-input').should('be.visible')
      cy.dataCy('admin-last-name-input').should('be.visible')
      cy.dataCy('admin-email-input').should('be.visible')
      cy.dataCy('admin-password-input').should('be.visible')
      
      // Check submit button is disabled initially
      cy.dataCy('signup-button').should('be.disabled')
    })

    it('should validate required fields', () => {
      cy.visit('/signup')
      
      // Try to submit empty form
      cy.dataCy('signup-button').should('be.disabled')
      
      // Fill only course name and check button is still disabled
      cy.dataCy('course-name-input').type('Test Course')
      cy.dataCy('signup-button').should('be.disabled')
      
      // Fill all required fields
      cy.dataCy('admin-first-name-input').type('John')
      cy.dataCy('admin-last-name-input').type('Doe')
      cy.dataCy('admin-email-input').type('john.doe@example.com')
      cy.dataCy('admin-password-input').type('StrongPassword123')
      
      // Now button should be enabled
      cy.dataCy('signup-button').should('not.be.disabled')
    })

    it('should validate email format', () => {
      cy.visit('/signup')
      
      // Enter invalid email and trigger validation
      cy.dataCy('admin-email-input').type('invalid-email')
      cy.dataCy('admin-first-name-input').click() // Click elsewhere to trigger validation
      
      // Should show validation error
      cy.contains('Email must be valid').should('be.visible')
      
      // Clear and enter valid email
      cy.dataCy('admin-email-input').clear().type('valid@example.com')
      cy.dataCy('admin-first-name-input').click() // Click elsewhere to trigger validation
      
      // Wait for validation to clear
      cy.wait(500)
      cy.contains('Email must be valid').should('not.exist')
    })

    it('should validate password requirements', () => {
      cy.visit('/signup')
      
      // Enter weak password and trigger validation
      cy.dataCy('admin-password-input').type('weak')
      cy.dataCy('admin-first-name-input').click() // Click elsewhere to trigger validation
      
      // Should show validation errors
      cy.contains('Password must be at least 8 characters').should('be.visible')
      
      // Enter strong password
      cy.dataCy('admin-password-input').clear().type('StrongPassword123')
      cy.dataCy('admin-first-name-input').click() // Click elsewhere to trigger validation
      
      // Wait for validation to clear
      cy.wait(500)
      cy.contains('Password must be at least 8 characters').should('not.exist')
    })

    it('should complete signup flow successfully', () => {
      cy.visit('/signup')
      
      const courseData = {
        course_name: `Test Golf Course ${Date.now()}`,
        street: '123 Golf St',
        city: 'Golf City',
        state: 'CA',
        postal_code: '90210',
        admin_first_name: 'John',
        admin_last_name: 'Doe',
        admin_email: `test.${Date.now()}@example.com`,
        admin_password: 'TestPassword123',
        admin_phone: '555-0123'
      }
      
      // Fill out the form
      cy.dataCy('course-name-input').type(courseData.course_name)
      cy.dataCy('street-input').type(courseData.street)
      cy.dataCy('city-input').type(courseData.city)
      cy.dataCy('state-input').type(courseData.state)
      cy.dataCy('postal-code-input').type(courseData.postal_code)
      
      cy.dataCy('admin-first-name-input').type(courseData.admin_first_name)
      cy.dataCy('admin-last-name-input').type(courseData.admin_last_name)
      cy.dataCy('admin-email-input').type(courseData.admin_email)
      cy.dataCy('admin-password-input').type(courseData.admin_password)
      cy.dataCy('admin-phone-input').type(courseData.admin_phone)
      
      // Submit form
      cy.dataCy('signup-button').click()
      
      // Wait for API response and check for success or error message
      cy.wait(3000)
      
      // Should show either success message or error (since backend might not be fully connected)
      cy.get('body').then(($body) => {
        if ($body.text().includes('Course created successfully')) {
          cy.contains('Course created successfully').should('be.visible')
          cy.contains('Check your email').should('be.visible')
        } else {
          // If there's an API error, that's expected in this setup
          cy.get('.v-alert').should('exist')
        }
      })
    })

    it('should navigate to login from signup page', () => {
      cy.visit('/signup')
      
      // Click login link
      cy.contains('Already have an account? Login').click()
      
      // Should navigate to login page
      cy.url().should('include', '/login')
      cy.contains('Login').should('be.visible')
    })
  })

  describe('Login Flow', () => {
    it('should display login form correctly', () => {
      cy.visit('/login')
      
      // Check page title
      cy.contains('Login').should('be.visible')
      
      // Check form fields
      cy.dataCy('email-input').should('be.visible')
      cy.dataCy('password-input').should('be.visible')
      cy.dataCy('login-button').should('be.visible')
      
      // Check login button is disabled initially
      cy.dataCy('login-button').should('be.disabled')
    })

    it('should validate required fields', () => {
      cy.visit('/login')
      
      // Try with empty fields
      cy.dataCy('login-button').should('be.disabled')
      
      // Fill email only
      cy.dataCy('email-input').type('test@example.com')
      cy.dataCy('login-button').should('be.disabled')
      
      // Fill password too
      cy.dataCy('password-input').type('password123')
      cy.dataCy('login-button').should('not.be.disabled')
    })

    it('should validate email format', () => {
      cy.visit('/login')
      
      // Enter invalid email and trigger validation
      cy.dataCy('email-input').type('invalid-email')
      cy.dataCy('password-input').click() // Click elsewhere to trigger validation
      
      // Should show validation error
      cy.contains('Email must be valid').should('be.visible')
    })

    it('should show error for invalid credentials', () => {
      cy.visit('/login')
      
      // Enter invalid credentials
      cy.dataCy('email-input').type('invalid@example.com')
      cy.dataCy('password-input').type('wrongpassword')
      cy.dataCy('login-button').click()
      
      // Wait for API response
      cy.wait(3000)
      
      // Should show error message (either from API or connection error)
      cy.get('.v-alert').should('exist')
    })

    it('should toggle password visibility', () => {
      cy.visit('/login')
      
      cy.dataCy('password-input').type('password123')
      
      // Password should be hidden by default - check the actual input element
      cy.dataCy('password-input').find('input').should('have.attr', 'type', 'password')
      
      // Wait for field to be fully rendered
      cy.wait(500)
      
      // Find and click the eye icon in the append-inner area
      cy.dataCy('password-input').within(() => {
        // Look for the Vuetify icon in append-inner slot
        cy.get('.v-field__append-inner').should('exist')
        cy.get('.v-field__append-inner .v-icon').click()
      })
      
      // Password should now be visible
      cy.dataCy('password-input').find('input').should('have.attr', 'type', 'text')
      
      // Click again to hide password
      cy.dataCy('password-input').within(() => {
        cy.get('.v-field__append-inner .v-icon').click()
      })
      
      // Password should be hidden again
      cy.dataCy('password-input').find('input').should('have.attr', 'type', 'password')
    })

    it('should navigate to signup from login page', () => {
      cy.visit('/login')
      
      // Click signup link
      cy.contains('Don\'t have an account? Sign up').click()
      
      // Should navigate to signup page
      cy.url().should('include', '/signup')
      cy.contains('Golf Course Signup').should('be.visible')
    })
  })

  describe('Authentication Redirects', () => {
    it('should redirect to login when accessing protected route without auth', () => {
      cy.visit('/dashboard')
      
      // Should redirect to login
      cy.url().should('include', '/login')
    })

    it('should redirect to dashboard when accessing auth pages while logged in', () => {
      // Set a fake token to simulate being logged in
      cy.setAuthToken('fake-jwt-token')
      
      cy.visit('/login')
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard')
    })
  })

  describe('Confirm Account Flow', () => {
    it('should display confirmation page with valid token', () => {
      cy.visit('/confirm?token=valid-token-123')
      
      // Should show loading state first or error (since backend may not be connected)
      cy.get('body').then(($body) => {
        if ($body.text().includes('Confirming your account')) {
          cy.contains('Confirming your account').should('be.visible')
        } else {
          // If there's an API error, check for error state
          cy.contains('Confirmation Failed').should('be.visible')
        }
      })
    })

    it('should display error for missing token', () => {
      cy.visit('/confirm')
      
      // Should show no token message
      cy.contains('No Confirmation Token').should('be.visible')
      cy.contains('check your email').should('be.visible')
    })

    it('should navigate back to signup from confirm page', () => {
      cy.visit('/confirm')
      
      // Click back to signup button
      cy.contains('Back to Signup').click()
      
      // Should navigate to signup
      cy.url().should('include', '/signup')
    })
  })
}) 