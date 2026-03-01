import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Customers.css';

function Customers({ socket }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    notes: ''
  });

  useEffect(() => {
    loadCustomers();

    if (socket) {
      socket.on('customer:created', (customer) => {
        setCustomers(prev => [customer, ...prev]);
      });
      socket.on('customer:updated', (customer) => {
        setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
      });
      socket.on('customer:deleted', (id) => {
        setCustomers(prev => prev.filter(c => c.id !== id));
      });
    }

    return () => {
      if (socket) {
        socket.off('customer:created');
        socket.off('customer:updated');
        socket.off('customer:deleted');
      }
    };
  }, [socket]);

  const loadCustomers = async () => {
    try {
      const response = await axios.get('/api/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await axios.put(`/api/customers/${editingCustomer.id}`, formData);
      } else {
        await axios.post('/api/customers', formData);
      }
      setShowModal(false);
      resetForm();
      loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Failed to save customer');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      company_name: customer.company_name || '',
      contact_name: customer.contact_name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zip: customer.zip || '',
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await axios.delete(`/api/customers/${id}`);
        loadCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      notes: ''
    });
    setEditingCustomer(null);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleGenerateQR = async (customer) => {
    try {
      const response = await axios.post('/api/qrcodes/generate', {
        customer_id: customer.id,
        location_name: customer.company_name || customer.contact_name
      });
      setSelectedCustomer({ ...customer, qrCode: response.data });
      setShowQRModal(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const search = searchTerm.toLowerCase();
    return (
      customer.contact_name.toLowerCase().includes(search) ||
      (customer.company_name && customer.company_name.toLowerCase().includes(search)) ||
      (customer.email && customer.email.toLowerCase().includes(search)) ||
      (customer.phone && customer.phone.toLowerCase().includes(search))
    );
  });

  const stats = {
    total: customers.length,
    withCompany: customers.filter(c => c.company_name).length,
    withEmail: customers.filter(c => c.email).length
  };

  if (loading) {
    return <div className="loading">Loading customers...</div>;
  }

  return (
    <div className="customers-container">
      <div className="customers-header">
        <div className="header-content">
          <h1>👥 Customer Management (CRM)</h1>
          <p>Manage your customer database and contact information</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add Customer
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.withCompany}</div>
          <div className="stat-label">With Company</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.withEmail}</div>
          <div className="stat-label">With Email</div>
        </div>
      </div>

      <div className="search-section">
        <input
          type="text"
          placeholder="🔍 Search by name, company, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="customers-grid">
        {filteredCustomers.length === 0 ? (
          <div className="no-customers">
            <p>No customers found. Add your first customer to get started!</p>
          </div>
        ) : (
          filteredCustomers.map(customer => (
            <div key={customer.id} className="customer-card">
              <div className="customer-header">
                <div>
                  <h3>{customer.contact_name}</h3>
                  {customer.company_name && (
                    <div className="company-name">🏢 {customer.company_name}</div>
                  )}
                </div>
                <div className="customer-actions">
                  <button 
                    onClick={() => handleGenerateQR(customer)} 
                    className="btn-qr"
                    title="Generate QR Code"
                  >
                    📱
                  </button>
                  <button onClick={() => handleEdit(customer)} className="btn-edit">
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(customer.id)} className="btn-delete">
                    🗑️
                  </button>
                </div>
              </div>
              
              <div className="customer-details">
                {customer.email && (
                  <div className="detail-item">
                    <span className="detail-icon">📧</span>
                    <a href={`mailto:${customer.email}`}>{customer.email}</a>
                  </div>
                )}
                {customer.phone && (
                  <div className="detail-item">
                    <span className="detail-icon">📞</span>
                    <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                  </div>
                )}
                {customer.address && (
                  <div className="detail-item">
                    <span className="detail-icon">📍</span>
                    <span>
                      {customer.address}
                      {customer.city && `, ${customer.city}`}
                      {customer.state && `, ${customer.state}`}
                      {customer.zip && ` ${customer.zip}`}
                    </span>
                  </div>
                )}
                {customer.notes && (
                  <div className="customer-notes">
                    <strong>Notes:</strong> {customer.notes}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="customer-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Contact Name *</label>
                  <input
                    type="text"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleInputChange}
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    placeholder="Acme Corporation"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Springfield"
                  />
                </div>
                <div className="form-group form-group-small">
                  <label>State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="CA"
                    maxLength="2"
                  />
                </div>
                <div className="form-group form-group-small">
                  <label>ZIP</label>
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleInputChange}
                    placeholder="12345"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Additional notes about this customer..."
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQRModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>QR Code for {selectedCustomer.contact_name}</h2>
              <button className="modal-close" onClick={() => setShowQRModal(false)}>✕</button>
            </div>
            <div className="qr-content">
              <div className="qr-info">
                <p><strong>Location:</strong> {selectedCustomer.qrCode.location_name}</p>
                <p><strong>QR Code Data:</strong> {selectedCustomer.qrCode.qr_code_data}</p>
                <p className="qr-instruction">
                  📱 Technicians should scan this QR code when they arrive at this location to check in.
                </p>
                <p className="qr-instruction">
                  🔒 Please maintain this QR code in a safe and accessible location at the service site.
                </p>
              </div>
              <div className="qr-display">
                <div className="qr-placeholder">
                  <div className="qr-text-display">
                    {selectedCustomer.qrCode.qr_code_data}
                  </div>
                  <p><small>Scan with FieldForge app or enter this code manually</small></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
