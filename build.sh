#!/usr/bin/env bash
#
# Automated build script for ServiceNexus application
#
# This script automates the complete build process for the ServiceNexus
# AI-powered mobile forms and field service management platform. It handles
# prerequisite checks, dependency installation, environment setup, and building
# the project to a usable state.
#
# Usage:
#   ./build.sh [options]
#
# Options:
#   --skip-prereq-check   Skip prerequisite checks for Node.js and npm
#   --skip-install        Skip dependency installation step
#   --skip-build          Skip the production build step
#   --start-dev           Start the development servers after building
#   --production          Build for production deployment
#   --help                Show this help message

set -euo pipefail

# ── Color helpers ────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

success()  { echo -e "${GREEN}✓ $1${NC}"; }
info()     { echo -e "${CYAN}ℹ $1${NC}"; }
step()     {
  echo ""
  echo -e "${YELLOW}===================================================${NC}"
  echo -e "${YELLOW}  $1${NC}"
  echo -e "${YELLOW}===================================================${NC}"
}
error_msg(){ echo -e "${RED}✗ $1${NC}"; }
warn()     { echo -e "${YELLOW}⚠ $1${NC}"; }

# ── Defaults ─────────────────────────────────────────────────────────
SKIP_PREREQ=false
SKIP_INSTALL=false
SKIP_BUILD=false
START_DEV=false
PRODUCTION=false

# ── Parse arguments ──────────────────────────────────────────────────
usage() {
  head -25 "$0" | tail -17
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-prereq-check) SKIP_PREREQ=true; shift ;;
    --skip-install)      SKIP_INSTALL=true; shift ;;
    --skip-build)        SKIP_BUILD=true; shift ;;
    --start-dev)         START_DEV=true; shift ;;
    --production)        PRODUCTION=true; shift ;;
    --help|-h)           usage ;;
    *) error_msg "Unknown option: $1"; usage ;;
  esac
done

# ── Banner ───────────────────────────────────────────────────────────
echo ""
echo -e "${MAGENTA}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║                                                    ║${NC}"
echo -e "${MAGENTA}║           ServiceNexus Build Automation            ║${NC}"
echo -e "${MAGENTA}║     AI-Powered Forms & Field Service Platform      ║${NC}"
echo -e "${MAGENTA}║                                                    ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Move to the project root (same directory as this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Step 1: Prerequisites ───────────────────────────────────────────
if [ "$SKIP_PREREQ" = false ]; then
  step "Step 1: Checking Prerequisites"

  info "Checking for Node.js..."
  if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version)
    success "Node.js installed: $NODE_VERSION"

    MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [ "$MAJOR" -lt 14 ]; then
      warn "Node.js version $NODE_VERSION is below recommended version 14.x"
      info "Please upgrade Node.js from https://nodejs.org/"
    fi
  else
    error_msg "Node.js is not installed or not in PATH"
    info "Please install Node.js from https://nodejs.org/"
    info "Recommended: Node.js 18.x LTS"
    exit 1
  fi

  info "Checking for npm..."
  if command -v npm &>/dev/null; then
    NPM_VERSION=$(npm --version)
    success "npm installed: v$NPM_VERSION"
  else
    error_msg "npm is not installed or not in PATH"
    info "npm should come with Node.js installation"
    exit 1
  fi

  success "All prerequisites satisfied!"
else
  info "Skipping prerequisite checks (as requested)"
fi

# ── Step 2: Install Dependencies ────────────────────────────────────
if [ "$SKIP_INSTALL" = false ]; then
  step "Step 2: Installing Dependencies"

  info "Installing backend dependencies..."
  npm install
  success "Backend dependencies installed"

  info "Installing frontend dependencies..."
  (cd client && npm install)
  success "Frontend dependencies installed"
else
  info "Skipping dependency installation (as requested)"
fi

# ── Step 3: Environment Configuration ───────────────────────────────
step "Step 3: Configuring Environment"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    info "Creating .env file from template..."
    cp .env.example .env
    success ".env file created"

    if [ "$PRODUCTION" = true ]; then
      warn "Production mode detected!"
      info "Please update the following in .env file:"
      info "  - Set NODE_ENV=production"
      info "  - Change JWT_SECRET to a secure random string"
      info "  - Configure production PORT if needed"
      echo ""
      read -rp "Press Enter when ready to continue..."
    else
      info "Using default development configuration"
      info "Default values work for local development"
    fi
  else
    warn ".env.example file not found"
    info "Creating basic .env file..."
    cat > .env <<'EOF'
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
EOF
    success "Basic .env file created"
  fi
else
  success ".env file already exists"
fi

# ── Step 4: Build Project ───────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  step "Step 4: Building Project"

  if [ "$PRODUCTION" = true ]; then
    info "Building for PRODUCTION..."
  else
    info "Building for DEVELOPMENT..."
  fi

  info "Building React frontend..."
  (cd client && CI=false npm run build)
  success "Frontend built successfully"

  if [ "$PRODUCTION" = true ]; then
    info "Verifying backend configuration..."
    if [ -f server/index.js ]; then
      success "Backend verified and ready"
    else
      error_msg "Backend entry point not found"
      exit 1
    fi
    success "Production build complete!"
  else
    success "Development build complete!"
  fi
else
  info "Skipping build step (as requested)"
fi

# ── Step 5: Done ────────────────────────────────────────────────────
step "Build Process Complete!"

echo ""
success "ServiceNexus is now built and ready to use!"
echo ""

info "Application URLs:"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo ""

if [ "$START_DEV" = true ]; then
  info "Starting development servers..."
  echo ""
  warn "This will start both frontend and backend servers"
  warn "Press Ctrl+C to stop the servers"
  echo ""
  sleep 2
  npm run dev
else
  info "Next Steps:"
  echo ""
  echo "  1. To start DEVELOPMENT servers:"
  echo "     npm run dev"
  echo "     (or run 'npm run server' and 'npm run client' in separate terminals)"
  echo ""
  echo "  2. To start PRODUCTION server:"
  echo "     NODE_ENV=production npm start"
  echo ""
  echo "  3. To run tests:"
  echo "     npm run test:all"
  echo ""
  echo "  4. First time user?"
  echo "     - Open http://localhost:3000"
  echo "     - Click 'Register' to create an account"
  echo "     - Start creating AI-powered forms!"
  echo ""
fi

echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Build Successful! 🚀                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

exit 0
