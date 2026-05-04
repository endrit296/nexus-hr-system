#!/usr/bin/env node
'use strict';

/**
 * CI seed script — creates a verified admin account used by Newman integration tests.
 * Safe to run repeatedly (upserts on email).
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexus_auth';

async function seed() {
  await mongoose.connect(MONGO_URI);

  const User = mongoose.model('User', new mongoose.Schema({
    username:   String,
    email:      String,
    password:   String,
    role:       String,
    isVerified: Boolean,
  }, { collection: 'users' }));

  const hash = await bcrypt.hash('Admin1234!', 10);

  await User.updateOne(
    { email: 'admin@nexushr.com' },
    {
      $set: {
        username:   'Admin',
        email:      'admin@nexushr.com',
        password:   hash,
        role:       'admin',
        isVerified: true,
      },
    },
    { upsert: true }
  );

  console.log('[seed] admin@nexushr.com ready (Admin1234!)');
  await mongoose.disconnect();
}

seed().catch((err) => { console.error('[seed] Failed:', err.message); process.exit(1); });
