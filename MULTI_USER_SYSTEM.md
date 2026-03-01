# Multi-User Type Service Call Management System

## Overview

This update removes the external Servicecall.ai integration and implements a comprehensive in-house service call management system with three distinct user types: Client, Technician, and Admin.

## Architecture Changes

### Database Schema

#### New Tables

1. **users** (updated)
   - Added `user_type` field (client, technician, admin)

2. **service_calls**
   - Enhanced dispatch system with customer linking
   - Status tracking (pending, in-progress, completed, cancelled)
   - Priority management (low, normal, high, urgent)

3. **service_call_comments**
   - Real-time communication on service calls
   - User attribution and timestamps

4. **service_call_pictures**
   - Picture uploads with metadata
   - AI-powered serial number extraction
   - Technician comments per picture

5. **equipment**
   - Equipment tracking per service call and customer
   - Serial numbers, models, manufacturers
   - Location details

6. **qr_codes**
   - QR codes for customer locations
   - Active/inactive status management

7. **check_ins**
   - Technician check-in/check-out tracking
   - GPS coordinates support
   - Time logging

8. **purchase_orders**
   - Purchase order management
   - Line items with quantity and pricing
   - Approval workflow (draft → approved/rejected → received)

### Backend APIs

#### Service Calls (`/api/servicecalls`)
- `GET /` - List all service calls (filtered by user type)
- `GET /:id` - Get service call with details (comments, pictures, equipment, check-ins)
- `POST /` - Create new service call
- `PUT /:id` - Update service call
- `POST /:id/complete` - Mark as completed
- `DELETE /:id` - Delete service call
- `POST /:id/comments` - Add comment
- `GET /:id/comments` - Get comments

#### QR Codes & Check-ins (`/api/qrcodes`)
- `POST /generate` - Generate QR code for customer location
- `GET /customer/:customerId` - Get QR codes for customer
- `POST /validate` - Validate QR code
- `PUT /:id/deactivate` - Deactivate QR code
- `POST /checkin` - Technician check-in
- `POST /checkout/:checkInId` - Technician check-out
- `GET /active/:technicianId` - Get active check-in
- `GET /servicecall/:serviceCallId` - Get check-ins for service call

#### Equipment (`/api/equipment`)
- `GET /servicecall/:serviceCallId` - List equipment for service call
- `GET /customer/:customerId` - List equipment for customer
- `POST /` - Add equipment
- `PUT /:id` - Update equipment
- `DELETE /:id` - Delete equipment

#### Pictures (`/api/pictures`)
- `POST /upload` - Upload picture (with rate limiting)
- `GET /servicecall/:serviceCallId` - Get pictures for service call
- `PUT /:id` - Update picture comment
- `DELETE /:id` - Delete picture (with rate limiting)
- `GET /view/:filename` - Serve picture file (with rate limiting)

#### Purchase Orders (`/api/purchaseorders`)
- `GET /` - List purchase orders
- `GET /:id` - Get purchase order details
- `POST /` - Create purchase order
- `PUT /:id` - Update purchase order
- `POST /:id/approve` - Approve (admin only)
- `POST /:id/reject` - Reject (admin only)
- `POST /:id/receive` - Mark as received
- `DELETE /:id` - Delete purchase order

### Frontend Components

#### Role-Based Navigation
Navigation adapts based on user type:

**Client:**
- Dashboard
- My Service Requests

**Technician:**
- Dashboard
- Service Calls
- Purchase Orders
- Inventory

**Admin:**
- Dashboard
- Forms
- AI Upload
- Service Calls
- Dispatch
- Purchase Orders
- Inventory
- Customers
- Estimates
- Invoices
- Time Tracking
- Reports

#### New Pages

1. **ServiceCalls** (`/servicecalls`)
   - List view with filtering by user type
   - Create/edit service calls
   - Status and priority badges
   - Quick actions per role

