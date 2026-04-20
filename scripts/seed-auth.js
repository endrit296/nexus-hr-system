/**
 * Seed script — Auth Service (MongoDB)
 * Run inside the auth-service container:
 *   docker cp scripts/seed-auth.js nexus-hr-system-auth-service-1:/app/seed-auth.js
 *   docker exec nexus-hr-system-auth-service-1 node seed-auth.js
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/nexus_auth';

const USERS = [
  // ── Admins ────────────────────────────────────────────────────────────────
  { username: 'alice',  email: 'alice@nexushr.com',  role: 'admin'    },
  // ── Managers ──────────────────────────────────────────────────────────────
  { username: 'bob',    email: 'bob@nexushr.com',    role: 'manager'  },
  { username: 'frank',  email: 'frank@nexushr.com',  role: 'manager'  },
  { username: 'karen',  email: 'karen@nexushr.com',  role: 'manager'  },
  { username: 'ivy',    email: 'ivy@nexushr.com',    role: 'manager'  },
  { username: 'mike',   email: 'mike@nexushr.com',   role: 'manager'  },
  // ── Employees ─────────────────────────────────────────────────────────────
  { username: 'carol',  email: 'carol@nexushr.com',  role: 'employee' },
  { username: 'david',  email: 'david@nexushr.com',  role: 'employee' },
  { username: 'emma',   email: 'emma@nexushr.com',   role: 'employee' },
  { username: 'grace',  email: 'grace@nexushr.com',  role: 'employee' },
  { username: 'henry',  email: 'henry@nexushr.com',  role: 'employee' },
  { username: 'jack',   email: 'jack@nexushr.com',   role: 'employee' },
  { username: 'liam',   email: 'liam@nexushr.com',   role: 'employee' },
  { username: 'nina',   email: 'nina@nexushr.com',   role: 'employee' },
  { username: 'oscar',  email: 'oscar@nexushr.com',  role: 'employee' },
];

const PASSWORD = 'Password123';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const hashed = await bcrypt.hash(PASSWORD, 10);
  let created = 0;
  let skipped = 0;

  for (const u of USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`  skip   ${u.role.padEnd(8)}  ${u.email}`);
      skipped++;
      continue;
    }
    await User.create({ ...u, password: hashed });
    console.log(`  create ${u.role.padEnd(8)}  ${u.email}`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
