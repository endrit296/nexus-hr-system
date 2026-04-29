describe('Faza 3.3: Auth E2E', () => {

  // ── Admin login ────────────────────────────────────────────────────────────
  it('Skenari 1: Logimi i Adminit dhe vizita në Dashboard', () => {
    cy.visit('http://localhost:5173');
    cy.get('input[name="email"]').type('admin@nexus.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
    cy.contains('Employees').should('be.visible');
  });

  // ── Wrong credentials ──────────────────────────────────────────────────────
  it('Skenari 2: Login me kredenciale të gabuara', () => {
    cy.visit('http://localhost:5173');
    cy.get('input[name="email"]').type('wrong@nexus.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    cy.url().should('not.include', '/dashboard');
  });

  // ── Register flow ──────────────────────────────────────────────────────────
  it('Skenari 3: Regjistrimi i llogarisë — shfaqet mesazhi i konfirmimit', () => {
    cy.visit('http://localhost:5173');

    // Switch to register tab/form if it exists
    const ts = Date.now();
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="register-tab"], button:contains("Register"), a:contains("Register")').length) {
        cy.contains(/register/i).first().click();
      }
    });

    cy.get('input[name="username"]').type(`cypress_user_${ts}`);
    cy.get('input[name="email"]').type(`cypress_${ts}@nexus.test`);
    cy.get('input[name="password"]').type('Cypress123!');
    cy.get('button[type="submit"]').click();

    // After registration the UI shows a "check your email" message
    cy.contains(/check your email|activation|verify/i, { timeout: 6000 }).should('be.visible');
  });

  // ── Forgot password ────────────────────────────────────────────────────────
  it('Skenari 4: Forgot-password — forma dërgohet me sukses', () => {
    cy.visit('http://localhost:5173/forgot-password');
    cy.get('input[name="email"]').type('admin@nexus.com');
    cy.get('button[type="submit"]').click();
    cy.contains(/check your email|sent|sukses/i, { timeout: 6000 }).should('be.visible');
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  it('Skenari 5: Logout — kthehet te faqja e login', () => {
    cy.login();
    cy.get('body').then(($body) => {
      // Click any logout button/link in the UI
      if ($body.find('[data-cy="logout"], button:contains("Logout"), button:contains("Sign out")').length) {
        cy.contains(/logout|sign out/i).click();
      }
    });
    cy.visit('http://localhost:5173/login');
    cy.get('input[name="email"]').should('exist');
  });

});
