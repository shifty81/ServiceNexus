# FormForce

[![CI/CD Pipeline](https://github.com/shifty81/FormForce/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/shifty81/FormForce/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AI-Powered Mobile Forms & Field Service Management Platform**

FormForce is a comprehensive, all-in-one field service management platform that combines AI-powered form creation with dispatching, inventory tracking, customer management (CRM), invoicing, and mobile capabilities. Designed for small to mid-sized businesses in trades like HVAC, plumbing, electrical, and construction.

---

## 🌟 Key Features

### 🤖 AI-Powered Form Creation
- **AI Form Builder**: Upload PDFs, Word documents, or images and instantly digitize them into functional digital forms
- **Camera Scanner**: Use your device camera to capture and convert paper forms into digital forms
- **OCR Technology**: Advanced optical character recognition extracts text and form fields from images
- **Drag-and-Drop Editor**: No-code interface to add fields, logic, and branding
- **Exact Formatting**: Preserves original look and feel for compliance requirements

### 📱 Advanced Data Capture
- **Rich Media Fields**: Images, sketches, GPS locations, and maps
- **Mobile-First Design**: iOS, Android, Windows compatible with offline support
- **Barcode/QR Scanning**: Quick data population from codes
- **eSignatures**: UETA and ESIGN compliant electronic signatures
- **Photo Capture**: Take photos with device camera or upload images
- **GPS Integration**: Click-to-map address navigation (opens default map app)

### ⚡ Automation & Smart Logic
- **Automated Calculations**: Excel-like formulas for complex operations
- **Conditional Logic**: Dynamic field visibility based on user input
- **DataSources**: Auto-populate fields from external systems
- **Automated Workflows**: Email PDFs, transfer drafts, cloud uploads

### 🚀 Dispatching & Scheduling
- **Drag-and-Drop Calendar**: Visual scheduling interface
- **Real-Time GPS Tracking**: Track technicians and fleet in real-time
- **Automated Job Assignments**: Smart dispatch based on availability
- **Address-to-Map Integration**: One-click navigation to job sites
- **Priority Management**: Urgent/High/Normal/Low prioritization
- **Status Tracking**: Pending, In-Progress, Completed workflows

### 📦 Real-Time Inventory Management
- **Live Tracking**: Real-time inventory updates via WebSocket
- **Low Stock Alerts**: Automatic notifications for items below threshold
- **Category Management**: Organize items by category and location
- **Quick Adjustments**: One-click quantity updates (+/-)
- **Multi-Location Support**: Track inventory across multiple warehouses

### 👥 Customer Management (CRM)
- **Centralized Database**: Customer contact information and history
- **Customer Profiles**: Company info, contacts, addresses
- **Search & Filter**: Quick customer lookup and organization
- **Real-time Sync**: Live updates across all devices
- **Communication Tracking**: Email, phone, and note history

### 💰 Invoicing & Payments
- **Professional Invoicing**: Create branded invoices quickly
- **Estimate-to-Invoice Conversion**: One-click conversion from estimates
- **Line Item Management**: Detailed pricing breakdown
- **Payment Tracking**: Record and track payments (pending/partial/paid)
- **Tax Calculations**: Automatic tax calculation by rate
- **Multiple Tiers**: Good/Better/Best pricing options via line items

### ⏰ Time Tracking & Payroll
- **Clock In/Out**: Simple time tracking for employees
- **Live Timers**: Real-time elapsed time display
- **Payroll Calculation**: Automatic hours and pay calculation
- **Hourly Rates**: Customizable rates per employee
- **Break Tracking**: Deduct break time from total hours
- **Payroll Reports**: Summary by employee and date range

### 📊 Reporting & Analytics
- **Customizable Reports**: Aggregate data from multiple forms
- **Visual Dashboards**: Track trends and KPIs
- **Performance Metrics**: Dispatch completion rates, response times
- **Export Options**: PDF, Excel, email delivery

### 🔒 Enterprise Security & Compliance
- **UETA/ESIGN Compliant**: Legally binding electronic signatures
- **SOC 2 Type 2**: Enterprise-grade security standards
- **HIPAA Available**: Optional add-on for healthcare providers
- **Custom SSO**: Single Sign-On integration
- **Granular Permissions**: Role-based access control

### 📱 Progressive Web App (PWA)
- **Install on Device**: Add to home screen on any device
- **Offline Support**: Service worker for offline functionality
- **Push Notifications**: Real-time alerts and updates
- **Mobile Optimized**: Native app-like experience
- **Cross-Platform**: Works on iOS, Android, and desktop

### 🔗 Integrations & API
- **Integrations Framework** ✅: Secure management system for external connections
- **API Keys** ✅: Generate and manage API keys with granular permissions
- **Webhooks** ✅: Real-time event notifications to external systems
- **Rate Limiting** ✅: 100 requests per 15 minutes per IP for security
- **QuickBooks**: Seamless accounting sync (coming soon)
- **Salesforce**: CRM integration (coming soon)
- **Google Workspace**: Calendar, Gmail, Drive integration (coming soon)
- **Procore**: Construction management integration (coming soon)
- **Open API**: RESTful API with authentication and comprehensive documentation

---

## 🏗️ Technology Stack

### Backend
- **Node.js** with Express.js
- **SQLite** database (easily upgradable to PostgreSQL/MySQL)
- **Socket.io** for real-time updates
- **JWT** authentication
- **bcrypt** for password hashing

### Frontend
- **React 18** with React Router
- **Socket.io-client** for real-time features
- **Signature Pad** for UETA-compliant signatures
- **Tesseract.js** for OCR processing
- **Axios** for API communication
- **Chart.js** for data visualization

---

## 📚 Documentation

- **[Quick Setup Guide](SETUP.md)** - Get started in 5 minutes
- **[Build Guide](BUILD.md)** - Building for development and production
- **[Testing Guide](TESTING.md)** - Running and writing tests
- **[Features Overview](FEATURES.md)** - Complete feature list
- **[Security](SECURITY.md)** - Security measures and compliance

---

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ and npm

### Automated Installation (Windows PowerShell) 🪟

**Fastest way to get started on Windows:**

```powershell
# Clone the repository
git clone https://github.com/shifty81/FormForce.git
cd FormForce

# Run automated build script (handles everything!)
.\build.ps1

# Or build and start development servers immediately
.\build.ps1 -StartDev
```

The PowerShell script automatically handles all setup steps including prerequisites checking, dependency installation, environment configuration, and building the project. See [BUILD.md](BUILD.md#automated-build-windows-powershell) for all options.

### Manual Installation (All Platforms)

1. **Clone the repository**
```bash
git clone https://github.com/shifty81/FormForce.git
cd FormForce
```

2. **Install server dependencies**
```bash
npm install
```

3. **Install client dependencies**
```bash
cd client
npm install
cd ..
```

4. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Start development servers**
```bash
# Terminal 1: Start backend
npm run server

# Terminal 2: Start frontend
cd client
npm start
```

6. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Testing

```bash
# Run all tests
npm run test:all

# Run backend tests only
npm test

# Run frontend tests only
cd client && npm test
```

See [TESTING.md](TESTING.md) for detailed testing documentation.

### Production Build

```bash
# Build everything
npm run build:all

# Start production server
NODE_ENV=production npm start
```

See [BUILD.md](BUILD.md) for detailed build and deployment instructions.

---

## 📖 Usage Guide

### Creating Forms

#### Option 1: AI Upload (PDF/Word/Images)
1. Navigate to **AI Upload** page
2. Choose upload method:
   - **Upload File**: Select PDF or Word document
   - **Use Camera**: Scan paper forms with device camera
   - **Upload Photo**: Select image file (JPG, PNG, etc.)
3. Click **Process with AI**
4. Review and customize generated form fields
5. Save the form

#### Option 2: Manual Form Builder
1. Go to **Forms** → **Create Form**
2. Add form title and description
3. Drag and drop fields from the sidebar:
   - Text, Email, Phone, Number
   - Date, Time, Textarea
   - Dropdown, Radio, Checkbox
   - File Upload, Signature
   - GPS Location, Photo Capture
   - Barcode Scanner, Auto-Calculate
4. Configure field properties:
   - Label, Required status
   - Options for dropdowns/radio
   - Validation rules
5. Save the form

### Managing Dispatches

1. Navigate to **Dispatch** page
2. Click **+ New Dispatch**
3. Fill in dispatch details:
   - Title and description
   - Address (for GPS navigation)
   - Status and priority
   - Due date
4. Click address **🗺️** button to open in maps
5. Update status as work progresses
6. Mark as complete when finished

### Tracking Inventory

1. Go to **Inventory** page
2. Click **+ Add Item**
3. Enter item details:
   - Name, description
   - Quantity and unit
   - Category and location
4. Use **+/-** buttons for quick adjustments
5. Filter by category or search items
6. Monitor low stock alerts

### Generating Reports

1. Visit **Reports** page
2. View key metrics:
   - Form submissions
   - Dispatch performance
   - Inventory status
3. Export data to PDF or Excel
4. Schedule automated report delivery

---

## 🎯 Use Cases

### HVAC Companies
- Service call forms with equipment details
- Maintenance checklists with photos
- Parts inventory tracking
- Technician scheduling and routing
- Customer service history

### Plumbing Services
- Job estimates with pricing tiers
- Work order forms with signatures
- Emergency dispatch management
- Supply inventory tracking
- Invoice generation

### Electrical Contractors
- Safety inspection forms
- Permit documentation
- Material usage tracking
- Multi-site job scheduling
- Compliance reporting

### Construction
- Daily logs with photo documentation
- Equipment inspection checklists
- Material inventory management
- Subcontractor coordination
- Progress reporting

---

## 🔐 Security & Compliance

### Electronic Signatures
- **UETA Compliant**: Uniform Electronic Transactions Act
- **ESIGN Compliant**: Electronic Signatures in Global and National Commerce Act
- Legally binding signatures with audit trails
- Timestamp and user identification

### Data Protection
- Encrypted data transmission (HTTPS)
- Secure password storage (bcrypt)
- JWT token-based authentication
- Role-based access control
- Session management

### Compliance Options
- **HIPAA**: Available for healthcare providers
- **SOC 2 Type 2**: Enterprise security standards
- **GDPR Ready**: Data privacy controls
- **Custom SSO**: Enterprise authentication

---

## 🛣️ Roadmap

### Phase 1: Core Features ✅
- [x] Form builder with AI upload
- [x] Camera scanner and OCR
- [x] Dispatch management
- [x] Inventory tracking
- [x] Real-time updates
- [x] GPS integration

### Phase 2: Field Service Management ✅
- [x] Full CRM with customer database
- [x] Estimates and invoicing system
- [x] Payment processing integration
- [x] Time tracking and payroll
- [x] Advanced scheduling calendar (via dispatch)
- [x] Mobile app for technicians (PWA)

### Phase 3: Integrations 🔧 (In Progress)
- [x] **Integrations Framework** ✅
  - [x] Integration management system
  - [x] API key generation and management
  - [x] Webhook registration and delivery
  - [x] Rate limiting and security
- [ ] QuickBooks sync
- [ ] Salesforce connector
- [ ] Google Workspace integration
- [ ] Microsoft 365 sync
- [ ] Procore integration
- [x] Open API framework ✅ (API keys and webhooks ready)
- [ ] API documentation and playground

### Phase 4: Advanced Features
- [ ] AI-powered service call routing
- [ ] Predictive maintenance alerts
- [ ] Customer feedback system
- [ ] Multi-language support
- [ ] White-label options
- [ ] Advanced analytics and BI

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Documentation**: [GitHub Wiki](https://github.com/shifty81/FormForce/wiki)
- **Issues**: [GitHub Issues](https://github.com/shifty81/FormForce/issues)
- **Discussions**: [GitHub Discussions](https://github.com/shifty81/FormForce/discussions)

---

## 🙏 Acknowledgments

- Built with React and Node.js
- OCR powered by Tesseract.js
- Icons and emojis for visual enhancement
- Inspired by leading field service management platforms

---

**FormForce** - Empowering field service businesses with AI-powered digital transformation 🚀
