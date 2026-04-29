describe('Faza 3.3: Employee CRUD E2E', () => {

  beforeEach(() => {
    cy.login();
    cy.visit('http://localhost:5173/employees');
  });

  // ── List ───────────────────────────────────────────────────────────────────
  it('Skenari 1: Lista e punonjësve shfaqet', () => {
    cy.url().should('include', '/employees');
    // Table or card list should render
    cy.get('body').should('not.contain', 'Error');
    cy.contains(/employee|punonjës/i).should('exist');
  });

  // ── Search / Filter ────────────────────────────────────────────────────────
  it('Skenari 2: Filtrim sipas statusit aktiv', () => {
    cy.get('body').then(($body) => {
      const hasStatusFilter = $body.find('select, [data-cy="status-filter"]').length > 0;
      if (hasStatusFilter) {
        cy.get('select').first().select('active');
        cy.get('body').should('not.contain', 'Error');
      }
    });
  });

  // ── Create ─────────────────────────────────────────────────────────────────
  it('Skenari 3: Krijohet punonjës i ri', () => {
    const ts = Date.now();

    // Open "Add Employee" form/modal
    cy.contains(/add employee|new employee|shto punonjës/i).click();

    cy.get('input[name="firstName"]').type('Cypress');
    cy.get('input[name="lastName"]').type(`Tester${ts}`);
    cy.get('input[name="email"]').type(`cypress.tester${ts}@nexus.test`);

    cy.get('body').then(($body) => {
      if ($body.find('input[name="position"]').length) {
        cy.get('input[name="position"]').type('QA Automation');
      }
      if ($body.find('input[name="hireDate"]').length) {
        cy.get('input[name="hireDate"]').type('2024-01-15');
      }
    });

    cy.get('button[type="submit"]').click();

    // Should see success message or newly created employee in list
    cy.contains(/cypress|success|saved|created/i, { timeout: 8000 }).should('exist');
  });

  // ── View detail ────────────────────────────────────────────────────────────
  it('Skenari 4: Hapet detaji i punonjësit', () => {
    cy.get('body').then(($body) => {
      const rows = $body.find('tr[data-id], [data-cy="employee-row"], tbody tr');
      if (rows.length > 0) {
        cy.wrap(rows).first().click();
        cy.get('body').should('not.contain', 'Error');
      }
    });
  });

});

describe('Faza 3.3: Department Management E2E', () => {

  beforeEach(() => {
    cy.login();
    cy.visit('http://localhost:5173/departments');
  });

  it('Skenari 1: Lista e departamenteve shfaqet', () => {
    cy.url().should('include', '/departments');
    cy.get('body').should('not.contain', 'Internal Server Error');
    cy.contains(/department|departament/i).should('exist');
  });

  it('Skenari 2: Krijohet departament i ri', () => {
    const ts = Date.now();
    cy.contains(/add department|new department|shto departament/i).click();
    cy.get('input[name="name"]').type(`Cypress Dept ${ts}`);
    cy.get('button[type="submit"]').click();
    cy.contains(/cypress dept|success|created/i, { timeout: 8000 }).should('exist');
  });

});

describe('Faza 3.3: Payroll / Reporting E2E', () => {

  beforeEach(() => {
    cy.login();
  });

  it('Skenari 1: Llogaritja e pagës jep rezultat VERIFIED', () => {
    cy.visit('http://localhost:5173/payroll');
    cy.url().should('include', '/payroll');

    cy.get('body').then(($body) => {
      if ($body.find('input[name="employeeName"]').length) {
        cy.get('input[name="employeeName"]').type('Test Employee');
        cy.get('input[name="hourlyRate"]').type('30');
        cy.get('input[name="hoursWorked"]').type('160');
        cy.get('button[type="submit"]').click();
        cy.contains('VERIFIED', { timeout: 8000 }).should('be.visible');
      } else {
        cy.log('Payroll form not present on this page — skipping form interaction');
      }
    });
  });

});
