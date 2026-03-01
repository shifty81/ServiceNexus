/**
 * VM Test Environment – Configuration & Script Integrity Tests
 *
 * Validates that the VM test environment files (docker-compose.test.yml,
 * device-simulator.js, vm-test-env.sh, build.sh) are present and structurally
 * correct, so CI never silently runs against a broken test harness.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

describe('VM Test Environment – File Presence', () => {
  const requiredFiles = [
    'docker-compose.test.yml',
    'build.sh',
    'scripts/vm-test-env.sh',
    'scripts/device-simulator.js',
    '.github/workflows/vm-test.yml',
  ];

  requiredFiles.forEach((file) => {
    test(`${file} exists`, () => {
      const fullPath = path.join(ROOT, file);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });
});

describe('docker-compose.test.yml – Structure', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(path.join(ROOT, 'docker-compose.test.yml'), 'utf8');
  });

  test('defines servicenexus-server service', () => {
    expect(content).toContain('servicenexus-server:');
  });

  test('defines device-mobile service', () => {
    expect(content).toContain('device-mobile:');
  });

  test('defines device-desktop service', () => {
    expect(content).toContain('device-desktop:');
  });

  test('defines device-tablet service', () => {
    expect(content).toContain('device-tablet:');
  });

  test('uses test NODE_ENV', () => {
    expect(content).toContain('NODE_ENV=test');
  });

  test('includes a healthcheck for the server', () => {
    expect(content).toContain('healthcheck:');
  });

  test('mounts device-simulator.js into device containers', () => {
    expect(content).toContain('device-simulator.js');
  });
});

describe('device-simulator.js – Structure', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(path.join(ROOT, 'scripts', 'device-simulator.js'), 'utf8');
  });

  test('reads SERVER_URL from environment', () => {
    expect(content).toContain('SERVER_URL');
  });

  test('reads DEVICE_ROLE from environment', () => {
    expect(content).toContain('DEVICE_ROLE');
  });

  test('reads DEVICE_NAME from environment', () => {
    expect(content).toContain('DEVICE_NAME');
  });

  test('contains registration flow', () => {
    expect(content).toContain('/api/auth/register');
  });

  test('contains login flow', () => {
    expect(content).toContain('/api/auth/login');
  });

  test('simulates technician role', () => {
    expect(content).toContain('simulateTechnician');
  });

  test('simulates dispatcher role', () => {
    expect(content).toContain('simulateDispatcher');
  });

  test('simulates admin role', () => {
    expect(content).toContain('simulateAdmin');
  });

  test('uses only built-in Node.js modules (no external deps)', () => {
    // The simulator should only require http, https, and built-in modules
    // so it can run inside a bare node:18-alpine container
    const requires = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
    const modules = requires.map((r) => r.match(/require\(['"]([^'"]+)['"]\)/)[1]);
    const builtins = ['http', 'https', 'fs', 'path', 'url', 'crypto', 'os', 'util'];
    modules.forEach((mod) => {
      expect(builtins).toContain(mod);
    });
  });
});

describe('build.sh – Structure', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(path.join(ROOT, 'build.sh'), 'utf8');
  });

  test('has a shebang line', () => {
    expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
  });

  test('uses set -euo pipefail for safety', () => {
    expect(content).toContain('set -euo pipefail');
  });

  test('checks for Node.js', () => {
    expect(content).toContain('node');
  });

  test('checks for npm', () => {
    expect(content).toContain('npm');
  });

  test('supports --production flag', () => {
    expect(content).toContain('--production');
  });

  test('supports --start-dev flag', () => {
    expect(content).toContain('--start-dev');
  });

  test('is executable', () => {
    const stat = fs.statSync(path.join(ROOT, 'build.sh'));
    // Owner execute bit (0o100) should be set
    expect(stat.mode & 0o100).toBeTruthy();
  });
});

describe('vm-test-env.sh – Structure', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(path.join(ROOT, 'scripts', 'vm-test-env.sh'), 'utf8');
  });

  test('has a shebang line', () => {
    expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
  });

  test('references docker-compose.test.yml', () => {
    expect(content).toContain('docker-compose.test.yml');
  });

  test('supports --build-only flag', () => {
    expect(content).toContain('--build-only');
  });

  test('supports --keep flag', () => {
    expect(content).toContain('--keep');
  });

  test('tears down environment on exit', () => {
    expect(content).toContain('trap cleanup EXIT');
  });

  test('is executable', () => {
    const stat = fs.statSync(path.join(ROOT, 'scripts', 'vm-test-env.sh'));
    expect(stat.mode & 0o100).toBeTruthy();
  });
});

describe('vm-test.yml – GitHub Actions Workflow', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'vm-test.yml'), 'utf8');
  });

  test('triggers on push and pull_request', () => {
    expect(content).toContain('push:');
    expect(content).toContain('pull_request:');
  });

  test('runs the vm-test-env.sh script', () => {
    expect(content).toContain('vm-test-env.sh');
  });

  test('uploads logs as artifacts', () => {
    expect(content).toContain('upload-artifact');
  });
});
