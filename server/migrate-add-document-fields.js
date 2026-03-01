const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../servicenexus.db');
const db = new sqlite3.Database(dbPath);

console.log('Running migration: Add document upload fields to forms table...');

db.serialize(() => {
  // Check if columns already exist
  db.all("PRAGMA table_info(forms)", (err, columns) => {
    if (err) {
      console.error('Error checking table schema:', err);
      db.close();
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    
    // Add uploaded_file_path column if it doesn't exist
    if (!columnNames.includes('uploaded_file_path')) {
      db.run("ALTER TABLE forms ADD COLUMN uploaded_file_path TEXT", (err) => {
        if (err) {
          console.error('Error adding uploaded_file_path column:', err);
        } else {
          console.log('Added uploaded_file_path column');
        }
      });
    }
    
    // Add uploaded_file_type column if it doesn't exist
    if (!columnNames.includes('uploaded_file_type')) {
      db.run("ALTER TABLE forms ADD COLUMN uploaded_file_type TEXT", (err) => {
        if (err) {
          console.error('Error adding uploaded_file_type column:', err);
        } else {
          console.log('Added uploaded_file_type column');
        }
      });
    }
    
    // Add field_positions column if it doesn't exist
    if (!columnNames.includes('field_positions')) {
      db.run("ALTER TABLE forms ADD COLUMN field_positions TEXT", (err) => {
        if (err) {
          console.error('Error adding field_positions column:', err);
        } else {
          console.log('Added field_positions column');
        }
        
        db.close(() => {
          console.log('Migration completed successfully!');
        });
      });
    } else {
      db.close(() => {
        console.log('All columns already exist. Migration completed!');
      });
    }
  });
});
