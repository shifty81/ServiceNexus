const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
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

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
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
    console.log(`FormForce server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
