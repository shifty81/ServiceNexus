#!/usr/bin/env bash
###############################################################################
# ServiceNexus – VM Test Environment Orchestrator
#
# Builds, starts, and tears down a multi-container Docker environment that
# simulates several devices (mobile, desktop, tablet) interacting with the
# ServiceNexus platform.
#
# Usage:
#   ./scripts/vm-test-env.sh [options]
#
# Options:
#   --build-only    Build images but do not start the environment
#   --no-build      Skip the image build step (use existing images)
#   --keep          Do not tear down the environment after tests finish
#   --help          Show this help message
###############################################################################

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

success()  { echo -e "${GREEN}✓ $1${NC}"; }
info()     { echo -e "${CYAN}ℹ $1${NC}"; }
warn()     { echo -e "${YELLOW}⚠ $1${NC}"; }
error_msg(){ echo -e "${RED}✗ $1${NC}"; }

# ── Defaults ─────────────────────────────────────────────────────────
BUILD_ONLY=false
NO_BUILD=false
KEEP=false
COMPOSE_FILE="docker-compose.test.yml"
PROJECT_NAME="servicenexus-vm-test"

# ── Parse args ───────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-only) BUILD_ONLY=true; shift ;;
    --no-build)   NO_BUILD=true;   shift ;;
    --keep)       KEEP=true;       shift ;;
    --help|-h)
      cat <<'HELP'
Usage: ./scripts/vm-test-env.sh [options]

Options:
  --build-only    Build images but do not start the environment
  --no-build      Skip the image build step (use existing images)
  --keep          Do not tear down the environment after tests finish
  --help          Show this help message
HELP
      exit 0
      ;;
    *) error_msg "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Resolve project root ────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Banner ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   ServiceNexus – VM Test Environment              ║${NC}"
echo -e "${CYAN}║   Multi-device simulation for platform testing    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisite: Docker ─────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  error_msg "Docker is not installed or not in PATH."
  info "Install Docker from https://docs.docker.com/get-docker/"
  exit 1
fi

# Check for docker compose (v2 plugin or standalone)
COMPOSE_CMD=""
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  error_msg "Docker Compose is not installed."
  info "Install Docker Compose from https://docs.docker.com/compose/install/"
  exit 1
fi
success "Docker & Docker Compose detected ($COMPOSE_CMD)"

# ── Build ────────────────────────────────────────────────────────────
if [ "$NO_BUILD" = false ]; then
  info "Building Docker images …"
  $COMPOSE_CMD -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build
  success "Images built"
fi

if [ "$BUILD_ONLY" = true ]; then
  success "Build-only mode – skipping environment start"
  exit 0
fi

# ── Cleanup function ─────────────────────────────────────────────────
cleanup() {
  if [ "$KEEP" = false ]; then
    info "Tearing down VM test environment …"
    $COMPOSE_CMD -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v --remove-orphans 2>/dev/null || true
    success "Environment torn down"
  else
    warn "Containers left running (--keep). Tear down manually with:"
    echo "  $COMPOSE_CMD -f $COMPOSE_FILE -p $PROJECT_NAME down -v"
  fi
}
trap cleanup EXIT

# ── Start the environment ────────────────────────────────────────────
info "Starting VM test environment …"
info "  • servicenexus-server  (the platform)"
info "  • device-mobile        (technician)"
info "  • device-desktop       (dispatcher)"
info "  • device-tablet        (admin)"
echo ""

EXIT_CODE=0
$COMPOSE_CMD -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up \
  --abort-on-container-exit \
  --exit-code-from device-mobile || EXIT_CODE=$?

# ── Summary ──────────────────────────────────────────────────────────
echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   All device simulations passed! 🎉               ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
else
  printf "${RED}╔════════════════════════════════════════════════════╗${NC}\n"
  printf "${RED}║   One or more device simulations failed (exit %-3s) ║${NC}\n" "$EXIT_CODE"
  printf "${RED}╚════════════════════════════════════════════════════╝${NC}\n"
fi
echo ""

exit "$EXIT_CODE"
