# FieldForge - CI/CD Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for FieldForge.

## Overview

FieldForge uses GitHub Actions for automated testing, building, and security audits. The CI/CD pipeline runs automatically on every push and pull request to ensure code quality and catch issues early.

## Workflow Configuration

The CI/CD workflow is defined in `.github/workflows/ci.yml` and includes:

### 1. Build and Test Job

**Runs on**: Ubuntu Latest  
**Node versions tested**: 14.x, 16.x, 18.x (matrix strategy)

**Steps**:
1. **Checkout Code** - Fetches the repository code
2. **Setup Node.js** - Installs the specified Node.js version with npm caching
3. **Install Backend Dependencies** - Runs `npm ci` in root directory
4. **Install Frontend Dependencies** - Runs `npm ci` in client directory
5. **Lint Backend** - Runs backend linting if configured (optional)
6. **Lint Frontend** - Runs frontend linting if configured (optional)
7. **Run Backend Tests** - Executes Jest tests for the server
8. **Run Frontend Tests** - Executes React tests with coverage
9. **Build Frontend** - Creates production build
10. **Upload Build Artifacts** - Saves build files (Node 18.x only)
11. **Upload Test Coverage** - Saves coverage reports (Node 18.x only)

### 2. Security Audit Job

**Runs on**: Ubuntu Latest  
**Node version**: 18.x  
**Depends on**: build-and-test job completion

**Steps**:
1. **Checkout Code** - Fetches the repository code
2. **Setup Node.js** - Installs Node.js 18.x
3. **Install Dependencies** - Runs `npm ci`
4. **Backend Security Audit** - Runs `npm audit` on root dependencies
5. **Frontend Security Audit** - Runs `npm audit` on client dependencies

## Triggering the Workflow

### Automatic Triggers

The workflow runs automatically on:
- Push to `main` branch
- Push to `develop` branch
- Pull requests to `main` branch
- Pull requests to `develop` branch

### Manual Trigger

You can also manually trigger the workflow from GitHub:
1. Go to the **Actions** tab in your repository
2. Select the **CI/CD Pipeline** workflow
3. Click **Run workflow**
4. Choose the branch and click **Run workflow**

## Viewing Results

### GitHub Actions Dashboard

1. Navigate to your repository on GitHub
2. Click the **Actions** tab
3. See all workflow runs with their status
4. Click on a specific run to see detailed logs

### Status Badge

Add the CI/CD status badge to your documentation:

```markdown
![CI/CD Pipeline](https://github.com/shifty81/FieldForge/workflows/CI%2FCD%20Pipeline/badge.svg)
```

This badge shows:
- ✅ Green: All tests passing
- ❌ Red: Tests failing
- 🟡 Yellow: Workflow in progress

## Artifacts

### Build Artifacts

After each successful build on Node 18.x, the following artifacts are available:

**Build Files** (7 days retention):
- Location: `client/build/`
- Contents: Production-ready React application
- Download from: Actions → Workflow Run → Artifacts

**Coverage Reports** (7 days retention):
- Location: `client/coverage/`
- Contents: Test coverage HTML reports
- Download from: Actions → Workflow Run → Artifacts

### Downloading Artifacts

1. Go to the **Actions** tab
2. Click on a completed workflow run
3. Scroll to the **Artifacts** section
4. Click on the artifact name to download

## Test Requirements

### Backend Tests

- **Framework**: Jest
- **Minimum Passing**: All tests must pass
- **Coverage**: Reports generated automatically
- **Environment**: 
  - `NODE_ENV=test`
  - `JWT_SECRET=test-secret-key`

### Frontend Tests

- **Framework**: React Testing Library + Jest
- **Minimum Passing**: All tests must pass
- **Coverage**: Tracked and reported
- **Mode**: Non-interactive (`CI=true`)

## Security Audit

### Audit Levels

- **Moderate**: Alerts on moderate severity and above
- **Continue on Error**: Audits won't fail the build but will report issues

### Fixing Security Issues

When security issues are detected:

1. **Review the audit report** in the workflow logs
2. **Update vulnerable packages**:
   ```bash
   npm audit fix
   ```
3. **For major breaking changes**:
   ```bash
   npm audit fix --force
   ```
4. **Commit and push** the updated package-lock.json

## Configuration

### Environment Variables

Set these in GitHub repository settings (Settings → Secrets → Actions):

| Variable | Description | Required |
|----------|-------------|----------|
| None currently | Future secrets go here | No |

### Workflow Customization

To modify the workflow:

1. Edit `.github/workflows/ci.yml`
2. Common modifications:
   - Add/remove Node.js versions from matrix
   - Adjust audit levels
   - Add deployment steps
   - Configure notifications

Example - Add Node 20:
```yaml
strategy:
  matrix:
    node-version: [14.x, 16.x, 18.x, 20.x]
```

## Best Practices

### Before Pushing Code

1. **Run tests locally**:
   ```bash
   npm run test:all
   ```

2. **Build locally**:
   ```bash
   npm run build:all
   ```

3. **Check for security issues**:
   ```bash
   npm audit
   cd client && npm audit
   ```

### Writing Tests

- Write tests for new features
- Ensure tests pass locally before pushing
- Aim for >80% code coverage
- Mock external dependencies

### Pull Requests

- Ensure CI passes before requesting review
- Address any security audit warnings
- Check build artifacts are generated correctly
- Review coverage reports for new code

## Troubleshooting

### Common Issues

#### Tests Fail in CI but Pass Locally

**Possible causes**:
- Different Node.js versions
- Missing environment variables
- Race conditions in tests

**Solutions**:
- Test locally with same Node version
- Add required env vars to workflow
- Use proper async/await in tests

#### Build Fails Due to Memory

**Error**: JavaScript heap out of memory

**Solution**:
```yaml
# Add to workflow step
env:
  NODE_OPTIONS: --max_old_space_size=4096
```

#### Slow CI Runs

**Causes**:
- No dependency caching
- Running tests in series

**Solutions**:
- Ensure npm caching is enabled (already configured)
- Run independent tests in parallel
- Reduce test timeout values

### Getting Help

If you encounter CI/CD issues:

1. Check workflow logs in Actions tab
2. Look for error messages in failed steps
3. Compare with successful runs
4. Review this documentation
5. Open an issue with workflow run link

## Monitoring

### What to Watch

- **Test Pass Rate**: Should be 100%
- **Build Time**: Monitor for increases
- **Security Alerts**: Address promptly
- **Artifact Size**: Watch for bloat

### Notifications

Configure GitHub notifications:
1. Go to repository Settings
2. Navigate to Notifications
3. Enable alerts for:
   - Failed workflows
   - Security advisories
   - Pull request checks

## Future Enhancements

Planned CI/CD improvements:

- [ ] Add deployment step for staging
- [ ] Integrate with deployment platforms
- [ ] Add performance testing
- [ ] Set up code quality checks (SonarQube/CodeClimate)
- [ ] Add E2E tests with Playwright/Cypress
- [ ] Implement automatic dependency updates (Dependabot)
- [ ] Add Docker image building and pushing
- [ ] Set up preview deployments for PRs

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)

---

**Last Updated**: 2026-01-16  
**Maintained by**: FieldForge Development Team