2. **ServiceCallDetail** (`/servicecalls/:id`)
   - Full service call information
   - Real-time comments section
   - Picture upload with preview (technician/admin)
   - Equipment listing and management
   - QR code check-in/out (technician)
   - Check-in history

3. **PurchaseOrders** (`/purchaseorders`)
   - List view with status filtering
   - Create/edit purchase orders with line items
   - Approval workflow (admin)
   - Link to service calls

4. **Updated Login**
   - User type selection during registration
   - Three options: Client, Technician, Admin

5. **Updated Customers**
   - QR code generation button per customer
   - QR code display modal
   - Instructions for QR code usage

## Features by User Type

### Client Users
- Submit service requests
- View their service calls
- Add comments and questions
- Receive real-time updates

### Technician Users
- View assigned service calls
- Check-in/out using QR codes at client locations
- Upload pictures with comments
- AI extraction of serial numbers from picture comments
- Track and record equipment at sites
- Create purchase orders for parts/materials
- Update service call status
- Real-time communication with clients

### Admin Users
- Full access to all features
- Assign service calls to technicians
- Manage customers and QR codes
- Approve/reject purchase orders
- Access all reporting and analytics
- Manage forms, estimates, invoices
- Configure system settings

## Security Features

1. **Rate Limiting**
   - File upload operations: 100 requests per 15 minutes per IP
   - File deletion operations: 100 requests per 15 minutes per IP
   - File serving operations: 100 requests per 15 minutes per IP

2. **Authentication**
   - JWT token-based authentication
   - User type verification
   - Role-based access control

3. **Data Protection**
   - SQL injection protection via parameterized queries
   - Input validation on all endpoints
   - Secure file upload with type and size restrictions

## Real-Time Features

WebSocket events for live updates:
- `service-call-changed` - Service call created/updated
- `service-call-comment-added` - New comment added
- `picture-uploaded` - Picture uploaded
- `equipment-added` - Equipment added
- `equipment-updated` - Equipment updated
- `equipment-deleted` - Equipment deleted
- `technician-checked-in` - Technician checked in
- `technician-checked-out` - Technician checked out
- `purchase-order-changed` - Purchase order created/updated

## AI Features

### Serial Number Extraction
Automatically extracts serial numbers from picture comments using pattern matching:
- Pattern: ABC123456 (letters followed by numbers)
- Pattern: 1234567890 (long numeric sequences)
- Pattern: SN: ABC-123 or Serial: ABC-123 (labeled formats)

Future enhancement: Integration with OCR/AI service for direct image analysis.

## Migration Guide

### For Existing Users
1. All users will be assigned `user_type: 'admin'` by default
2. Create technician accounts for field workers
3. Create client accounts for customers who will submit requests
4. Generate QR codes for customer locations
5. Train technicians on QR code check-in process

### Configuration
1. Update `.env` if needed (no new environment variables required)
2. Database migrations run automatically on first startup
3. Install new dependencies: `npm install`

## Testing

- All existing tests pass (13 tests)
- Backend API tests verified
- Server startup successful
- CodeQL security scan: 0 vulnerabilities
- Rate limiting tested and functional

## Dependencies Added

- `multer` (^1.4.5-lts.1) - File upload handling
- `qrcode` (^1.5.3) - QR code generation
- `express-rate-limit` (^7.1.5) - API rate limiting

## Future Enhancements

1. **Enhanced AI**
   - Direct image OCR for serial number extraction
   - Equipment recognition from photos
   - Auto-populate equipment details

2. **Advanced QR Features**
   - QR code generation API for mobile apps
   - Visual QR code rendering in UI
   - QR code printing functionality

3. **Reporting**
   - Technician performance metrics
   - Service call analytics
   - Equipment tracking reports
   - Purchase order spending analysis

4. **Mobile App**
   - Native mobile app for technicians
   - Offline mode support
   - Camera integration for QR scanning
   - GPS-based check-in validation

## Support

For issues or questions:
- GitHub Issues: https://github.com/shifty81/FieldForge/issues
- Documentation: See README.md and FEATURES.md
