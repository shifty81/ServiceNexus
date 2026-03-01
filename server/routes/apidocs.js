const express = require('express');
const router = express.Router();

const API_VERSION = '1.0.0';

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'ServiceNexus API',
    version: API_VERSION,
    description: 'Comprehensive API for ServiceNexus field service management platform. Manages forms, dispatching, inventory, customers, estimates, invoices, time tracking, service calls, equipment, and more.'
  },
  servers: [
    { url: '/api', description: 'API base path' }
  ],
  tags: [
    { name: 'Auth', description: 'Authentication and user management' },
    { name: 'Forms', description: 'Form templates and submissions' },
    { name: 'Dispatch', description: 'Dispatch management' },
    { name: 'Inventory', description: 'Inventory tracking' },
    { name: 'Customers', description: 'Customer management' },
    { name: 'Estimates', description: 'Estimate creation and conversion' },
    { name: 'Invoices', description: 'Invoice management and payments' },
    { name: 'Time Tracking', description: 'Clock in/out and payroll' },
    { name: 'Service Calls', description: 'Service call lifecycle management' },
    { name: 'QR Codes', description: 'QR code generation and check-in/out' },
    { name: 'Equipment', description: 'Equipment tracking' },
    { name: 'Pictures', description: 'Photo upload and management' },
    { name: 'Purchase Orders', description: 'Purchase order workflow' },
    { name: 'Integrations', description: 'Third-party integrations' },
    { name: 'API Keys', description: 'API key management' },
    { name: 'Webhooks', description: 'Webhook configuration and delivery' },
    { name: 'Feedback', description: 'Customer feedback and ratings' },
    { name: 'Analytics', description: 'Dashboard and reporting analytics' },
    { name: 'Admin', description: 'Administration and system health' },
    { name: 'Portal', description: 'Client portal access' }
  ],
  paths: {
    // Auth
    '/auth/register': {
      post: { tags: ['Auth'], summary: 'Register a new user', operationId: 'registerUser' }
    },
    '/auth/login': {
      post: { tags: ['Auth'], summary: 'Authenticate and receive a JWT token', operationId: 'loginUser' }
    },
    '/auth/users': {
      get: { tags: ['Auth'], summary: 'List all users', operationId: 'listUsers' }
    },

    // Forms
    '/forms': {
      get: { tags: ['Forms'], summary: 'List all form templates', operationId: 'listForms' },
      post: { tags: ['Forms'], summary: 'Create a new form template', operationId: 'createForm' }
    },
    '/forms/{id}': {
      get: { tags: ['Forms'], summary: 'Get a form template by ID', operationId: 'getForm' },
      put: { tags: ['Forms'], summary: 'Update a form template', operationId: 'updateForm' },
      delete: { tags: ['Forms'], summary: 'Delete a form template', operationId: 'deleteForm' }
    },
    '/forms/{id}/submissions': {
      get: { tags: ['Forms'], summary: 'List submissions for a form', operationId: 'listFormSubmissions' },
      post: { tags: ['Forms'], summary: 'Submit a form response', operationId: 'createFormSubmission' }
    },

    // Dispatch
    '/dispatch': {
      get: { tags: ['Dispatch'], summary: 'List all dispatches', operationId: 'listDispatches' },
      post: { tags: ['Dispatch'], summary: 'Create a new dispatch', operationId: 'createDispatch' }
    },
    '/dispatch/{id}': {
      get: { tags: ['Dispatch'], summary: 'Get a dispatch by ID', operationId: 'getDispatch' },
      put: { tags: ['Dispatch'], summary: 'Update a dispatch', operationId: 'updateDispatch' },
      delete: { tags: ['Dispatch'], summary: 'Delete a dispatch', operationId: 'deleteDispatch' }
    },

    // Inventory
    '/inventory': {
      get: { tags: ['Inventory'], summary: 'List all inventory items', operationId: 'listInventory' },
      post: { tags: ['Inventory'], summary: 'Create an inventory item', operationId: 'createInventoryItem' }
    },
    '/inventory/{id}': {
      get: { tags: ['Inventory'], summary: 'Get an inventory item by ID', operationId: 'getInventoryItem' },
      put: { tags: ['Inventory'], summary: 'Update an inventory item', operationId: 'updateInventoryItem' },
      delete: { tags: ['Inventory'], summary: 'Delete an inventory item', operationId: 'deleteInventoryItem' }
    },

    // Customers
    '/customers': {
      get: { tags: ['Customers'], summary: 'List all customers', operationId: 'listCustomers' },
      post: { tags: ['Customers'], summary: 'Create a new customer', operationId: 'createCustomer' }
    },
    '/customers/{id}': {
      get: { tags: ['Customers'], summary: 'Get a customer by ID', operationId: 'getCustomer' },
      put: { tags: ['Customers'], summary: 'Update a customer', operationId: 'updateCustomer' },
      delete: { tags: ['Customers'], summary: 'Delete a customer', operationId: 'deleteCustomer' }
    },

    // Estimates
    '/estimates': {
      get: { tags: ['Estimates'], summary: 'List all estimates', operationId: 'listEstimates' },
      post: { tags: ['Estimates'], summary: 'Create a new estimate', operationId: 'createEstimate' }
    },
    '/estimates/{id}': {
      get: { tags: ['Estimates'], summary: 'Get an estimate by ID', operationId: 'getEstimate' },
      put: { tags: ['Estimates'], summary: 'Update an estimate', operationId: 'updateEstimate' },
      delete: { tags: ['Estimates'], summary: 'Delete an estimate', operationId: 'deleteEstimate' }
    },
    '/estimates/{id}/convert': {
      post: { tags: ['Estimates'], summary: 'Convert an estimate to an invoice', operationId: 'convertEstimateToInvoice' }
    },

    // Invoices
    '/invoices': {
      get: { tags: ['Invoices'], summary: 'List all invoices', operationId: 'listInvoices' },
      post: { tags: ['Invoices'], summary: 'Create a new invoice', operationId: 'createInvoice' }
    },
    '/invoices/{id}': {
      get: { tags: ['Invoices'], summary: 'Get an invoice by ID', operationId: 'getInvoice' },
      put: { tags: ['Invoices'], summary: 'Update an invoice', operationId: 'updateInvoice' },
      delete: { tags: ['Invoices'], summary: 'Delete an invoice', operationId: 'deleteInvoice' }
    },
    '/invoices/{id}/payment': {
      post: { tags: ['Invoices'], summary: 'Record a payment against an invoice', operationId: 'recordInvoicePayment' }
    },

    // Time Tracking
    '/timetracking/clock-in': {
      post: { tags: ['Time Tracking'], summary: 'Clock in for a shift', operationId: 'clockIn' }
    },
    '/timetracking/clock-out': {
      post: { tags: ['Time Tracking'], summary: 'Clock out of a shift', operationId: 'clockOut' }
    },
    '/timetracking/entries': {
      get: { tags: ['Time Tracking'], summary: 'List time tracking entries', operationId: 'listTimeEntries' }
    },
    '/timetracking/payroll': {
      get: { tags: ['Time Tracking'], summary: 'Get payroll summary', operationId: 'getPayroll' }
    },

    // Service Calls
    '/servicecalls': {
      get: { tags: ['Service Calls'], summary: 'List all service calls', operationId: 'listServiceCalls' },
      post: { tags: ['Service Calls'], summary: 'Create a new service call', operationId: 'createServiceCall' }
    },
    '/servicecalls/{id}': {
      get: { tags: ['Service Calls'], summary: 'Get a service call by ID', operationId: 'getServiceCall' },
      put: { tags: ['Service Calls'], summary: 'Update a service call', operationId: 'updateServiceCall' },
      delete: { tags: ['Service Calls'], summary: 'Delete a service call', operationId: 'deleteServiceCall' }
    },
    '/servicecalls/{id}/complete': {
      post: { tags: ['Service Calls'], summary: 'Mark a service call as complete', operationId: 'completeServiceCall' }
    },
    '/servicecalls/{id}/comments': {
      get: { tags: ['Service Calls'], summary: 'Get comments for a service call', operationId: 'getServiceCallComments' },
      post: { tags: ['Service Calls'], summary: 'Add a comment to a service call', operationId: 'addServiceCallComment' }
    },

    // QR Codes
    '/qrcodes/generate': {
      post: { tags: ['QR Codes'], summary: 'Generate a new QR code', operationId: 'generateQrCode' }
    },
    '/qrcodes/validate': {
      post: { tags: ['QR Codes'], summary: 'Validate a QR code', operationId: 'validateQrCode' }
    },
    '/qrcodes/check-in': {
      post: { tags: ['QR Codes'], summary: 'Check in via QR code', operationId: 'qrCheckIn' }
    },
    '/qrcodes/check-out': {
      post: { tags: ['QR Codes'], summary: 'Check out via QR code', operationId: 'qrCheckOut' }
    },

    // Equipment
    '/equipment': {
      get: { tags: ['Equipment'], summary: 'List all equipment', operationId: 'listEquipment' },
      post: { tags: ['Equipment'], summary: 'Create an equipment record', operationId: 'createEquipment' }
    },
    '/equipment/{id}': {
      get: { tags: ['Equipment'], summary: 'Get equipment by ID', operationId: 'getEquipment' },
      put: { tags: ['Equipment'], summary: 'Update equipment', operationId: 'updateEquipment' },
      delete: { tags: ['Equipment'], summary: 'Delete equipment', operationId: 'deleteEquipment' }
    },

    // Pictures
    '/pictures': {
      get: { tags: ['Pictures'], summary: 'List all pictures', operationId: 'listPictures' },
      post: { tags: ['Pictures'], summary: 'Upload a picture', operationId: 'uploadPicture' }
    },
    '/pictures/{id}': {
      get: { tags: ['Pictures'], summary: 'Get a picture by ID', operationId: 'getPicture' },
      put: { tags: ['Pictures'], summary: 'Update picture metadata', operationId: 'updatePicture' },
      delete: { tags: ['Pictures'], summary: 'Delete a picture', operationId: 'deletePicture' }
    },

    // Purchase Orders
    '/purchaseorders': {
      get: { tags: ['Purchase Orders'], summary: 'List all purchase orders', operationId: 'listPurchaseOrders' },
      post: { tags: ['Purchase Orders'], summary: 'Create a purchase order', operationId: 'createPurchaseOrder' }
    },
    '/purchaseorders/{id}': {
      get: { tags: ['Purchase Orders'], summary: 'Get a purchase order by ID', operationId: 'getPurchaseOrder' },
      put: { tags: ['Purchase Orders'], summary: 'Update a purchase order', operationId: 'updatePurchaseOrder' },
      delete: { tags: ['Purchase Orders'], summary: 'Delete a purchase order', operationId: 'deletePurchaseOrder' }
    },
    '/purchaseorders/{id}/approve': {
      post: { tags: ['Purchase Orders'], summary: 'Approve a purchase order', operationId: 'approvePurchaseOrder' }
    },
    '/purchaseorders/{id}/reject': {
      post: { tags: ['Purchase Orders'], summary: 'Reject a purchase order', operationId: 'rejectPurchaseOrder' }
    },
    '/purchaseorders/{id}/receive': {
      post: { tags: ['Purchase Orders'], summary: 'Mark a purchase order as received', operationId: 'receivePurchaseOrder' }
    },

    // Integrations
    '/integrations': {
      get: { tags: ['Integrations'], summary: 'List all integrations', operationId: 'listIntegrations' },
      post: { tags: ['Integrations'], summary: 'Create an integration', operationId: 'createIntegration' }
    },
    '/integrations/{id}': {
      get: { tags: ['Integrations'], summary: 'Get an integration by ID', operationId: 'getIntegration' },
      put: { tags: ['Integrations'], summary: 'Update an integration', operationId: 'updateIntegration' },
      delete: { tags: ['Integrations'], summary: 'Delete an integration', operationId: 'deleteIntegration' }
    },
    '/integrations/{id}/test': {
      post: { tags: ['Integrations'], summary: 'Test an integration connection', operationId: 'testIntegration' }
    },
    '/integrations/{id}/sync': {
      post: { tags: ['Integrations'], summary: 'Trigger a sync for an integration', operationId: 'syncIntegration' }
    },

    // API Keys
    '/apikeys': {
      get: { tags: ['API Keys'], summary: 'List all API keys', operationId: 'listApiKeys' },
      post: { tags: ['API Keys'], summary: 'Create a new API key', operationId: 'createApiKey' }
    },
    '/apikeys/{id}': {
      get: { tags: ['API Keys'], summary: 'Get an API key by ID', operationId: 'getApiKey' },
      put: { tags: ['API Keys'], summary: 'Update an API key', operationId: 'updateApiKey' },
      delete: { tags: ['API Keys'], summary: 'Revoke an API key', operationId: 'deleteApiKey' }
    },
    '/apikeys/validate': {
      post: { tags: ['API Keys'], summary: 'Validate an API key', operationId: 'validateApiKey' }
    },

    // Webhooks
    '/webhooks': {
      get: { tags: ['Webhooks'], summary: 'List all webhooks', operationId: 'listWebhooks' },
      post: { tags: ['Webhooks'], summary: 'Create a webhook', operationId: 'createWebhook' }
    },
    '/webhooks/{id}': {
      get: { tags: ['Webhooks'], summary: 'Get a webhook by ID', operationId: 'getWebhook' },
      put: { tags: ['Webhooks'], summary: 'Update a webhook', operationId: 'updateWebhook' },
      delete: { tags: ['Webhooks'], summary: 'Delete a webhook', operationId: 'deleteWebhook' }
    },
    '/webhooks/{id}/test': {
      post: { tags: ['Webhooks'], summary: 'Send a test delivery for a webhook', operationId: 'testWebhook' }
    },
    '/webhooks/{id}/deliveries': {
      get: { tags: ['Webhooks'], summary: 'List delivery attempts for a webhook', operationId: 'listWebhookDeliveries' }
    },

    // Feedback
    '/feedback': {
      get: { tags: ['Feedback'], summary: 'List all feedback entries', operationId: 'listFeedback' },
      post: { tags: ['Feedback'], summary: 'Submit feedback', operationId: 'createFeedback' }
    },
    '/feedback/{id}': {
      get: { tags: ['Feedback'], summary: 'Get feedback by ID', operationId: 'getFeedback' },
      put: { tags: ['Feedback'], summary: 'Update feedback', operationId: 'updateFeedback' },
      delete: { tags: ['Feedback'], summary: 'Delete feedback', operationId: 'deleteFeedback' }
    },

    // Analytics
    '/analytics': {
      get: { tags: ['Analytics'], summary: 'Get comprehensive analytics dashboard data', operationId: 'getAnalytics' }
    },

    // Admin
    '/admin/health': {
      get: { tags: ['Admin'], summary: 'System health check', operationId: 'healthCheck' }
    },
    '/admin/users': {
      get: { tags: ['Admin'], summary: 'List all users (admin)', operationId: 'adminListUsers' }
    },
    '/admin/stats': {
      get: { tags: ['Admin'], summary: 'Get system statistics', operationId: 'getSystemStats' }
    },
    '/admin/config': {
      get: { tags: ['Admin'], summary: 'Get system configuration', operationId: 'getConfig' },
      put: { tags: ['Admin'], summary: 'Update system configuration', operationId: 'updateConfig' }
    },

    // Portal
    '/portal': {
      get: { tags: ['Portal'], summary: 'Get client portal dashboard', operationId: 'getPortalDashboard' }
    },
    '/portal/servicecalls': {
      get: { tags: ['Portal'], summary: 'List service calls for a portal client', operationId: 'portalListServiceCalls' }
    },
    '/portal/invoices': {
      get: { tags: ['Portal'], summary: 'List invoices for a portal client', operationId: 'portalListInvoices' }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /api/auth/login'
      }
    }
  },
  security: [
    { bearerAuth: [] }
  ]
};

// Build the simplified endpoints list from the spec (computed once at startup)
function buildEndpointsList() {
  const groups = {};
  let total = 0;
  for (const [path, methods] of Object.entries(openApiSpec.paths)) {
    for (const [method, details] of Object.entries(methods)) {
      const tag = (details.tags && details.tags.length > 0) ? details.tags[0] : 'Other';
      if (!groups[tag]) {
        groups[tag] = [];
      }
      groups[tag].push({
        method: method.toUpperCase(),
        path: `/api${path}`,
        summary: details.summary
      });
      total++;
    }
  }
  return { total, groups };
}

const endpointsSummary = buildEndpointsList();

// GET / — Full OpenAPI 3.0 spec
router.get('/', (req, res) => {
  res.json(openApiSpec);
});

// GET /endpoints — Simplified endpoint list grouped by category
router.get('/endpoints', (req, res) => {
  res.json(endpointsSummary);
});

module.exports = router;
