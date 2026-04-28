describe('Pika 3.3: Testimi E2E - Nexus HR', () => {
  it('Skenari: Logimi i Adminit dhe vizita në Dashboard', () => {
    // 1. Vizito faqen (sigurohu që React-i yt është i ndezur)
    cy.visit('http://localhost:5173'); 

    // 2. Plotëso formën (përshtat selector-ët nëse emrat në React i ke ndryshe)
    cy.get('input[name="email"]').type('admin@nexus.com');
    cy.get('input[name="password"]').type('password123');
    
    // 3. Kliko Login
    cy.get('button[type="submit"]').click();

    // 4. Vërteto që u hap Dashboard-i
    cy.url().should('include', '/dashboard');
    cy.contains('Employees').should('be.visible');
  });
});