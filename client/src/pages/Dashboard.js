import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

function Dashboard({ socket }) {
  const [stats, setStats] = useState({
    totalForms: 0,
    pendingDispatches: 0,
    inventoryItems: 0,
    recentSubmissions: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    if (socket) {
      socket.on('dispatch-changed', () => loadDashboardData());
      socket.on('inventory-changed', () => loadDashboardData());
    }

    return () => {
      if (socket) {
        socket.off('dispatch-changed');
        socket.off('inventory-changed');
      }
    };
  }, [socket]);

  const loadDashboardData = async () => {
    try {
      const [formsRes, dispatchRes, inventoryRes] = await Promise.all([
        axios.get('/api/forms'),
        axios.get('/api/dispatch'),
        axios.get('/api/inventory')
      ]);

      const pendingDispatches = dispatchRes.data.filter(d => d.status === 'pending').length;

      setStats({
        totalForms: formsRes.data.length,
        pendingDispatches,
        inventoryItems: inventoryRes.data.length,
        recentSubmissions: formsRes.data.length
      });

      // Create recent activity feed
      const activities = [];
      
      dispatchRes.data.slice(0, 5).forEach(dispatch => {
        activities.push({
          type: 'dispatch',
          title: dispatch.title,
          time: new Date(dispatch.created_at),
          status: dispatch.status,
          id: dispatch.id
        });
      });

      activities.sort((a, b) => b.time - a.time);
      setRecentActivity(activities.slice(0, 10));
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div className="dashboard">
      <div className="container">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p>Welcome to FieldForge - AI-Powered Mobile Forms</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalForms}</div>
              <div className="stat-label">Total Forms</div>
            </div>
            <Link to="/forms" className="stat-link">View All →</Link>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🚀</div>
            <div className="stat-content">
              <div className="stat-value">{stats.pendingDispatches}</div>
              <div className="stat-label">Pending Dispatches</div>
            </div>
            <Link to="/dispatch" className="stat-link">Manage →</Link>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <div className="stat-value">{stats.inventoryItems}</div>
              <div className="stat-label">Inventory Items</div>
            </div>
            <Link to="/inventory" className="stat-link">Track →</Link>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-value">{stats.recentSubmissions}</div>
              <div className="stat-label">Form Submissions</div>
            </div>
            <Link to="/reports" className="stat-link">Reports →</Link>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section">
            <div className="card">
              <div className="card-header">Quick Actions</div>
              <div className="quick-actions">
                <Link to="/forms/new" className="action-button">
                  <span className="action-icon">➕</span>
                  <span>Create Form</span>
                </Link>
                <Link to="/ai-upload" className="action-button">
                  <span className="action-icon">✨</span>
                  <span>AI Upload (PDF/Word)</span>
                </Link>
                <Link to="/dispatch" className="action-button">
                  <span className="action-icon">📍</span>
                  <span>New Dispatch</span>
                </Link>
                <Link to="/inventory" className="action-button">
                  <span className="action-icon">📊</span>
                  <span>Update Inventory</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="dashboard-section">
            <div className="card">
              <div className="card-header">Recent Activity</div>
              <div className="activity-list">
                {recentActivity.length === 0 ? (
                  <p className="text-muted">No recent activity</p>
                ) : (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-icon">
                        {activity.type === 'dispatch' ? '🚀' : '📋'}
                      </div>
                      <div className="activity-content">
                        <div className="activity-title">{activity.title}</div>
                        <div className="activity-time">
                          {formatTimeAgo(activity.time)}
                        </div>
                      </div>
                      {activity.status && (
                        <span className={`badge badge-${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="features-showcase">
          <div className="card">
            <div className="card-header">FieldForge 2026 Features</div>
            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-icon">🤖</div>
                <h3>AI-Powered Form Creation</h3>
                <p>Upload PDFs or Word docs and instantly digitize them into functional forms</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📱</div>
                <h3>Mobile-First Design</h3>
                <p>Works seamlessly on any device with offline support and auto-sync</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">✍️</div>
                <h3>eSignatures (UETA/ESIGN)</h3>
                <p>Collect legally binding electronic signatures on any device</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📷</div>
                <h3>Advanced Capture</h3>
                <p>OCR, barcode scanning, GPS, photos, sketches, and more</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <h3>Smart Automation</h3>
                <p>Conditional logic, calculations, workflows, and integrations</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔒</div>
                <h3>Enterprise Security</h3>
                <p>SOC 2 Type 2, HIPAA compliance, SSO, and granular permissions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getStatusColor(status) {
  const colors = {
    pending: 'warning',
    'in-progress': 'primary',
    completed: 'success',
    cancelled: 'danger'
  };
  return colors[status] || 'primary';
}

export default Dashboard;
