import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ServiceCalls.css';

function ServiceCalls({ socket }) {
  const navigate = useNavigate();
  const [serviceCalls, setServiceCalls] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCall, setEditingCall] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    customer_id: '',
    assigned_to: '',
    status: 'pending',
    priority: 'normal',
    due_date: ''
  });

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const userType = currentUser?.user_type || 'admin';

  useEffect(() => {
    loadServiceCalls();
    loadCustomers();
    loadUsers();

    if (socket) {
      socket.on('service-call-changed', () => {
        loadServiceCalls();
      });
    }

    return () => {
      if (socket) socket.off('service-call-changed');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const loadServiceCalls = async () => {
    try {
      const response = await axios.get('/api/servicecalls');
      let calls = response.data;
      
      // Filter based on user type
      if (userType === 'client') {
        // Show only calls created by this client user
        calls = calls.filter(call => call.created_by === currentUser.id);
      } else if (userType === 'technician') {
        // Show only calls assigned to this technician
        calls = calls.filter(call => call.assigned_to === currentUser.id);
      }
      // Admin sees all calls (no filtering)
      
      setServiceCalls(calls);
    } catch (error) {
      console.error('Error loading service calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await axios.get('/api/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get('/api/auth/users');
      setUsers(response.data.filter(u => u.user_type === 'technician'));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        created_by: currentUser.id
      };

      if (editingCall) {
        await axios.put(`/api/servicecalls/${editingCall.id}`, dataToSend);
      } else {
        await axios.post('/api/servicecalls', dataToSend);
      }
      setShowModal(false);
      resetForm();
      loadServiceCalls();
    } catch (error) {
      console.error('Error saving service call:', error);
      alert('Failed to save service call');
    }
  };

  const handleEdit = (call) => {
    setEditingCall(call);
    setFormData({
      title: call.title,
      description: call.description || '',
      customer_id: call.customer_id || '',
      assigned_to: call.assigned_to || '',
      status: call.status,
      priority: call.priority,
      due_date: call.due_date ? call.due_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleComplete = async (id) => {
    try {
      await axios.post(`/api/servicecalls/${id}/complete`);
      loadServiceCalls();
    } catch (error) {
      console.error('Error completing service call:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this service call?')) {
      try {
        await axios.delete(`/api/servicecalls/${id}`);
        loadServiceCalls();
      } catch (error) {
        console.error('Error deleting service call:', error);
      }
    }
  };

  const resetForm = () => {
    setEditingCall(null);
    setFormData({
      title: '',
      description: '',
      customer_id: '',
      assigned_to: '',
      status: 'pending',
      priority: 'normal',
      due_date: ''
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      'in-progress': '#17a2b8',
      completed: '#28a745',
      cancelled: '#6c757d'
    };
    return colors[status] || '#6c757d';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#28a745',
      normal: '#17a2b8',
      high: '#ffc107',
      urgent: '#dc3545'
    };
    return colors[priority] || '#17a2b8';
  };

  if (loading) {
    return <div className="container"><div className="loading">Loading service calls...</div></div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>🔧 Service Calls</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Service Request
        </button>
      </div>

      <div className="service-calls-grid">
        {serviceCalls.length === 0 ? (
          <div className="empty-state">
            <p>No service calls found</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              Create First Service Request
            </button>
          </div>
        ) : (
          serviceCalls.map(call => (
            <div key={call.id} className="service-call-card">
              <div className="call-header">
                <h3>{call.title}</h3>
                <div className="call-badges">
                  <span className="badge" style={{ backgroundColor: getPriorityColor(call.priority) }}>
                    {call.priority}
                  </span>
                  <span className="badge" style={{ backgroundColor: getStatusColor(call.status) }}>
                    {call.status}
                  </span>
                </div>
              </div>

              <div className="call-details">
                {call.customer_name && (
                  <p><strong>Customer:</strong> {call.customer_name}</p>
                )}
                {call.assigned_to_name && (
                  <p><strong>Assigned to:</strong> {call.assigned_to_name}</p>
                )}
                {call.description && (
                  <p><strong>Description:</strong> {call.description}</p>
                )}
                {call.due_date && (
                  <p><strong>Due:</strong> {new Date(call.due_date).toLocaleDateString()}</p>
                )}
              </div>

              <div className="call-actions">
                <button 
                  className="btn btn-sm btn-primary"
                  onClick={() => navigate(`/servicecalls/${call.id}`)}
                >
                  View Details
                </button>
                
                {userType === 'admin' && (
                  <>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEdit(call)}
                    >
                      Edit
                    </button>
                    {call.status !== 'completed' && (
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => handleComplete(call.id)}
                      >
                        Complete
                      </button>
                    )}
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(call.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
                
                {userType === 'technician' && call.assigned_to === currentUser.id && (
                  <button 
                    className="btn btn-sm btn-success"
                    onClick={() => handleComplete(call.id)}
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCall ? 'Edit Service Call' : 'New Service Request'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              {userType === 'admin' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Customer</label>
                    <select
                      className="form-control"
                      value={formData.customer_id}
                      onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                    >
                      <option value="">Select Customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.contact_name} {customer.company_name ? `(${customer.company_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assign to Technician</label>
                    <select
                      className="form-control"
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                    >
                      <option value="">Unassigned</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-control"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.due_date}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCall ? 'Update' : 'Create'} Service Call
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServiceCalls;
