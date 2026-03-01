import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getStatusColor, getPriorityIcon } from '../utils/formatters';
import './Dispatch.css';

function Dispatch({ socket }) {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    latitude: '',
    longitude: '',
    assigned_to: '',
    status: 'pending',
    priority: 'normal',
    due_date: ''
  });

  useEffect(() => {
    loadDispatches();

    if (socket) {
      socket.on('dispatch-changed', () => {
        loadDispatches();
      });
    }

    return () => {
      if (socket) socket.off('dispatch-changed');
    };
  }, [socket]);

  const loadDispatches = async () => {
    try {
      const response = await axios.get('/api/dispatch');
      setDispatches(response.data);
    } catch (error) {
      console.error('Error loading dispatches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDispatch) {
        await axios.put(`/api/dispatch/${editingDispatch.id}`, formData);
      } else {
        await axios.post('/api/dispatch', formData);
      }
      setShowModal(false);
      resetForm();
      loadDispatches();
    } catch (error) {
      console.error('Error saving dispatch:', error);
      alert('Failed to save dispatch');
    }
  };

  const handleEdit = (dispatch) => {
    setEditingDispatch(dispatch);
    setFormData({
      title: dispatch.title,
      description: dispatch.description || '',
      address: dispatch.address,
      latitude: dispatch.latitude || '',
      longitude: dispatch.longitude || '',
      assigned_to: dispatch.assigned_to || '',
      status: dispatch.status,
      priority: dispatch.priority,
      due_date: dispatch.due_date ? dispatch.due_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleComplete = async (id) => {
    try {
      await axios.post(`/api/dispatch/${id}/complete`);
      loadDispatches();
    } catch (error) {
      console.error('Error completing dispatch:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this dispatch?')) {
      try {
        await axios.delete(`/api/dispatch/${id}`);
        loadDispatches();
      } catch (error) {
        console.error('Error deleting dispatch:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      address: '',
      latitude: '',
      longitude: '',
      assigned_to: '',
      status: 'pending',
      priority: 'normal',
      due_date: ''
    });
    setEditingDispatch(null);
  };

  const openInMaps = (address) => {
    // Detect device and open appropriate map app
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const encodedAddress = encodeURIComponent(address);
    
    if (isMobile) {
      // Try to open in native maps app
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const url = isIOS 
        ? `maps://maps.apple.com/?q=${encodedAddress}`
        : `geo:0,0?q=${encodedAddress}`;
      
      window.location.href = url;
      
      // Fallback to Google Maps
      setTimeout(() => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
      }, 500);
    } else {
      // Desktop - open Google Maps
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="dispatch-page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>📍 Dispatch Management</h1>
            <p>Real-time dispatching with GPS navigation</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            + New Dispatch
          </button>
        </div>

        <div className="dispatch-stats">
          <div className="stat-box">
            <div className="stat-value">{dispatches.filter(d => d.status === 'pending').length}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{dispatches.filter(d => d.status === 'in-progress').length}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{dispatches.filter(d => d.status === 'completed').length}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{dispatches.length}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>

        <div className="dispatches-grid">
          {dispatches.length === 0 ? (
            <div className="card text-center" style={{ padding: '3rem' }}>
              <p style={{ color: '#64748b' }}>No dispatches yet. Create your first dispatch!</p>
            </div>
          ) : (
            dispatches.map(dispatch => (
              <div key={dispatch.id} className="dispatch-card card">
                <div className="dispatch-header">
                  <div className="dispatch-priority">
                    {getPriorityIcon(dispatch.priority)}
                  </div>
                  <span className={`badge badge-${getStatusColor(dispatch.status)}`}>
                    {dispatch.status}
                  </span>
                </div>

                <h3 className="dispatch-title">{dispatch.title}</h3>
                
                {dispatch.description && (
                  <p className="dispatch-description">{dispatch.description}</p>
                )}

                <div className="dispatch-address">
                  <span className="address-icon">📍</span>
                  <span className="address-text">{dispatch.address}</span>
                  <button
                    className="map-button"
                    onClick={() => openInMaps(dispatch.address)}
                    title="Open in maps"
                  >
                    🗺️
                  </button>
                </div>

                {dispatch.due_date && (
                  <div className="dispatch-date">
                    📅 Due: {new Date(dispatch.due_date).toLocaleDateString()}
                  </div>
                )}

                <div className="dispatch-actions">
                  {dispatch.status !== 'completed' && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleComplete(dispatch.id)}
                    >
                      ✓ Complete
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdit(dispatch)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(dispatch.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingDispatch ? 'Edit Dispatch' : 'New Dispatch'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    placeholder="Enter address for GPS navigation"
                  />
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingDispatch ? 'Update' : 'Create'} Dispatch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dispatch;
