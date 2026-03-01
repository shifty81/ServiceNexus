# FieldForge - Quick Setup Guide

## Installation Steps

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env if needed (defaults work for development)
```

### 3. Start the Application

**Option A: Development Mode (Recommended for testing)**

```bash
# Terminal 1: Start backend server
npm run server

# Terminal 2: Start frontend (in a new terminal)
cd client
npm start
```

**Option B: Quick Start (Both servers)**

```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### 4. Create Your First Account

1. Open http://localhost:3000 in your browser
2. Click "Register" on the login page
3. Enter username, email, and password
4. Click "Register" to create your account

## First Steps

### Test the Camera Scanner

1. Navigate to **AI Upload** in the menu
2. Click **📸 Use Camera** button
3. Click **Start Camera** to activate your device camera
4. Point camera at a paper form or document
5. Click **📸 Capture** to take the photo
6. Click **🤖 Process with AI** to convert to digital form
7. The OCR will extract text and generate form fields automatically

### Create a Form Manually

1. Go to **Forms** → **+ Create Form**
2. Add a title like "Service Call Form"
3. Drag and drop field types from the sidebar
4. Configure each field (label, required, options)
5. Click **Save Form**

### Test Address-to-Map Feature

1. Navigate to **Dispatch**
2. Click **+ New Dispatch**
3. Enter any address (e.g., "1600 Amphitheatre Parkway, Mountain View, CA")
4. Save the dispatch
5. Click the **🗺️** button next to the address
6. Your default map application will open with the address

### Track Inventory

1. Go to **Inventory**
2. Click **+ Add Item**
3. Add items like "HVAC Filter", "Copper Pipe", etc.
4. Use **+** and **-** buttons to adjust quantities
5. Watch real-time updates across all open browser tabs

## Mobile Testing

### Test on Your Phone

1. Find your computer's IP address:
   ```bash
   # On Mac/Linux
   ifconfig | grep "inet "
   
   # On Windows
   ipconfig
   ```

2. Update client package.json proxy (if needed)

3. Access from phone browser:
   ```
   http://YOUR_IP:3000
   ```

4. Test camera features directly on mobile device

## Production Deployment

### Build for Production

```bash
# Build optimized frontend
cd client
npm run build
cd ..

# Start production server
NODE_ENV=production PORT=3001 npm start
```

### Environment Variables for Production

Edit `.env`:
```env
NODE_ENV=production
PORT=3001
JWT_SECRET=change-to-secure-random-string
```

## Common Issues

### Camera not working
- Check browser permissions (allow camera access)
- Use HTTPS in production (required for camera API)
- Try different browsers (Chrome/Safari work best)

### "Module not found" errors
```bash
# Clear caches and reinstall
rm -rf node_modules client/node_modules
npm install
cd client && npm install
```

### Port already in use
```bash
# Change port in .env
PORT=3002

# Or kill process using port
lsof -ti:3001 | xargs kill -9  # Mac/Linux
netstat -ano | findstr :3001   # Windows
```

## Features to Try

1. **AI Form Upload**
   - Upload PDF/Word documents
   - Scan forms with camera
   - Upload photos of forms

2. **Form Builder**
   - 16 different field types
   - Signature fields (UETA compliant)
   - GPS location capture
   - Photo/barcode fields

3. **Dispatch Management**
   - Create work orders
   - Track status in real-time
   - Navigate to addresses
   - Priority management

4. **Inventory Tracking**
   - Add/edit items
   - Quick quantity adjustments
   - Low stock alerts
   - Category filtering

5. **Reports & Analytics**
   - View statistics
   - Track completion rates
   - Export to PDF/Excel
   - Monitor business metrics

## Testing

### Run Tests

```bash
# Run all tests
npm run test:all

# Run backend tests
npm test

# Run frontend tests
cd client
npm test
```

### Verify Installation

```bash
# Check backend can start
npm run server

# Check frontend can build
cd client
npm run build
```

For complete testing documentation, see [TESTING.md](TESTING.md).

## Building for Production

### Quick Build

```bash
# Build everything
npm run build:all
```

### Manual Build Steps

```bash
# Build frontend
cd client
npm run build
cd ..

# Start production server
NODE_ENV=production npm start
```

For complete build documentation, see [BUILD.md](BUILD.md).

## Next Steps

- Explore the comprehensive [README.md](README.md) for full documentation
- Check the roadmap for upcoming features
- Customize forms for your specific business needs
- Test on mobile devices for field work scenarios

## Support

If you encounter issues:
1. Check this guide first
2. Review the main README.md
3. Open an issue on GitHub
4. Check browser console for error messages

---

**Ready to transform your field service business!** 🚀
