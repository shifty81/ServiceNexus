import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './TechPortal.css';

function TechPortal({ socket }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    loadPortalData();

    if (socket) {
      socket.on('service-call-changed', () => loadPortalData());
      socket.on('dispatch-changed', () => loadPortalData());
    }

    return () => {
      if (socket) {
        socket.off('service-call-changed');
        socket.off('dispatch-changed');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const loadPortalData = async () => {
    try {
      const response = await axios.get(`/api/portal/technician/${currentUser.id}`);
      setData(response.data);
    } catch (error) {
      console.error('Error loading portal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartJob = async (callId) => {
    try {
      await axios.put(`/api/servicecalls/${callId}`, { status: 'in-progress' });
      loadPortalData();
    } catch (error) {
      console.error('Error starting job:', error);
    }
  };

  const handleCompleteJob = async (callId) => {
    try {
      await axios.post(`/api/servicecalls/${callId}/complete`);
      loadPortalData();
    } catch (error) {
      console.error('Error completing job:', error);
    }
  };

  const handleClockIn = async () => {
    try {
      await axios.post('/api/timetracking', {
        user_id: currentUser.id,
        clock_in: new Date().toISOString()
      });
      loadPortalData();
    } catch (error) {
      console.error('Error clocking in:', error);
    }
  };

  const handleClockOut = async () => {
    if (data?.activeTimeEntry) {
      try {
        await axios.put(`/api/timetracking/${data.activeTimeEntry.id}`, {
          clock_out: new Date().toISOString()
        });
        loadPortalData();
      } catch (error) {
        console.error('Error clocking out:', error);
      }
    }
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

  const openMap = (address) => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?q=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  const stats = data?.stats || {};
  const activeJobs = (data?.assignedCalls || []).filter(c => c.status !== 'completed' && c.status !== 'cancelled');

  return (
    <div className="tech-portal">
      <div className="container">
        <div className="portal-header">
          <h1>🔧 {currentUser?.username}</h1>
          <p>Technician Dashboard — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="tech-stats">
          <div className="tech-stat-card tech-stat-active">
            <div className="tech-stat-value">{stats.activeJobs || 0}</div>
            <div className="tech-stat-label">Active</div>
          </div>
          <div className="tech-stat-card tech-stat-pending">
            <div className="tech-stat-value">{stats.pendingJobs || 0}</div>
            <div className="tech-stat-label">Pending</div>
          </div>
          <div className="tech-stat-card tech-stat-done">
            <div className="tech-stat-value">{stats.completedToday || 0}</div>
            <div className="tech-stat-label">Done Today</div>
          </div>
          <div className="tech-stat-card tech-stat-hours">
            <div className="tech-stat-value">{stats.todayHours || 0}h</div>
            <div className="tech-stat-label">Hours</div>
          </div>
        </div>

        <div className="tech-clock-section">
          {stats.isClockedIn ? (
            <button className="tech-clock-btn tech-clock-out" onClick={handleClockOut}>
              <span className="tech-clock-icon">⏱️</span>
              <span>Clock Out</span>
            </button>
          ) : (
            <button className="tech-clock-btn tech-clock-in" onClick={handleClockIn}>
              <span className="tech-clock-icon">⏱️</span>
              <span>Clock In</span>
            </button>
          )}
        </div>

        <div className="tech-quick-actions">
          <Link to="/servicecalls" className="tech-action-btn">
            <span className="tech-action-icon">📋</span>
            <span>All Jobs</span>
          </Link>
          <Link to="/inventory" className="tech-action-btn">
            <span className="tech-action-icon">📦</span>
            <span>Inventory</span>
          </Link>
          <Link to="/purchaseorders" className="tech-action-btn">
            <span className="tech-action-icon">📄</span>
            <span>POs</span>
          </Link>
          <Link to="/timetracking" className="tech-action-btn">
            <span className="tech-action-icon">⏰</span>
            <span>Time</span>
          </Link>
        </div>

        <div className="tech-jobs-section">
          <h2>📍 My Assigned Jobs</h2>
          <div className="tech-jobs-list">
            {activeJobs.length === 0 ? (
              <div className="tech-empty">
                <p>No active jobs assigned to you</p>
              </div>
            ) : (
              activeJobs.map(call => (
                <div key={call.id} className="tech-job-card">
                  <div className="tech-job-header">
                    <div className="tech-job-priority" style={{ backgroundColor: getPriorityColor(call.priority) }}>
                      {call.priority}
                    </div>
                    <div className="tech-job-status" style={{ backgroundColor: getStatusColor(call.status) }}>
                      {call.status}
                    </div>
                  </div>
                  <h3 className="tech-job-title">{call.title}</h3>
                  {call.customer_name && (
                    <div className="tech-job-customer">
                      <span>👤 {call.customer_name}</span>
                      {call.customer_phone && (
                        <a href={`tel:${call.customer_phone}`} className="tech-job-phone">📞 {call.customer_phone}</a>
                      )}
                    </div>
                  )}
                  {call.customer_address && (
                    <button className="tech-job-address" onClick={() => openMap(call.customer_address)}>
                      📍 {call.customer_address} →
                    </button>
                  )}
                  {call.description && (
                    <p className="tech-job-description">{call.description}</p>
                  )}
                  {call.due_date && (
                    <div className="tech-job-due">Due: {new Date(call.due_date).toLocaleDateString()}</div>
                  )}
                  <div className="tech-job-actions">
                    <button
                      className="tech-btn tech-btn-view"
                      onClick={() => navigate(`/servicecalls/${call.id}`)}
                    >
                      View Details
                    </button>
                    {call.status === 'pending' && (
                      <button
                        className="tech-btn tech-btn-start"
                        onClick={() => handleStartJob(call.id)}
                      >
                        ▶️ Start Job
                      </button>
                    )}
                    {call.status === 'in-progress' && (
                      <button
                        className="tech-btn tech-btn-complete"
                        onClick={() => handleCompleteJob(call.id)}
                      >
                        ✅ Complete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {data?.dispatches && data.dispatches.length > 0 && (
          <div className="tech-section">
            <h2>🚀 Dispatches</h2>
            <div className="tech-dispatch-list">
              {data.dispatches.filter(d => d.status !== 'completed').map(dispatch => (
                <div key={dispatch.id} className="tech-dispatch-card">
                  <div className="tech-dispatch-title">{dispatch.title}</div>
                  {dispatch.address && (
                    <button className="tech-job-address" onClick={() => openMap(dispatch.address)}>
                      📍 {dispatch.address} →
                    </button>
                  )}
                  <div className="tech-dispatch-meta">
                    <span className="tech-dispatch-status" style={{ backgroundColor: getStatusColor(dispatch.status) }}>
                      {dispatch.status}
                    </span>
                    {dispatch.due_date && <span>Due: {new Date(dispatch.due_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <nav className="mobile-bottom-nav">
        <Link to="/" className="mobile-nav-item active">
          <span className="mobile-nav-icon">🏠</span>
          <span className="mobile-nav-label">Home</span>
        </Link>
        <Link to="/servicecalls" className="mobile-nav-item">
          <span className="mobile-nav-icon">📋</span>
          <span className="mobile-nav-label">Jobs</span>
        </Link>
        <Link to="/inventory" className="mobile-nav-item">
          <span className="mobile-nav-icon">📦</span>
          <span className="mobile-nav-label">Parts</span>
        </Link>
        <Link to="/timetracking" className="mobile-nav-item">
          <span className="mobile-nav-icon">⏰</span>
          <span className="mobile-nav-label">Time</span>
        </Link>
        <Link to="/purchaseorders" className="mobile-nav-item">
          <span className="mobile-nav-icon">📄</span>
          <span className="mobile-nav-label">POs</span>
        </Link>
      </nav>
    </div>
  );
}

export default TechPortal;
