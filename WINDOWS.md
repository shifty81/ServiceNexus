# ServiceNexus - Windows Quick Start Guide

This guide is specifically for Windows users who want to quickly build and run ServiceNexus using the automated PowerShell build script.

## 🚀 Super Quick Start (One Command)

Open PowerShell in the ServiceNexus directory and run:

```powershell
.\build.ps1
```

That's it! This single command will:
- ✓ Check your system has Node.js and npm
- ✓ Install all dependencies (backend + frontend)
- ✓ Set up your environment variables
- ✓ Build the entire project
- ✓ Show you how to start the servers

## 📋 Prerequisites

Before running the build script, you need:

1. **Node.js 14+ and npm**
   - Download from: https://nodejs.org/
   - LTS version recommended (18.x or 20.x)
   - npm comes included with Node.js

2. **Git** (for cloning the repository)
   - Download from: https://git-scm.com/

## 🎯 Common Scenarios

### First Time Setup

```powershell
# Clone the repository
git clone https://github.com/shifty81/ServiceNexus.git
cd ServiceNexus

# Run the automated build script
.\build.ps1

# Start the development servers
npm run dev
```

### Build and Start Immediately

```powershell
# Build and automatically start dev servers
.\build.ps1 -StartDev
```

### Production Build

```powershell
# Build for production deployment
.\build.ps1 -Production

# Then start the production server
$env:NODE_ENV='production'; npm start
```

### Rebuild After Pulling Changes

```powershell
# Pull latest changes
git pull

# Rebuild (dependencies already installed)
.\build.ps1 -SkipInstall
```

### Fresh Install

```powershell
# Remove old dependencies and rebuild everything
Remove-Item -Recurse -Force node_modules, client/node_modules -ErrorAction SilentlyContinue
.\build.ps1
```

## 🛠️ Build Script Options

| Option | Description |
|--------|-------------|
| `-StartDev` | Build and immediately start development servers |
| `-Production` | Build for production deployment |
| `-SkipPrereqCheck` | Skip Node.js and npm version checks |
| `-SkipInstall` | Skip dependency installation (faster if already installed) |
| `-SkipBuild` | Skip the build step (only install dependencies) |

### Combining Options

You can combine multiple options:

```powershell
# Skip install and start dev servers
.\build.ps1 -SkipInstall -StartDev

# Production build without prereq check
.\build.ps1 -Production -SkipPrereqCheck
```

## ⚡ Quick Commands Reference

After building, use these commands:

```powershell
# Start development (both servers)
npm run dev

# Start backend only
npm run server

# Start frontend only (in separate terminal)
cd client
npm start

# Run tests
npm run test:all

# Production server
$env:NODE_ENV='production'; npm start
```

## 🐛 Troubleshooting

### "Execution Policy" Error

If you see an error about execution policies:

```powershell
# Run PowerShell as Administrator and execute:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then try the build script again
.\build.ps1
```

### "Node is not recognized" Error

1. Install Node.js from https://nodejs.org/
2. **Restart PowerShell** after installation
3. Verify installation: `node --version`

### Build Fails

```powershell
# Clean install
Remove-Item -Recurse -Force node_modules, client/node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force client/build -ErrorAction SilentlyContinue
.\build.ps1
```

### Port Already in Use

If port 3001 or 3000 is in use:

```powershell
# Find process using port
netstat -ano | findstr :3001

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in .env file
notepad .env
# Change PORT=3001 to another port
```

### Script Won't Run

Make sure you're in the correct directory:

```powershell
# Check current directory
Get-Location

# Navigate to ServiceNexus directory
cd path\to\ServiceNexus

# Verify script exists
Test-Path .\build.ps1
```

## 📱 Accessing the Application

After the build completes and servers start:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### First Login

1. Open http://localhost:3000
2. Click "Register" to create an account
3. Fill in username, email, and password
4. Start using ServiceNexus!

## 🎨 What Can You Do?

Once running, try these features:

### AI Form Creation
1. Navigate to **AI Upload**
2. Upload a PDF, Word doc, or image of a paper form
3. Click **Process with AI**
4. Watch as OCR converts it to a digital form!

### Manual Form Building
1. Go to **Forms** → **Create Form**
2. Drag and drop field types
3. Configure fields and save

### Dispatch Management
1. Visit **Dispatch** page
2. Create work orders with addresses
3. Click 🗺️ to open location in maps

### Inventory Tracking
1. Go to **Inventory**
2. Add items with quantities
3. Use +/- buttons for quick adjustments

## 💡 Tips

- The build script sets `CI=false` to allow builds with minor warnings
- Use `-SkipInstall` flag on subsequent builds to save time
- The `.env` file is created automatically with development defaults
- For production, manually update `JWT_SECRET` in `.env` to a secure value

## 📚 More Information

- **Complete Build Guide**: [BUILD.md](BUILD.md)
- **Setup Instructions**: [SETUP.md](SETUP.md)
- **Main Documentation**: [README.md](README.md)
- **Testing Guide**: [TESTING.md](TESTING.md)

## 🆘 Still Having Issues?

1. Make sure Node.js 14+ is installed: `node --version`
2. Make sure npm is available: `npm --version`
3. Check you're in the ServiceNexus directory: `Get-Location`
4. Try a clean install: remove `node_modules` folders and rebuild
5. Check [BUILD.md](BUILD.md) for detailed troubleshooting
6. Open an issue on GitHub with error details

---

**Happy Building!** 🚀 Windows + PowerShell = Easy Setup
