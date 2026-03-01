const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../fieldforge.db');
const db = new sqlite3.Database(dbPath);

const initialize = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email TEXT,
          role TEXT DEFAULT 'user',
          user_type TEXT DEFAULT 'admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Forms table
      db.run(`
        CREATE TABLE IF NOT EXISTS forms (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          fields TEXT NOT NULL,
          uploaded_file_path TEXT,
          uploaded_file_type TEXT,
          field_positions TEXT,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Form submissions table
      db.run(`
        CREATE TABLE IF NOT EXISTS form_submissions (
          id TEXT PRIMARY KEY,
          form_id TEXT NOT NULL,
          data TEXT NOT NULL,
          signature TEXT,
          submitted_by TEXT,
          submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (form_id) REFERENCES forms(id),
          FOREIGN KEY (submitted_by) REFERENCES users(id)
        )
      `);

      // Dispatch table
      db.run(`
        CREATE TABLE IF NOT EXISTS dispatches (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          address TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          assigned_to TEXT,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'normal',
          due_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (assigned_to) REFERENCES users(id)
        )
      `);

      // Inventory table
      db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          quantity INTEGER DEFAULT 0,
          unit TEXT,
          category TEXT,
          location TEXT,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT,
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `);

      // Customers table (CRM)
      db.run(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          company_name TEXT,
          contact_name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          zip TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Estimates table
      db.run(`
        CREATE TABLE IF NOT EXISTS estimates (
          id TEXT PRIMARY KEY,
          estimate_number TEXT UNIQUE NOT NULL,
          customer_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'draft',
          subtotal REAL DEFAULT 0,
          tax_rate REAL DEFAULT 0,
          tax_amount REAL DEFAULT 0,
          total REAL DEFAULT 0,
          valid_until DATE,
          line_items TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Invoices table
      db.run(`
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number TEXT UNIQUE NOT NULL,
          customer_id TEXT NOT NULL,
          estimate_id TEXT,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'draft',
          subtotal REAL DEFAULT 0,
          tax_rate REAL DEFAULT 0,
          tax_amount REAL DEFAULT 0,
          total REAL DEFAULT 0,
          amount_paid REAL DEFAULT 0,
          due_date DATE,
          line_items TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          paid_at DATETIME,
          created_by TEXT,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (estimate_id) REFERENCES estimates(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Time entries table (for time tracking and payroll)
      db.run(`
        CREATE TABLE IF NOT EXISTS time_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          clock_in DATETIME NOT NULL,
          clock_out DATETIME,
          break_duration INTEGER DEFAULT 0,
          total_hours REAL,
          hourly_rate REAL,
          total_pay REAL,
          dispatch_id TEXT,
          notes TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (dispatch_id) REFERENCES dispatches(id)
        )
      `);

      // Service calls table (enhanced dispatches for the new system)
      db.run(`
        CREATE TABLE IF NOT EXISTS service_calls (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          customer_id TEXT,
          assigned_to TEXT,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'normal',
          due_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          created_by TEXT,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (assigned_to) REFERENCES users(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Service call comments table for real-time communication
      db.run(`
        CREATE TABLE IF NOT EXISTS service_call_comments (
          id TEXT PRIMARY KEY,
          service_call_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          comment TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (service_call_id) REFERENCES service_calls(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Service call pictures with AI metadata
      db.run(`
        CREATE TABLE IF NOT EXISTS service_call_pictures (
          id TEXT PRIMARY KEY,
          service_call_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          serial_numbers TEXT,
          comment TEXT,
          uploaded_by TEXT NOT NULL,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (service_call_id) REFERENCES service_calls(id),
          FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
      `);

      // Equipment table for tracking equipment at client sites
      db.run(`
        CREATE TABLE IF NOT EXISTS equipment (
          id TEXT PRIMARY KEY,
          service_call_id TEXT NOT NULL,
          customer_id TEXT,
          name TEXT NOT NULL,
          serial_number TEXT,
          model TEXT,
          manufacturer TEXT,
          location_details TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (service_call_id) REFERENCES service_calls(id),
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
      `);

      // QR codes for client locations
      db.run(`
        CREATE TABLE IF NOT EXISTS qr_codes (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          qr_code_data TEXT UNIQUE NOT NULL,
          location_name TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
      `);

      // Check-ins table for technician check-in/check-out tracking
      db.run(`
        CREATE TABLE IF NOT EXISTS check_ins (
          id TEXT PRIMARY KEY,
          service_call_id TEXT NOT NULL,
          technician_id TEXT NOT NULL,
          qr_code_id TEXT NOT NULL,
          check_in_time DATETIME NOT NULL,
          check_out_time DATETIME,
          location_latitude REAL,
          location_longitude REAL,
          notes TEXT,
          FOREIGN KEY (service_call_id) REFERENCES service_calls(id),
          FOREIGN KEY (technician_id) REFERENCES users(id),
          FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id)
        )
      `);

      // Purchase orders table
      db.run(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id TEXT PRIMARY KEY,
          po_number TEXT UNIQUE NOT NULL,
          service_call_id TEXT,
          vendor_name TEXT NOT NULL,
          vendor_contact TEXT,
          vendor_phone TEXT,
          vendor_email TEXT,
          status TEXT DEFAULT 'draft',
          subtotal REAL DEFAULT 0,
          tax_rate REAL DEFAULT 0,
          tax_amount REAL DEFAULT 0,
          total REAL DEFAULT 0,
          line_items TEXT,
          notes TEXT,
          requested_by TEXT,
          approved_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          approved_at DATETIME,
          FOREIGN KEY (service_call_id) REFERENCES service_calls(id),
          FOREIGN KEY (requested_by) REFERENCES users(id),
          FOREIGN KEY (approved_by) REFERENCES users(id)
        )
      `);

      // Integrations table for external system connections
      db.run(`
        CREATE TABLE IF NOT EXISTS integrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT DEFAULT 'inactive',
          config TEXT,
          credentials TEXT,
          last_sync DATETIME,
          sync_status TEXT,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Integration sync logs for tracking sync history
      db.run(`
        CREATE TABLE IF NOT EXISTS integration_sync_logs (
          id TEXT PRIMARY KEY,
          integration_id TEXT NOT NULL,
          sync_type TEXT NOT NULL,
          status TEXT NOT NULL,
          records_processed INTEGER DEFAULT 0,
          records_succeeded INTEGER DEFAULT 0,
          records_failed INTEGER DEFAULT 0,
          error_details TEXT,
          started_at DATETIME NOT NULL,
          completed_at DATETIME,
          FOREIGN KEY (integration_id) REFERENCES integrations(id)
        )
      `);

      // API keys table for external API access
      db.run(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          key_hash TEXT UNIQUE NOT NULL,
          key_prefix TEXT NOT NULL,
          permissions TEXT NOT NULL,
          last_used DATETIME,
          expires_at DATETIME,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Webhooks table for event notifications
      db.run(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          events TEXT NOT NULL,
          secret TEXT,
          is_active INTEGER DEFAULT 1,
          last_triggered DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Webhook delivery log for tracking webhook calls
      db.run(`
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id TEXT PRIMARY KEY,
          webhook_id TEXT NOT NULL,
          event TEXT NOT NULL,
          payload TEXT NOT NULL,
          response_status INTEGER,
          response_body TEXT,
          delivered_at DATETIME NOT NULL,
          succeeded INTEGER DEFAULT 0,
          error_message TEXT,
          FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
        )
      `);

      // Customer feedback / ratings for completed service calls
      db.run(`
        CREATE TABLE IF NOT EXISTS feedback (
          id TEXT PRIMARY KEY,
          service_call_id TEXT NOT NULL,
          technician_id TEXT,
          rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
          comment TEXT,
          submitted_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (service_call_id) REFERENCES service_calls(id),
          FOREIGN KEY (technician_id) REFERENCES users(id),
          FOREIGN KEY (submitted_by) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('Database initialized successfully');
          resolve();
        }
      });
    });
  });
};

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

module.exports = {
  initialize,
  query,
  run,
  get,
  db
};
