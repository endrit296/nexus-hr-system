#!/usr/bin/env node
'use strict';

/**
 * Newman integration test runner
 * Usage:  node tests/integration/run-newman.js
 * Prereq: npm install -g newman   (or add as devDependency)
 */

const newman = require('newman');
const path   = require('path');

const COLLECTION = path.join(__dirname, 'nexus-hr.postman_collection.json');
const BASE_URL   = process.env.BASE_URL || 'http://localhost:8080';

newman.run(
  {
    collection:          COLLECTION,
    envVar:              [{ key: 'baseUrl', value: BASE_URL }],
    reporters:           ['cli', 'json'],
    reporter:            { json: { export: path.join(__dirname, 'results.json') } },
    delayRequest:        100,   // ms between requests — avoids rate-limit tripping
    timeoutRequest:      10000, // 10s per request
    bail:                false, // run all tests even if some fail
    insecure:            true,
  },
  (err, summary) => {
    if (err) {
      console.error('Newman run failed:', err.message);
      process.exit(1);
    }

    const stats = summary.run.stats;
    console.log('\n── Newman Summary ────────────────────────────────');
    console.log(`  Requests  : ${stats.requests.total}  (failed: ${stats.requests.failed})`);
    console.log(`  Assertions: ${stats.assertions.total}  (failed: ${stats.assertions.failed})`);
    console.log('──────────────────────────────────────────────────\n');

    if (summary.run.failures.length > 0) {
      console.error(`${summary.run.failures.length} test(s) failed.`);
      process.exit(1);
    }

    console.log('All integration tests passed.');
  }
);
