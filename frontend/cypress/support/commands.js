// ── Custom Cypress Commands ────────────────────────────────────────────────────

/**
 * cy.login(email, password)
 * Logs in via the UI and waits for the dashboard to load.
 */
Cypress.Commands.add('login', (email = 'admin@nexus.com', password = 'password123') => {
  cy.visit('http://localhost:5173');
  cy.get('input[name="email"]').clear().type(email);
  cy.get('input[name="password"]').clear().type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/dashboard');
});

/**
 * cy.loginViaApi(email, password)
 * Bypasses the UI and stores tokens in localStorage directly.
 * Use when you need an authenticated state without touching the login page.
 */
Cypress.Commands.add('loginViaApi', (email = 'admin@nexus.com', password = 'password123') => {
  cy.request({
    method:           'POST',
    url:              'http://localhost:8080/api/auth/login',
    body:             { email, password },
    failOnStatusCode: false,
  }).then(({ body }) => {
    if (body.accessToken) {
      window.localStorage.setItem('accessToken',  body.accessToken);
      window.localStorage.setItem('refreshToken', body.refreshToken);
    }
  });
});
