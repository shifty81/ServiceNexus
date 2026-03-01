# FieldForge - Testing Guide

This document provides comprehensive information about testing the FieldForge application.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Continuous Integration](#continuous-integration)
- [Test Coverage](#test-coverage)
- [Troubleshooting](#troubleshooting)

---

## Overview

FieldForge uses a comprehensive testing strategy with:
- **Backend Tests**: Jest for Node.js/Express API testing
- **Frontend Tests**: React Testing Library with Jest
- **Integration Tests**: Supertest for API endpoint testing
- **Automated CI/CD**: GitHub Actions for continuous testing

---

## Test Infrastructure

### Backend Testing Stack

- **Jest** - JavaScript testing framework
- **Supertest** - HTTP assertion library for API testing
- **Coverage Reports** - Code coverage tracking

### Frontend Testing Stack

- **Jest** - Test runner and assertion library
- **React Testing Library** - React component testing utilities
- **Coverage Reports** - Component and code coverage

---

## Running Tests

### All Tests

Run all tests (backend and frontend):

```bash
npm run test:all
```

### Backend Tests Only

```bash
# Run backend tests (fast, no coverage)
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Frontend Tests Only

```bash
# Run frontend tests
cd client
npm test

# Run with coverage
npm test -- --coverage

# Run without watch mode (CI)
npm test -- --watchAll=false
```

### Specific Test Files

Run a specific test file:

```bash
# Backend
npm test server/database.test.js

# Frontend
cd client
npm test App.test.js
```

---

## Writing Tests

### Backend Test Example

Create test files with `.test.js` extension in the `server/` directory:

```javascript
// server/example.test.js
const request = require('supertest');
const app = require('./app'); // Your Express app

describe('API Endpoint Tests', () => {
  test('GET /api/forms should return 200', async () => {
    const response = await request(app).get('/api/forms');
    expect(response.status).toBe(200);
  });

  test('POST /api/forms should create a new form', async () => {
    const newForm = {
      title: 'Test Form',
      description: 'Test Description',
      fields: []
    };
    
    const response = await request(app)
      .post('/api/forms')
      .send(newForm)
      .set('Authorization', 'Bearer YOUR_TOKEN');
    
    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Test Form');
  });
});
```

### Frontend Test Example

Create test files with `.test.js` extension alongside your components:

```javascript
// client/src/components/MyComponent.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  test('renders component title', () => {
    render(<MyComponent />);
    const titleElement = screen.getByText(/my component/i);
    expect(titleElement).toBeInTheDocument();
  });

  test('handles button click', () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

---

## Continuous Integration

### GitHub Actions Workflow

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The CI pipeline:
1. **Install Dependencies** - Installs both backend and frontend dependencies
2. **Run Linters** - Checks code quality (if configured)
3. **Run Tests** - Executes all test suites
4. **Generate Coverage** - Creates code coverage reports
5. **Build Application** - Builds the production frontend
6. **Security Audit** - Checks for vulnerabilities

### Viewing CI Results

1. Navigate to the **Actions** tab in your GitHub repository
2. Click on the workflow run you want to view
3. Review the job results and logs
4. Download artifacts (build files, coverage reports)

### CI Badge

Add this badge to your README.md:

```markdown
![CI/CD Pipeline](https://github.com/shifty81/FieldForge/workflows/CI%2FCD%20Pipeline/badge.svg)
```

---

## Test Coverage

### Viewing Coverage Reports

After running tests with coverage:

```bash
# Backend coverage
npm test
# View: coverage/lcov-report/index.html

# Frontend coverage
cd client
npm test -- --coverage
# View: coverage/lcov-report/index.html
```

### Coverage Goals

Aim for:
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

### What to Test

**Priority 1 - Critical Paths:**
- Authentication and authorization
- Data validation and sanitization
- API endpoints
- Database operations
- Security features

**Priority 2 - Core Features:**
- Form creation and submission
- Dispatch management
- Inventory operations
- Customer management
- Invoice generation

**Priority 3 - UI Components:**
- User interactions
- Form rendering
- Navigation
- Error handling
- Loading states

---

## Test Commands Reference

### Backend

| Command | Description |
|---------|-------------|
| `npm test` | Run all backend tests (no coverage) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:server` | Run backend tests only |

### Frontend

| Command | Description |
|---------|-------------|
| `npm test` | Run tests in watch mode |
| `npm test -- --coverage` | Run with coverage report |
| `npm test -- --watchAll=false` | Run once (no watch) |
| `npm test -- --verbose` | Run with detailed output |

### Combined

| Command | Description |
|---------|-------------|
| `npm run test:all` | Run all backend and frontend tests |

---

## Troubleshooting

### Common Issues

#### "Cannot find module" errors

**Problem**: Module not found during test execution

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules client/node_modules
npm install
cd client && npm install
```

#### Tests timeout

**Problem**: Tests take too long and timeout

**Solution**:
```javascript
// Increase timeout in your test
test('long running test', async () => {
  // test code
}, 10000); // 10 second timeout
```

#### Database locked errors

**Problem**: SQLite database is locked during tests

**Solution**:
```bash
# Use in-memory database for tests
# or create separate test database
NODE_ENV=test npm test
```

#### Frontend test fails with "socket.io not found"

**Problem**: Socket.io client not mocked

**Solution**:
```javascript
// Add to your test file
jest.mock('socket.io-client', () => {
  return {
    io: jest.fn(() => ({
      on: jest.fn(),
      emit: jest.fn(),
      close: jest.fn(),
    })),
  };
});
```

### Getting Help

If you encounter issues:

1. Check test output for error messages
2. Review test logs in GitHub Actions
3. Verify all dependencies are installed
4. Check that database is properly initialized
5. Look for similar issues in the repository
6. Open a new issue with detailed error information

---

## Best Practices

### Test Organization

- Keep tests close to the code they test
- Use descriptive test names
- Group related tests with `describe` blocks
- One assertion per test when possible

### Test Maintenance

- Update tests when code changes
- Remove obsolete tests
- Keep tests simple and readable
- Mock external dependencies
- Use test fixtures for complex data

### Performance

- Run relevant tests during development
- Use watch mode for active development
- Run full test suite before committing
- Keep tests fast (under 5 seconds each)

---

## Resources

### Documentation

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

### Tutorials

- [Testing Express APIs](https://www.albertgao.xyz/2017/05/24/how-to-test-expressjs-with-jest-and-supertest/)
- [React Component Testing](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Happy Testing!** 🧪 ✅
