<#
.SYNOPSIS
    Automated build script for ServiceNexus application

.DESCRIPTION
    This PowerShell script automates the complete build process for the ServiceNexus 
    AI-powered mobile forms and field service management platform. It handles 
    prerequisite checks, dependency installation, environment setup, and building 
    the project to a usable state.

.PARAMETER SkipPrereqCheck
    Skip the prerequisite checks for Node.js and npm

.PARAMETER SkipInstall
    Skip the dependency installation step

.PARAMETER SkipBuild
    Skip the production build step

.PARAMETER StartDev
    Start the development servers after building

.PARAMETER Production
    Build for production deployment

.EXAMPLE
    .\build.ps1
    Runs the complete build process with all steps

.EXAMPLE
    .\build.ps1 -StartDev
    Builds the project and starts development servers

.EXAMPLE
    .\build.ps1 -Production
    Builds the project for production deployment

.EXAMPLE
    .\build.ps1 -SkipInstall -StartDev
    Skips dependency installation and starts development servers
#>

[CmdletBinding()]
param(
    [switch]$SkipPrereqCheck,
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$StartDev,
    [switch]$Production
)

# Color output functions
function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n===================================================" -ForegroundColor Yellow
    Write-Host "  $Message" -ForegroundColor Yellow
    Write-Host "===================================================" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

# Start script
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                    ║" -ForegroundColor Magenta
Write-Host "║           ServiceNexus Build Automation              ║" -ForegroundColor Magenta
Write-Host "║     AI-Powered Forms & Field Service Platform      ║" -ForegroundColor Magenta
Write-Host "║                                                    ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Step 1: Check Prerequisites
if (-not $SkipPrereqCheck) {
    Write-Step "Step 1: Checking Prerequisites"
    
    # Check Node.js
    Write-Info "Checking for Node.js..."
    try {
        $nodeVersion = node --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Node.js installed: $nodeVersion"
            
            # Check version meets minimum requirement (14.x)
            $versionNumber = $nodeVersion -replace 'v', ''
            $majorVersion = [int]($versionNumber.Split('.')[0])
            
            if ($majorVersion -lt 14) {
                Write-Warning-Custom "Node.js version $nodeVersion is below recommended version 14.x"
                Write-Info "Please upgrade Node.js from https://nodejs.org/"
            }
        }
    }
    catch {
        Write-Error-Custom "Node.js is not installed or not in PATH"
        Write-Info "Please install Node.js from https://nodejs.org/"
        Write-Info "Recommended: Node.js 18.x LTS"
        exit 1
    }
    
    # Check npm
    Write-Info "Checking for npm..."
    try {
        $npmVersion = npm --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "npm installed: v$npmVersion"
        }
    }
    catch {
        Write-Error-Custom "npm is not installed or not in PATH"
        Write-Info "npm should come with Node.js installation"
        exit 1
    }
    
    Write-Success "All prerequisites satisfied!"
}
else {
    Write-Info "Skipping prerequisite checks (as requested)"
}

# Step 2: Install Dependencies
if (-not $SkipInstall) {
    Write-Step "Step 2: Installing Dependencies"
    
    # Install backend dependencies
    Write-Info "Installing backend dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Failed to install backend dependencies"
        exit 1
    }
    Write-Success "Backend dependencies installed"
    
    # Install frontend dependencies
    Write-Info "Installing frontend dependencies..."
    Set-Location "client"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Failed to install frontend dependencies"
        Set-Location ".."
        exit 1
    }
    Write-Success "Frontend dependencies installed"
    Set-Location ".."
}
else {
    Write-Info "Skipping dependency installation (as requested)"
}

# Step 3: Environment Configuration
Write-Step "Step 3: Configuring Environment"

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Info "Creating .env file from template..."
        Copy-Item ".env.example" ".env"
        Write-Success ".env file created"
        
        if ($Production) {
            Write-Warning-Custom "Production mode detected!"
            Write-Info "Please update the following in .env file:"
            Write-Info "  - Set NODE_ENV=production"
            Write-Info "  - Change JWT_SECRET to a secure random string"
            Write-Info "  - Configure production PORT if needed"
            Write-Host ""
            Read-Host "Press Enter when ready to continue"
        }
        else {
            Write-Info "Using default development configuration"
            Write-Info "Default values work for local development"
        }
    }
    else {
        Write-Warning-Custom ".env.example file not found"
        Write-Info "Creating basic .env file..."
        
        $envContent = @"
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
"@
        Set-Content -Path ".env" -Value $envContent
        Write-Success "Basic .env file created"
    }
}
else {
    Write-Success ".env file already exists"
}

# Step 4: Build Project
if (-not $SkipBuild) {
    Write-Step "Step 4: Building Project"
    
    if ($Production) {
        Write-Info "Building for PRODUCTION..."
        
        # Build frontend
        Write-Info "Building optimized React frontend..."
        Set-Location "client"
        $env:CI = "false"
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Frontend build failed"
            Set-Location ".."
            exit 1
        }
        Write-Success "Frontend built successfully"
        Set-Location ".."
        
        # Verify backend
        Write-Info "Verifying backend configuration..."
        if (Test-Path "server/index.js") {
            Write-Success "Backend verified and ready"
        }
        else {
            Write-Error-Custom "Backend entry point not found"
            exit 1
        }
        
        Write-Success "Production build complete!"
        Write-Host ""
        Write-Info "To start the production server:"
        Write-Info "  `$env:NODE_ENV='production'; npm start"
    }
    else {
        Write-Info "Building for DEVELOPMENT..."
        
        # Build frontend
        Write-Info "Building React frontend..."
        Set-Location "client"
        $env:CI = "false"
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Frontend build failed"
            Set-Location ".."
            exit 1
        }
        Write-Success "Frontend built successfully"
        Set-Location ".."
        
        Write-Success "Development build complete!"
    }
}
else {
    Write-Info "Skipping build step (as requested)"
}

# Step 5: Display Success and Next Steps
Write-Step "Build Process Complete!"

Write-Host ""
Write-Success "ServiceNexus is now built and ready to use!"
Write-Host ""

Write-Info "Application URLs:"
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:   http://localhost:3001" -ForegroundColor White
Write-Host ""

Write-Info "Next Steps:"
Write-Host ""

if ($StartDev) {
    Write-Info "Starting development servers..."
    Write-Host ""
    Write-Warning-Custom "This will start both frontend and backend servers"
    Write-Warning-Custom "Press Ctrl+C to stop the servers"
    Write-Host ""
    Start-Sleep -Seconds 2
    
    npm run dev
}
else {
    Write-Host "  1. To start DEVELOPMENT servers:" -ForegroundColor Cyan
    Write-Host "     npm run dev" -ForegroundColor White
    Write-Host "     (or run 'npm run server' and 'npm run client' in separate terminals)" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "  2. To start PRODUCTION server:" -ForegroundColor Cyan
    Write-Host "     `$env:NODE_ENV='production'; npm start" -ForegroundColor White
    Write-Host ""
    
    Write-Host "  3. To run tests:" -ForegroundColor Cyan
    Write-Host "     npm run test:all" -ForegroundColor White
    Write-Host ""
    
    Write-Host "  4. First time user?" -ForegroundColor Cyan
    Write-Host "     - Open http://localhost:3000" -ForegroundColor White
    Write-Host "     - Click 'Register' to create an account" -ForegroundColor White
    Write-Host "     - Start creating AI-powered forms!" -ForegroundColor White
    Write-Host ""
}

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              Build Successful! 🚀                  ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Exit successfully
exit 0
