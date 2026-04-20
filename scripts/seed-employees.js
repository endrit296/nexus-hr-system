/**
 * Seed script — Employee Service (PostgreSQL)
 * Run inside the employee-service container:
 *   docker cp scripts/seed-employees.js nexus-hr-system-employee-service-1:/app/seed-employees.js
 *   docker exec nexus-hr-system-employee-service-1 node seed-employees.js
 */

const { sequelize, connectDB } = require('./config/database');
const Department = require('./models/Department');
const Employee   = require('./models/Employee');

// Associations required for self-referencing managerId
Department.hasMany(Employee,  { foreignKey: 'departmentId', as: 'employees'    });
Employee.belongsTo(Department,{ foreignKey: 'departmentId', as: 'department'   });
Employee.belongsTo(Employee,  { foreignKey: 'managerId',    as: 'manager'      });
Employee.hasMany(Employee,    { foreignKey: 'managerId',    as: 'subordinates' });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findOrCreateDept(name) {
  const [dept] = await Department.findOrCreate({ where: { name }, defaults: { name } });
  return dept;
}

async function findOrCreateEmp(email, defaults) {
  const [emp, created] = await Employee.findOrCreate({ where: { email }, defaults: { email, ...defaults } });
  console.log(`  ${created ? 'create' : 'skip  '}  ${defaults.position.padEnd(32)} ${email}`);
  return emp;
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  await connectDB();
  await sequelize.sync();
  console.log('Connected to PostgreSQL\n');

  // ── Departments ─────────────────────────────────────────────────────────────
  console.log('Departments:');
  const engineering = await findOrCreateDept('Engineering');
  const marketing   = await findOrCreateDept('Marketing');
  const hr          = await findOrCreateDept('Human Resources');
  const finance     = await findOrCreateDept('Finance');
  const sales       = await findOrCreateDept('Sales');
  console.log(`  Engineering (${engineering.id}), Marketing (${marketing.id}), HR (${hr.id}), Finance (${finance.id}), Sales (${sales.id})\n`);

  // ── Level 0 — CEO (no manager, no department) ───────────────────────────────
  console.log('Employees:');
  const alice = await findOrCreateEmp('alice@nexushr.com', {
    firstName: 'Alice', lastName: 'Johnson',
    position:  'Chief Executive Officer',
    status:    'active',
    hireDate:  '2018-01-15',
    salary:    180000,
    phone:     '+1 (212) 555-0101',
  });

  // ── Level 1 — C-Suite / VPs (report to Alice) ───────────────────────────────
  const bob = await findOrCreateEmp('bob@nexushr.com', {
    firstName:    'Bob',   lastName: 'Smith',
    position:     'Chief Technology Officer',
    status:       'active',
    hireDate:     '2018-03-10',
    salary:       158000,
    phone:        '+1 (212) 555-0102',
    departmentId: engineering.id,
    managerId:    alice.id,
  });

  const frank = await findOrCreateEmp('frank@nexushr.com', {
    firstName:    'Frank', lastName: 'Miller',
    position:     'Chief Marketing Officer',
    status:       'active',
    hireDate:     '2018-06-01',
    salary:       152000,
    phone:        '+1 (212) 555-0103',
    departmentId: marketing.id,
    managerId:    alice.id,
  });

  const karen = await findOrCreateEmp('karen@nexushr.com', {
    firstName:    'Karen', lastName: 'Martinez',
    position:     'HR Director',
    status:       'active',
    hireDate:     '2019-02-20',
    salary:       130000,
    phone:        '+1 (212) 555-0104',
    departmentId: hr.id,
    managerId:    alice.id,
  });

  const ivy = await findOrCreateEmp('ivy@nexushr.com', {
    firstName:    'Ivy',   lastName: 'Chen',
    position:     'Chief Financial Officer',
    status:       'active',
    hireDate:     '2019-04-05',
    salary:       155000,
    phone:        '+1 (212) 555-0105',
    departmentId: finance.id,
    managerId:    alice.id,
  });

  const mike = await findOrCreateEmp('mike@nexushr.com', {
    firstName:    'Mike',  lastName: 'Thompson',
    position:     'VP of Sales',
    status:       'active',
    hireDate:     '2019-07-15',
    salary:       135000,
    phone:        '+1 (212) 555-0106',
    departmentId: sales.id,
    managerId:    alice.id,
  });

  // ── Level 2 — Team members ───────────────────────────────────────────────────

  // Engineering → Bob
  const carol = await findOrCreateEmp('carol@nexushr.com', {
    firstName:    'Carol', lastName: 'White',
    position:     'Senior Software Engineer',
    status:       'active',
    hireDate:     '2020-01-20',
    salary:       118000,
    phone:        '+1 (415) 555-0201',
    departmentId: engineering.id,
    managerId:    bob.id,
  });

  const david = await findOrCreateEmp('david@nexushr.com', {
    firstName:    'David', lastName: 'Lee',
    position:     'Senior Software Engineer',
    status:       'active',
    hireDate:     '2020-03-15',
    salary:       120000,
    phone:        '+1 (415) 555-0202',
    departmentId: engineering.id,
    managerId:    bob.id,
  });

  // Marketing → Frank
  await findOrCreateEmp('grace@nexushr.com', {
    firstName:    'Grace', lastName: 'Wilson',
    position:     'Marketing Specialist',
    status:       'active',
    hireDate:     '2021-02-01',
    salary:       88000,
    phone:        '+1 (310) 555-0203',
    departmentId: marketing.id,
    managerId:    frank.id,
  });

  await findOrCreateEmp('henry@nexushr.com', {
    firstName:    'Henry', lastName: 'Brown',
    position:     'Content Writer',
    status:       'active',
    hireDate:     '2021-05-10',
    salary:       72000,
    phone:        '+1 (310) 555-0204',
    departmentId: marketing.id,
    managerId:    frank.id,
  });

  // HR → Karen
  await findOrCreateEmp('liam@nexushr.com', {
    firstName:    'Liam',  lastName: 'Anderson',
    position:     'HR Specialist',
    status:       'active',
    hireDate:     '2021-08-23',
    salary:       68000,
    phone:        '+1 (646) 555-0205',
    departmentId: hr.id,
    managerId:    karen.id,
  });

  // Finance → Ivy
  await findOrCreateEmp('jack@nexushr.com', {
    firstName:    'Jack',  lastName: 'Taylor',
    position:     'Financial Analyst',
    status:       'active',
    hireDate:     '2020-11-01',
    salary:       95000,
    phone:        '+1 (646) 555-0206',
    departmentId: finance.id,
    managerId:    ivy.id,
  });

  // Sales → Mike
  await findOrCreateEmp('nina@nexushr.com', {
    firstName:    'Nina',  lastName: 'Roberts',
    position:     'Sales Representative',
    status:       'active',
    hireDate:     '2022-01-10',
    salary:       65000,
    phone:        '+1 (312) 555-0207',
    departmentId: sales.id,
    managerId:    mike.id,
  });

  await findOrCreateEmp('oscar@nexushr.com', {
    firstName:    'Oscar', lastName: 'Garcia',
    position:     'Sales Representative',
    status:       'on_leave',
    hireDate:     '2022-03-28',
    salary:       65000,
    phone:        '+1 (312) 555-0208',
    departmentId: sales.id,
    managerId:    mike.id,
  });

  // ── Level 3 — Junior (reports to David) ─────────────────────────────────────
  await findOrCreateEmp('emma@nexushr.com', {
    firstName:    'Emma',  lastName: 'Davis',
    position:     'Junior Software Engineer',
    status:       'active',
    hireDate:     '2023-06-05',
    salary:       68000,
    phone:        '+1 (415) 555-0301',
    departmentId: engineering.id,
    managerId:    david.id,
  });

  console.log('\nDone.');
  await sequelize.close();
}

seed().catch((err) => { console.error(err); process.exit(1); });
