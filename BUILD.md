# ServiceNexus - Build Guide

Complete guide for building the ServiceNexus application for development and production environments.

## 📋 Table of Contents

- [Automated Build (Windows PowerShell)](#automated-build-windows-powershell)
- [Automated Build (Linux / macOS)](#automated-build-linux--macos)
- [VM Test Environment](#vm-test-environment)
- [Prerequisites](#prerequisites)
- [Development Build](#development-build)
- [Production Build](#production-build)
- [Build Optimization](#build-optimization)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Automated Build (Windows PowerShell)

### 🚀 One-Command Build

For Windows users, we provide an automated PowerShell script that handles the entire build process.

#### Quick Start

```powershell
# Run the automated build script
.\build.ps1
```

This single command will:
1. ✓ Check for Node.js and npm prerequisites
2. ✓ Install all backend dependencies
3. ✓ Install all frontend dependencies
4. ✓ Configure environment variables (.env file)
5. ✓ Build the project to a usable state

#### Build Script Options

```powershell
# Build and start development servers immediately
.\build.ps1 -StartDev

# Build for production deployment
.\build.ps1 -Production

# Skip dependency installation (if already installed)
.\build.ps1 -SkipInstall

# Skip prerequisite checks
.\build.ps1 -SkipPrereqCheck

# Skip the build step (install dependencies only)
.\build.ps1 -SkipBuild

# Combine options
.\build.ps1 -SkipInstall -StartDev
```

#### What the Script Does

**Step 1: Prerequisites Check**
- Verifies Node.js is installed (version 14+)
- Verifies npm is available
- Displays version information

**Step 2: Dependency Installation**
- Installs backend packages (`npm install`)
- Installs frontend packages (`cd client && npm install`)
- Handles errors gracefully

**Step 3: Environment Configuration**
- Creates `.env` file from `.env.example` if needed
- Sets up development defaults automatically
- Prompts for production configuration when using `-Production`

**Step 4: Project Build**
- Builds optimized React frontend bundle
- Verifies backend configuration
- Prepares application for deployment

**Step 5: Completion**
- Displays success message
- Shows application URLs
- Provides next steps and commands

#### Examples

**First-time setup:**
```powershell
# Complete setup and build
.\build.ps1
```

**Quick development:**
```powershell
# Build and start dev servers in one command
.\build.ps1 -StartDev
```

**Production deployment:**
```powershell
# Build for production
.\build.ps1 -Production

# Then start the production server
$env:NODE_ENV='production'; npm start
```

**Rebuild after pulling changes:**
```powershell
# Dependencies already installed, just rebuild
.\build.ps1 -SkipInstall
```

#### Troubleshooting PowerShell Script

**Execution Policy Error:**
```powershell
# If you get "execution policy" error, run as Administrator:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run the script again
.\build.ps1
```

**Path Issues:**
```powershell
# Make sure you're in the project root directory
cd path\to\ServiceNexus
.\build.ps1
```

**Node.js Not Found:**
- Ensure Node.js is installed from https://nodejs.org/
- Restart PowerShell after installation
- Verify with: `node --version`

---

## Automated Build (Linux / macOS)

### 🚀 One-Command Build

For Linux and macOS users, we provide a Bash build script equivalent to the PowerShell script:

```bash
# Make it executable (first time only)
chmod +x build.sh

# Run the automated build script
./build.sh
```

#### Build Script Options

```bash
# Build and start development servers immediately
./build.sh --start-dev

# Build for production deployment
./build.sh --production

# Skip dependency installation (if already installed)
./build.sh --skip-install

# Skip prerequisite checks
./build.sh --skip-prereq-check

# Skip the build step (install dependencies only)
./build.sh --skip-build

# Combine options
./build.sh --skip-install --start-dev
```

---

## VM Test Environment

The VM test environment uses Docker Compose to spin up the ServiceNexus server alongside
multiple simulated device containers (mobile, desktop, tablet). Each device runs a
Node.js simulator that registers a user, authenticates, and exercises platform APIs
according to its role (technician, dispatcher, admin).

### Prerequisites

- **Docker** and **Docker Compose** must be installed.

### Quick Start

```bash
# Run the full multi-device simulation
chmod +x scripts/vm-test-env.sh
./scripts/vm-test-env.sh
```

This will:
1. Build the ServiceNexus Docker image
2. Start the server container with a health check
3. Launch three device simulators (mobile, desktop, tablet)
4. Run API interactions against the platform
5. Report pass/fail results per device
6. Tear down the environment automatically

### Options

```bash
# Build images only (skip running the simulation)
./scripts/vm-test-env.sh --build-only

# Skip image build (use previously built images)
./scripts/vm-test-env.sh --no-build

# Keep containers running after tests finish
./scripts/vm-test-env.sh --keep
```

### Docker Compose Configuration

The test environment is defined in `docker-compose.test.yml`:

| Service              | Role        | Description                                |
|----------------------|-------------|--------------------------------------------|
| servicenexus-server  | Platform    | The ServiceNexus application under test    |
| device-mobile        | Technician  | Simulates a field technician on mobile     |
| device-desktop       | Dispatcher  | Simulates an office dispatcher on desktop  |
| device-tablet        | Admin       | Simulates an admin/supervisor on a tablet  |

### CI Integration

The simulation runs automatically in GitHub Actions via `.github/workflows/vm-test.yml`
on every push and pull request to `main` or `develop`. Logs are uploaded as workflow
artifacts for debugging.

### Adding More Devices

To simulate additional devices, add a new service to `docker-compose.test.yml`:

```yaml
device-extra:
  image: node:18-alpine
  working_dir: /app
  volumes:
    - ./scripts/device-simulator.js:/app/device-simulator.js:ro
  depends_on:
    servicenexus-server:
      condition: service_healthy
  environment:
    - SERVER_URL=http://servicenexus-server:3001
    - DEVICE_ROLE=technician
    - DEVICE_NAME=extra-device-1
    - SIMULATE_COUNT=5
  command: ["node", "/app/device-simulator.js"]
```

---

## Prerequisites

Before building ServiceNexus, ensure you have:

### Required Software

- **Node.js**: Version 14.x, 16.x, or 18.x (LTS recommended)
- **npm**: Version 6.x or higher (comes with Node.js)
- **Git**: For version control

### Check Your Environment

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check Git version
git --version
```

### System Requirements

- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Disk Space**: 500MB for dependencies and build files
- **Operating System**: Windows, macOS, or Linux

---

## Development Build

### Quick Start

For development with hot-reload:

```bash
# Clone the repository
git clone https://github.com/shifty81/ServiceNexus.git
cd ServiceNexus

# Install all dependencies
npm run install-all

# Start development servers
npm run dev
```

This starts both backend and frontend servers:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000

### Step-by-Step Development Setup

#### 1. Install Backend Dependencies

```bash
# From project root
npm install
```

This installs:
- Express.js
- Socket.io
- SQLite3
- Authentication libraries
- Other backend dependencies

#### 2. Install Frontend Dependencies

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Return to root
cd ..
```

This installs:
- React and React Router
- Socket.io client
- Tesseract.js (OCR)
- UI libraries and tools

#### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings (optional for development)
nano .env  # or use your preferred editor
```

Default `.env` values work for local development:
```env
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

#### 4. Start Development Servers

**Option A: Both servers at once (recommended)**

```bash
npm run dev
```

**Option B: Separate terminals**

Terminal 1 - Backend:
```bash
npm run server
```

Terminal 2 - Frontend:
```bash
npm run client
```

### Development Features

- **Hot Reload**: Frontend automatically reloads on changes
- **Nodemon**: Backend restarts on file changes
- **Source Maps**: Easy debugging with original source
- **Console Output**: Detailed logging for development

---

## Production Build

### Full Production Build

```bash
# Build everything
npm run build:all
```

This command:
1. Builds the React frontend
2. Confirms backend is ready

### Step-by-Step Production Build

#### 1. Build Frontend

```bash
# Navigate to client directory
cd client

# Build optimized production bundle
npm run build

# Return to root
cd ..
```

Build output location: `client/build/`

**What the build does:**
- Minifies JavaScript and CSS
- Optimizes images and assets
- Creates production bundle
- Generates source maps
- Tree-shakes unused code

#### 2. Prepare Backend

The Node.js backend doesn't require compilation, but verify:

```bash
# Ensure production dependencies are installed
npm install --production

# Verify server can start
node server/index.js
```

#### 3. Configure Production Environment

Update `.env` for production:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=CHANGE-THIS-TO-A-SECURE-RANDOM-STRING
```

Generate a secure JWT secret:
```bash
# Generate random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 4. Test Production Build

```bash
# Start production server
NODE_ENV=production npm start
```

The server will:
- Serve static React files from `client/build/`
- Run API on http://localhost:3001
- Use production optimizations

---

## Build Optimization

### Frontend Optimization

#### Code Splitting

React automatically splits code. To customize:

```javascript
// Use dynamic imports for large components
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
```

#### Bundle Analysis

Analyze bundle size:

```bash
cd client

# Install analyzer
npm install --save-dev source-map-explorer

# Add to package.json scripts:
# "analyze": "source-map-explorer 'build/static/js/*.js'"

# Build and analyze
npm run build
npm run analyze
```

#### Asset Optimization

Images are automatically optimized during build. For manual optimization:

```bash
# Install image optimizer
npm install --save-dev imagemin imagemin-pngquant imagemin-mozjpeg
```

### Backend Optimization

#### Production Dependencies Only

```bash
# Install without dev dependencies
npm install --production
```

#### Database Optimization

For production, consider upgrading from SQLite:

```bash
# Example: PostgreSQL
npm install pg

# Example: MySQL
npm install mysql2
```

#### Caching

Add caching for API responses:

```bash
npm install node-cache
```

---

## Deployment

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install --production
RUN cd client && npm install --production

# Copy application files
COPY . .

# Build frontend
RUN cd client && npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "start"]
```

Build and run:

```bash
# Build Docker image
docker build -t servicenexus .

# Run container
docker run -p 3001:3001 servicenexus
```

### Platform-Specific Deployment

#### Heroku

```bash
# Install Heroku CLI
heroku login

# Create app
heroku create servicenexus-app

# Deploy
git push heroku main

# Set environment variables
heroku config:set JWT_SECRET=your-secret-key
heroku config:set NODE_ENV=production
```

#### AWS / DigitalOcean / VPS

```bash
# SSH into server
ssh user@your-server-ip

# Clone repository
git clone https://github.com/shifty81/ServiceNexus.git
cd ServiceNexus

# Install dependencies
npm run install-all

# Build
npm run build:all

# Setup PM2 for process management
npm install -g pm2
pm2 start server/index.js --name servicenexus
pm2 startup
pm2 save
```

#### Vercel / Netlify

These platforms can auto-deploy from GitHub:

1. Connect your repository
2. Set build command: `cd client && npm run build`
3. Set output directory: `client/build`
4. Configure environment variables

---

## Build Artifacts

### Frontend Build Output

Location: `client/build/`

```
build/
├── index.html              # Main HTML file
├── static/
│   ├── css/               # Minified CSS files
│   ├── js/                # Minified JavaScript bundles
│   └── media/             # Images and other assets
├── manifest.json          # PWA manifest
└── service-worker.js      # Service worker (if enabled)
```

### File Sizes

Typical build sizes:
- JavaScript: ~200-500KB (gzipped)
- CSS: ~20-50KB (gzipped)
- Assets: Varies by content

---

## Build Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run build` | Build frontend only |
| `npm run build:all` | Build frontend and verify backend |
| `npm run build:server` | Display backend build status |
| `npm run install-all` | Install all dependencies |

---

## Troubleshooting

### Common Build Issues

#### "Out of memory" Error

**Problem**: Build runs out of memory

**Solution**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

#### "Module not found" During Build

**Problem**: Dependencies not installed

**Solution**:
```bash
# Clean install
rm -rf node_modules client/node_modules
rm package-lock.json client/package-lock.json
npm run install-all
```

#### Build Succeeds but Site Doesn't Load

**Problem**: Routing issues in production

**Solution**:
```javascript
// Ensure server.js has catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});
```

#### Static Files Not Loading

**Problem**: Incorrect path configuration

**Solution**:
```javascript
// In server/index.js
app.use(express.static(path.join(__dirname, '../client/build')));
```

### Performance Issues

#### Slow Build Times

Solutions:
- Use faster disk (SSD)
- Disable source maps in production
- Use build caching
- Update Node.js to latest LTS

#### Large Bundle Size

Solutions:
- Enable code splitting
- Remove unused dependencies
- Use dynamic imports
- Optimize images
- Tree-shake libraries

---

## Verification

### Post-Build Checks

1. **Verify Frontend Build**
```bash
ls -lh client/build/
```

2. **Test Production Server**
```bash
NODE_ENV=production npm start
curl http://localhost:3001/health
```

3. **Check Bundle Size**
```bash
du -sh client/build
```

4. **Test All Routes**
- Visit http://localhost:3001
- Test login
- Create a form
- Test dispatch features
- Verify inventory tracking

---

## Environment Variables

### Required for Production

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<secure-random-string>
```

### Optional

```env
# Database (if using external DB)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# File uploads
MAX_FILE_SIZE=10485760  # 10MB

# CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Session
SESSION_SECRET=<another-secure-string>
```

---

## Next Steps

After building:

1. **Test**: Run full test suite (`npm run test:all`)
2. **Security**: Run security audit (`npm audit`)
3. **Performance**: Test with production data
4. **Monitor**: Set up logging and monitoring
5. **Backup**: Configure database backups

---

**Build Complete!** 🎉 Ready for deployment.
