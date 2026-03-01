#!/usr/bin/env node
/**
 * ServiceNexus – Device Simulator
 *
 * Simulates a field-service device (mobile / desktop / tablet) exercising the
 * ServiceNexus platform.  Each invocation:
 *
 *   1. Registers a new user on the platform
 *   2. Authenticates and obtains a JWT token
 *   3. Performs a series of typical API operations (create forms, list forms,
 *      manage customers, etc.) based on the configured DEVICE_ROLE
 *   4. Reports a summary of pass / fail results
 *
 * Environment variables (all optional – sensible defaults are provided):
 *   SERVER_URL      – base URL of the ServiceNexus server  (default: http://localhost:3001)
 *   DEVICE_ROLE     – one of: technician | dispatcher | admin  (default: technician)
 *   DEVICE_NAME     – human-readable name for log output  (default: device-1)
 *   SIMULATE_COUNT  – number of operations per category  (default: 3)
 */

'use strict';

const http = require('http');
const https = require('https');

// ── Configuration ───────────────────────────────────────────────────
const SERVER_URL     = process.env.SERVER_URL     || 'http://localhost:3001';
const DEVICE_ROLE    = process.env.DEVICE_ROLE    || 'technician';
const DEVICE_NAME    = process.env.DEVICE_NAME    || 'device-1';
const SIMULATE_COUNT = parseInt(process.env.SIMULATE_COUNT, 10) || 3;

const results = { passed: 0, failed: 0, errors: [] };

// ── Minimal HTTP helper (no external deps) ──────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const opts = {
      method,
      hostname: url.hostname,
      port:     url.port,
      path:     url.pathname + url.search,
      headers:  { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = transport.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Assertion helper ────────────────────────────────────────────────
function assert(label, condition) {
  if (condition) {
    results.passed++;
    console.log(`  ✓  ${label}`);
  } else {
    results.failed++;
    results.errors.push(label);
    console.error(`  ✗  ${label}`);
  }
}

// ── Wait helper ─────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Simulation routines ─────────────────────────────────────────────
async function waitForServer(retries = 30, interval = 2000) {
  console.log(`[${DEVICE_NAME}] Waiting for server at ${SERVER_URL} ...`);
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request('GET', '/api/forms');
      if (res.status < 500) return;
    } catch { /* server not ready */ }
    await sleep(interval);
  }
  throw new Error(`Server at ${SERVER_URL} did not become ready`);
}

async function registerAndLogin() {
  const suffix = `${DEVICE_NAME}-${Date.now()}`;
  const user = {
    username: `user-${suffix}`,
    email:    `${suffix}@test.local`,
    password: 'Test1234!',
    name:     `Test User (${DEVICE_NAME})`,
    role:     DEVICE_ROLE,
  };

  console.log(`[${DEVICE_NAME}] Registering user ${user.username} ...`);
  const reg = await request('POST', '/api/auth/register', user);
  assert('Register user',  reg.status === 201 || reg.status === 200);

  console.log(`[${DEVICE_NAME}] Logging in ...`);
  const login = await request('POST', '/api/auth/login', {
    email:    user.email,
    password: user.password,
  });
  assert('Login', login.status === 200 && login.body && login.body.token);
  return login.body && login.body.token;
}

async function simulateTechnician(token) {
  console.log(`[${DEVICE_NAME}] Simulating technician workflow ...`);

  for (let i = 0; i < SIMULATE_COUNT; i++) {
    const form = {
      title:       `Field Report #${i + 1}`,
      description: `Auto-generated field report from ${DEVICE_NAME}`,
      fields:      [{ name: 'notes', type: 'text', required: true }],
    };
    const res = await request('POST', '/api/forms', form, token);
    assert(`Create form ${i + 1}`, res.status === 201 || res.status === 200);
  }

  const list = await request('GET', '/api/forms', null, token);
  assert('List forms', list.status === 200);
}

async function simulateDispatcher(token) {
  console.log(`[${DEVICE_NAME}] Simulating dispatcher workflow ...`);

  for (let i = 0; i < SIMULATE_COUNT; i++) {
    const customer = {
      name:    `Customer ${i + 1} (${DEVICE_NAME})`,
      email:   `cust${i + 1}-${Date.now()}@test.local`,
      phone:   `555-000-${String(i).padStart(4, '0')}`,
      address: `${100 + i} Test Street`,
    };
    const res = await request('POST', '/api/customers', customer, token);
    assert(`Create customer ${i + 1}`, res.status === 201 || res.status === 200);
  }

  const list = await request('GET', '/api/customers', null, token);
  assert('List customers', list.status === 200);
}

async function simulateAdmin(token) {
  console.log(`[${DEVICE_NAME}] Simulating admin workflow ...`);

  // Admin combines both workflows
  await simulateTechnician(token);
  await simulateDispatcher(token);

  const forms = await request('GET', '/api/forms', null, token);
  assert('Admin list all forms', forms.status === 200);
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(`╔════════════════════════════════════════════════════╗`);
  console.log(`║  ServiceNexus Device Simulator                    ║`);
  console.log(`║  Device : ${(DEVICE_NAME + ' '.repeat(40)).slice(0, 40)} ║`);
  console.log(`║  Role   : ${(DEVICE_ROLE + ' '.repeat(40)).slice(0, 40)} ║`);
  console.log(`╚════════════════════════════════════════════════════╝`);
  console.log('');

  try {
    await waitForServer();

    const token = await registerAndLogin();

    if (!token) {
      console.error(`[${DEVICE_NAME}] Authentication failed – aborting simulation.`);
      process.exit(1);
    }

    switch (DEVICE_ROLE) {
      case 'dispatcher': await simulateDispatcher(token); break;
      case 'admin':      await simulateAdmin(token);      break;
      default:           await simulateTechnician(token);  break;
    }
  } catch (err) {
    results.failed++;
    results.errors.push(err.message);
    console.error(`[${DEVICE_NAME}] Fatal error: ${err.message}`);
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log('');
  console.log(`── Results for ${DEVICE_NAME} ──`);
  console.log(`   Passed : ${results.passed}`);
  console.log(`   Failed : ${results.failed}`);
  if (results.errors.length) {
    console.log(`   Errors :`);
    results.errors.forEach((e) => console.log(`     - ${e}`));
  }
  console.log('');

  process.exit(results.failed > 0 ? 1 : 0);
}

main();
