import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './CustomerPortal.css';

const STATUS_STEPS = [
  { key: 'pending', label: 'Submitted', icon: '📝' },
  { key: 'scheduled', label: 'Scheduled', icon: '📅' },
  { key: 'on-the-way', label: 'Tech En Route', icon: '🚗' },
  { key: 'in-progress', label: 'In Progress', icon: '🔧' },
  { key: 'completed', label: 'Completed', icon: '✅' }
];

function getStepIndex(status) {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

function CustomerPortal({ socket }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    loadPortalData();

    if (socket) {
      socket.on('service-call-changed', () => loadPortalData());
      socket.on('invoice:updated', () => loadPortalData());
    }

    return () => {
      if (socket) {
        socket.off('service-call-changed');
        socket.off('invoice:updated');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const loadPortalData = async () => {
    try {
      const response = await axios.get(`/api/portal/customer/${currentUser.id}`);
      setData(response.data);
    } catch (error) {
      console.error('Error loading portal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      scheduled: '#6366f1',
      'on-the-way': '#f97316',
      'in-progress': '#17a2b8',
      completed: '#28a745',
      cancelled: '#6c757d',
      draft: '#6c757d',
      paid: '#28a745',
      partial: '#ffc107',
      sent: '#17a2b8',
      accepted: '#28a745',
      declined: '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackModal || feedbackRating === 0) return;
    setSubmittingFeedback(true);
    try {
      await axios.post('/api/feedback', {
        service_call_id: feedbackModal.id,
        technician_id: feedbackModal.assigned_to,
        rating: feedbackRating,
        comment: feedbackComment,
        submitted_by: currentUser.id
      });
      setFeedbackModal(null);
      setFeedbackRating(0);
      setFeedbackComment('');
      loadPortalData();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const ratedIds = data?.ratedServiceCallIds || [];
  const completedUnrated = (data?.serviceCalls || []).filter(
    c => c.status === 'completed' && !ratedIds.includes(c.id)
  );

  if (loading) {
    return <div className="spinner"></div>;
  }

  const stats = data?.stats || {};
  const activeCall = (data?.serviceCalls || []).find(c =>
    c.status !== 'completed' && c.status !== 'cancelled'
  );

  return (
    <div className="customer-portal">
      <div className="container">
        <div className="portal-header">
          <h1>👋 Welcome, {currentUser?.username}</h1>
          <p>Your service portal — track requests, invoices, and equipment</p>
        </div>

        <div className="portal-stats">
          <div className="portal-stat-card">
            <div className="portal-stat-icon">🔧</div>
            <div className="portal-stat-value">{stats.activeRequests || 0}</div>
            <div className="portal-stat-label">Active Requests</div>
          </div>
          <div className="portal-stat-card">
            <div className="portal-stat-icon">✅</div>
            <div className="portal-stat-value">{stats.completedRequests || 0}</div>
            <div className="portal-stat-label">Completed</div>
          </div>
          <div className="portal-stat-card">
            <div className="portal-stat-icon">💰</div>
            <div className="portal-stat-value">{stats.pendingInvoices || 0}</div>
            <div className="portal-stat-label">Pending Invoices</div>
          </div>
          <div className="portal-stat-card">
            <div className="portal-stat-icon">⚙️</div>
            <div className="portal-stat-value">{stats.totalEquipment || 0}</div>
            <div className="portal-stat-label">Equipment</div>
          </div>
        </div>

        {stats.totalOwed > 0 && (
          <div className="portal-alert">
            <span className="portal-alert-icon">💳</span>
            <span>Outstanding balance: <strong>${stats.totalOwed.toFixed(2)}</strong></span>
          </div>
        )}

        {/* Live Job Status Tracker — inspired by ServiceTitan / Housecall Pro */}
        {activeCall && (
          <div className="portal-tracker">
            <div className="portal-tracker-header">
              <h2>📍 Live Job Tracker</h2>
              <Link to={`/servicecalls/${activeCall.id}`} className="portal-view-all">Details →</Link>
            </div>
            <div className="portal-tracker-title">{activeCall.title}</div>
            {activeCall.assigned_to_name && (
              <div className="portal-tracker-tech">Technician: <strong>{activeCall.assigned_to_name}</strong></div>
            )}
            <div className="status-tracker">
              {STATUS_STEPS.map((step, idx) => {
                const currentIdx = getStepIndex(activeCall.status);
                const isComplete = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <div key={step.key} className={`status-step ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''}`}>
                    <div className="status-step-dot">
                      {isComplete ? '✓' : step.icon}
                    </div>
                    <div className="status-step-label">{step.label}</div>
                    {idx < STATUS_STEPS.length - 1 && <div className={`status-step-line ${isComplete ? 'complete' : ''}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {completedUnrated.length > 0 && (
          <div className="portal-feedback-prompt">
            <h2>⭐ Rate Your Service</h2>
            <p>Let us know how we did!</p>
            <div className="portal-list">
              {completedUnrated.map(call => (
                <div key={call.id} className="portal-list-item portal-feedback-item">
                  <div className="portal-item-content">
                    <div className="portal-item-title">{call.title}</div>
                    {call.assigned_to_name && (
                      <div className="portal-item-meta"><span>Tech: {call.assigned_to_name}</span></div>
                    )}
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setFeedbackModal(call)}>
                    Rate ⭐
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {feedbackModal && (
          <div className="portal-modal-overlay" onClick={() => setFeedbackModal(null)}>
            <div className="portal-modal" onClick={e => e.stopPropagation()}>
              <h2>⭐ Rate Service</h2>
              <p className="portal-modal-subtitle">{feedbackModal.title}</p>
              <div className="star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`star-btn ${feedbackRating >= star ? 'active' : ''}`}
                    onClick={() => setFeedbackRating(star)}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                className="portal-feedback-textarea"
                placeholder="Tell us about your experience (optional)"
                value={feedbackComment}
                onChange={e => setFeedbackComment(e.target.value)}
                maxLength={1000}
                rows={3}
              />
              <div className="portal-modal-actions">
                <button className="btn btn-outline" onClick={() => { setFeedbackModal(null); setFeedbackRating(0); setFeedbackComment(''); }}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitFeedback}
                  disabled={feedbackRating === 0 || submittingFeedback}
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Rating'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="portal-quick-actions">
          <Link to="/servicecalls" className="portal-action-btn portal-action-primary">
            <span className="portal-action-icon">📝</span>
            <span>New Service Request</span>
          </Link>
          <Link to="/servicecalls" className="portal-action-btn">
            <span className="portal-action-icon">📋</span>
            <span>View All Requests</span>
          </Link>
        </div>

        <div className="portal-sections">
          <div className="portal-section">
            <div className="portal-section-header">
              <h2>🔧 Recent Service Requests</h2>
              <Link to="/servicecalls" className="portal-view-all">View All →</Link>
            </div>
            <div className="portal-list">
              {(!data?.serviceCalls || data.serviceCalls.length === 0) ? (
                <div className="portal-empty">
                  <p>No service requests yet</p>
                  <Link to="/servicecalls" className="btn btn-primary">Submit a Request</Link>
                </div>
              ) : (
                data.serviceCalls.map(call => (
                  <Link key={call.id} to={`/servicecalls/${call.id}`} className="portal-list-item">
                    <div className="portal-item-content">
                      <div className="portal-item-title">{call.title}</div>
                      <div className="portal-item-meta">
                        {call.assigned_to_name && <span>Tech: {call.assigned_to_name}</span>}
                        {call.due_date && <span>Due: {new Date(call.due_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <span className="portal-item-badge" style={{ backgroundColor: getStatusColor(call.status) }}>
                      {call.status}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="portal-section">
            <div className="portal-section-header">
              <h2>💰 Recent Invoices</h2>
            </div>
            <div className="portal-list">
              {(!data?.invoices || data.invoices.length === 0) ? (
                <div className="portal-empty">
                  <p>No invoices yet</p>
                </div>
              ) : (
                data.invoices.map(invoice => (
                  <div key={invoice.id} className="portal-list-item">
                    <div className="portal-item-content">
                      <div className="portal-item-title">{invoice.invoice_number} — {invoice.title}</div>
                      <div className="portal-item-meta">
                        <span>Total: ${(invoice.total || 0).toFixed(2)}</span>
                        <span>Paid: ${(invoice.amount_paid || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <span className="portal-item-badge" style={{ backgroundColor: getStatusColor(invoice.status) }}>
                      {invoice.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="portal-section">
            <div className="portal-section-header">
              <h2>📄 Estimates</h2>
            </div>
            <div className="portal-list">
              {(!data?.estimates || data.estimates.length === 0) ? (
                <div className="portal-empty">
                  <p>No estimates yet</p>
                </div>
              ) : (
                data.estimates.map(estimate => (
                  <div key={estimate.id} className="portal-list-item">
                    <div className="portal-item-content">
                      <div className="portal-item-title">{estimate.estimate_number} — {estimate.title}</div>
                      <div className="portal-item-meta">
                        <span>Total: ${(estimate.total || 0).toFixed(2)}</span>
                        {estimate.valid_until && <span>Valid until: {new Date(estimate.valid_until).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <span className="portal-item-badge" style={{ backgroundColor: getStatusColor(estimate.status) }}>
                      {estimate.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {data?.equipment && data.equipment.length > 0 && (
            <div className="portal-section">
              <div className="portal-section-header">
                <h2>⚙️ Your Equipment</h2>
              </div>
              <div className="portal-list">
                {data.equipment.map(equip => (
                  <div key={equip.id} className="portal-list-item">
                    <div className="portal-item-content">
                      <div className="portal-item-title">{equip.name}</div>
                      <div className="portal-item-meta">
                        {equip.serial_number && <span>S/N: {equip.serial_number}</span>}
                        {equip.model && <span>Model: {equip.model}</span>}
                        {equip.manufacturer && <span>{equip.manufacturer}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="mobile-bottom-nav">
        <Link to="/" className="mobile-nav-item active">
          <span className="mobile-nav-icon">🏠</span>
          <span className="mobile-nav-label">Home</span>
        </Link>
        <Link to="/servicecalls" className="mobile-nav-item">
          <span className="mobile-nav-icon">🔧</span>
          <span className="mobile-nav-label">Requests</span>
        </Link>
        <Link to="/servicecalls" className="mobile-nav-item mobile-nav-fab">
          <span className="mobile-nav-icon">➕</span>
          <span className="mobile-nav-label">New</span>
        </Link>
        <Link to="/invoices" className="mobile-nav-item">
          <span className="mobile-nav-icon">💰</span>
          <span className="mobile-nav-label">Invoices</span>
        </Link>
        <Link to="/estimates" className="mobile-nav-item">
          <span className="mobile-nav-icon">📄</span>
          <span className="mobile-nav-label">Estimates</span>
        </Link>
      </nav>
    </div>
  );
}

export default CustomerPortal;
