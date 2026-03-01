import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './CustomerPortal.css';

function CustomerPortal({ socket }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="spinner"></div>;
  }

  const stats = data?.stats || {};

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
