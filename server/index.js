const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const db = require('./database');
const formsRouter = require('./routes/forms');
const dispatchRouter = require('./routes/dispatch');
const inventoryRouter = require('./routes/inventory');
const authRouter = require('./routes/auth');
const customersRouter = require('./routes/customers');
const estimatesRouter = require('./routes/estimates');
const invoicesRouter = require('./routes/invoices');
const timeTrackingRouter = require('./routes/timetracking');
const serviceCallsRouter = require('./routes/servicecalls');
const qrCodesRouter = require('./routes/qrcodes');
const equipmentRouter = require('./routes/equipment');
const picturesRouter = require('./routes/pictures');
const purchaseOrdersRouter = require('./routes/purchaseorders');
const integrationsRouter = require('./routes/integrations');
const apiKeysRouter = require('./routes/apikeys');
const webhooksRouter = require('./routes/webhooks');
const portalRouter = require('./routes/portal');
const feedbackRouter = require('./routes/feedback');
const analyticsRouter = require('./routes/analytics');
const adminRouter = require('./routes/admin');
const apidocsRouter = require('./routes/apidocs');
const routingRouter = require('./routes/routing');
const maintenanceRouter = require('./routes/maintenance');

const app = express();
const server = http.createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const corsOptions = {
  origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: CORS_ORIGIN !== '*'
};

const io = socketIo(server, { cors: corsOptions });

const PORT = process.env.PORT || 3001;

// Trust proxy when running behind a reverse proxy (nginx, cloud LB, etc.)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Make io accessible to routes
app.set('io', io);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/forms', formsRouter);
app.use('/api/dispatch', dispatchRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/customers', customersRouter);
app.use('/api/estimates', estimatesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/timetracking', timeTrackingRouter);
app.use('/api/servicecalls', serviceCallsRouter);
app.use('/api/qrcodes', qrCodesRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/pictures', picturesRouter);
app.use('/api/purchaseorders', purchaseOrdersRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/apikeys', apiKeysRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/portal', portalRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/docs', apidocsRouter);
app.use('/api/routing', routingRouter);
app.use('/api/maintenance', maintenanceRouter);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('inventory-update', (data) => {
    io.emit('inventory-changed', data);
  });

  socket.on('dispatch-update', (data) => {
    io.emit('dispatch-changed', data);
  });
});

// Initialize database and start server
db.initialize().then(() => {
  server.listen(PORT, () => {
    console.log(`FieldForge server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
