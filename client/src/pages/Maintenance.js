import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Maintenance.css';

function Maintenance({ socket }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Dashboard state
  const [dashboard, setDashboard] = useState(null);

  // Alerts state
  const [alerts, setAlerts] = useState([]);
  const [alertFilter, setAlertFilter] = useState('active');

  // Schedules state
  const [schedules, setSchedules] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formData, setFormData] = useState({
    equipment_id: '',
    schedule_type: 'preventive',
    frequency_days: 30,
    last_service_date: '',
    description: ''
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/maintenance/dashboard');
      setDashboard(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/maintenance/alerts');
      setAlerts(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load alerts');
      console.error('Error loading alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/maintenance/schedules');
      setSchedules(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load schedules');
      console.error('Error loading schedules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboard();
    else if (activeTab === 'alerts') loadAlerts();
    else if (activeTab === 'schedules') loadSchedules();
  }, [activeTab, loadDashboard, loadAlerts, loadSchedules]);

  useEffect(() => {
    if (socket) {
      socket.on('maintenance-changed', () => {
        if (activeTab === 'dashboard') loadDashboard();
        else if (activeTab === 'alerts') loadAlerts();
        else if (activeTab === 'schedules') loadSchedules();
      });
    }

    return () => {
      if (socket) socket.off('maintenance-changed');
    };
  }, [socket, activeTab, loadDashboard, loadAlerts, loadSchedules]);

  const handleGenerateAlerts = async () => {
    try {
      await axios.post('/api/maintenance/generate-alerts');
      showToast('Alerts generated successfully');
      loadDashboard();
    } catch (err) {
      showToast('Failed to generate alerts', 'error');
      console.error('Error generating alerts:', err);
    }
  };

  const handleAlertAction = async (id, status) => {
    try {
      await axios.put(`/api/maintenance/alerts/${id}`, { status });
      showToast(`Alert ${status} successfully`);
      loadAlerts();
    } catch (err) {
      showToast('Failed to update alert', 'error');
      console.error('Error updating alert:', err);
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSchedule) {
        await axios.put(`/api/maintenance/schedules/${editingSchedule.id}`, formData);
        showToast('Schedule updated successfully');
      } else {
        await axios.post('/api/maintenance/schedules', formData);
        showToast('Schedule created successfully');
      }
      setShowModal(false);
      resetForm();
      loadSchedules();
    } catch (err) {
      showToast('Failed to save schedule', 'error');
      console.error('Error saving schedule:', err);
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      equipment_id: schedule.equipment_id || '',
      schedule_type: schedule.schedule_type || 'preventive',
      frequency_days: schedule.frequency_days || 30,
      last_service_date: schedule.last_service_date ? schedule.last_service_date.split('T')[0] : '',
      description: schedule.description || ''
    });
    setShowModal(true);
  };

  const handleDeleteSchedule = async (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await axios.delete(`/api/maintenance/schedules/${id}`);
        showToast('Schedule deleted successfully');
        loadSchedules();
      } catch (err) {
        showToast('Failed to delete schedule', 'error');
        console.error('Error deleting schedule:', err);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      equipment_id: '',
      schedule_type: 'preventive',
      frequency_days: 30,
      last_service_date: '',
      description: ''
    });
    setEditingSchedule(null);
  };

  const filteredAlerts = alerts.filter(alert => {
    if (alertFilter === 'all') return true;
    return alert.status === alertFilter;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading && !dashboard && alerts.length === 0 && schedules.length === 0) {
    return <div className="spinner"></div>;
  }

  return (
    <div className="maintenance-page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>🔧 Predictive Maintenance</h1>
            <p>Equipment maintenance tracking and predictive alerts</p>
          </div>
        </div>

        {toast && (
          <div className={`maintenance-toast maintenance-toast-${toast.type}`}>
            {toast.message}
          </div>
        )}

        {error && (
          <div className="maintenance-error">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="maintenance-tabs">
          <button
            className={`maintenance-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`maintenance-tab ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            🔔 Alerts
          </button>
          <button
            className={`maintenance-tab ${activeTab === 'schedules' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedules')}
          >
            📅 Schedules
          </button>
        </div>

        {activeTab === 'dashboard' && dashboard && (
          <div className="maintenance-dashboard">
            <div className="maintenance-kpi-grid">
              <div className="maintenance-kpi-card kpi-blue">
                <div className="kpi-value">{dashboard.totalEquipment}</div>
                <div className="kpi-label">Total Equipment</div>
              </div>
              <div className="maintenance-kpi-card kpi-green">
                <div className="kpi-value">{dashboard.activeSchedules}</div>
                <div className="kpi-label">Active Schedules</div>
              </div>
              <div className="maintenance-kpi-card kpi-amber">
                <div className="kpi-value">{dashboard.alerts?.upcoming || 0}</div>
                <div className="kpi-label">Upcoming Alerts</div>
              </div>
              <div className="maintenance-kpi-card kpi-red">
                <div className="kpi-value">{dashboard.alerts?.overdue || 0}</div>
                <div className="kpi-label">Overdue Alerts</div>
              </div>
            </div>

            <div className="maintenance-actions-bar">
              <button className="btn btn-primary" onClick={handleGenerateAlerts}>
                ⚡ Generate Alerts
              </button>
            </div>

            {dashboard.equipmentNeedingAttention && dashboard.equipmentNeedingAttention.length > 0 && (
              <div className="maintenance-attention-section">
                <h3>Equipment Needing Attention</h3>
                <div className="maintenance-attention-list">
                  {dashboard.equipmentNeedingAttention.map((item, index) => (
                    <div key={item.id || index} className="maintenance-attention-card">
                      <div className="attention-name">{item.equipment_name || item.name}</div>
                      <div className="attention-detail">{item.reason || item.description || 'Maintenance required'}</div>
                      {item.next_service_date && (
                        <div className="attention-date">Due: {formatDate(item.next_service_date)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="maintenance-alerts">
            <div className="maintenance-filter-bar">
              <select
                className="form-control"
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="all">All</option>
              </select>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="maintenance-empty">No alerts found.</div>
            ) : (
              <div className="maintenance-alert-list">
                {filteredAlerts.map(alert => (
                  <div key={alert.id} className={`maintenance-alert-card severity-${alert.severity || 'low'}`}>
                    <div className="alert-header">
                      <h4 className="alert-title">{alert.title}</h4>
                      <div className="alert-badges">
                        <span className={`alert-type-badge type-${alert.alert_type}`}>
                          {alert.alert_type}
                        </span>
                        {alert.severity && (
                          <span className={`alert-severity-badge severity-badge-${alert.severity}`}>
                            {alert.severity}
                          </span>
                        )}
                      </div>
                    </div>
                    {alert.description && <p className="alert-description">{alert.description}</p>}
                    <div className="alert-meta">
                      {alert.equipment_name && <span>📍 {alert.equipment_name}</span>}
                      {alert.due_date && <span>📅 {formatDate(alert.due_date)}</span>}
                    </div>
                    <div className="alert-actions">
                      {alert.status === 'active' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAlertAction(alert.id, 'acknowledged')}
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAlertAction(alert.id, 'resolved')}
                      >
                        Resolve
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleAlertAction(alert.id, 'dismissed')}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="maintenance-schedules">
            <div className="maintenance-actions-bar">
              <button
                className="btn btn-primary"
                onClick={() => { resetForm(); setShowModal(true); }}
              >
                + Add Schedule
              </button>
            </div>

            {schedules.length === 0 ? (
              <div className="maintenance-empty">No maintenance schedules yet. Add your first schedule!</div>
            ) : (
              <div className="maintenance-schedule-list">
                {schedules.map(schedule => (
                  <div key={schedule.id} className="maintenance-schedule-card">
                    <div className="schedule-header">
                      <h4 className="schedule-name">{schedule.equipment_name || `Equipment #${schedule.equipment_id}`}</h4>
                      <span className={`schedule-type-badge type-${schedule.schedule_type}`}>
                        {schedule.schedule_type}
                      </span>
                    </div>
                    <div className="schedule-details">
                      <div className="schedule-detail">
                        <span className="detail-label">Frequency</span>
                        <span className="detail-value">Every {schedule.frequency_days} days</span>
                      </div>
                      <div className="schedule-detail">
                        <span className="detail-label">Last Service</span>
                        <span className="detail-value">{formatDate(schedule.last_service_date)}</span>
                      </div>
                      <div className="schedule-detail">
                        <span className="detail-label">Next Service</span>
                        <span className="detail-value">{formatDate(schedule.next_service_date)}</span>
                      </div>
                      <div className="schedule-detail">
                        <span className="detail-label">Status</span>
                        <span className={`detail-value ${schedule.is_active ? 'text-active' : 'text-inactive'}`}>
                          {schedule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    {schedule.description && <p className="schedule-description">{schedule.description}</p>}
                    <div className="schedule-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEditSchedule(schedule)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingSchedule ? 'Edit Schedule' : 'New Schedule'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>

              <form onSubmit={handleScheduleSubmit}>
                <div className="form-group">
                  <label className="form-label">Equipment ID *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.equipment_id}
                    onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
                    placeholder="Enter equipment ID"
                    required
                  />
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="form-label">Schedule Type *</label>
                    <select
                      className="form-control"
                      value={formData.schedule_type}
                      onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
                      required
                    >
                      <option value="preventive">Preventive</option>
                      <option value="inspection">Inspection</option>
                      <option value="calibration">Calibration</option>
                      <option value="replacement">Replacement</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Frequency (days) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.frequency_days}
                      onChange={(e) => setFormData({ ...formData, frequency_days: parseInt(e.target.value) || 0 })}
                      required
                      min="1"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Last Service Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.last_service_date}
                    onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    placeholder="Describe the maintenance task"
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingSchedule ? 'Update' : 'Create'} Schedule
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

export default Maintenance;
