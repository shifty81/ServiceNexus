import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SystemAdmin.css';

function SystemAdmin({ socket }) {
  const [activeTab, setActiveTab] = useState('health');
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadTabData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!socket) return;
    function onUserUpdated() { if (activeTab === 'users') loadUsers(); }
    function onUserDeleted() { if (activeTab === 'users') loadUsers(); }
    socket.on('user-updated', onUserUpdated);
    socket.on('user-deleted', onUserDeleted);
    return () => {
      socket.off('user-updated', onUserUpdated);
      socket.off('user-deleted', onUserDeleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, activeTab]);

  function showNotification(message, type) {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }

  function loadTabData(tab) {
    setLoading(true);
    if (tab === 'health') loadHealth();
    else if (tab === 'users') loadUsers();
    else if (tab === 'stats') loadStats();
    else if (tab === 'config') loadConfig();
    else if (tab === 'branding') loadBranding();
  }

  function loadHealth() {
    axios.get('/api/admin/health')
      .then(res => { setHealth(res.data); setLoading(false); })
      .catch(() => { setLoading(false); showNotification('Failed to load health data', 'error'); });
  }

  function loadUsers() {
    axios.get('/api/admin/users')
      .then(res => { setUsers(res.data); setLoading(false); })
      .catch(() => { setLoading(false); showNotification('Failed to load users', 'error'); });
  }

  function loadStats() {
    axios.get('/api/admin/stats')
      .then(res => { setStats(res.data); setLoading(false); })
      .catch(() => { setLoading(false); showNotification('Failed to load stats', 'error'); });
  }

  function loadConfig() {
    axios.get('/api/admin/config')
      .then(res => { setConfig(res.data); setLoading(false); })
      .catch(() => { setLoading(false); showNotification('Failed to load config', 'error'); });
  }

  function loadBranding() {
    axios.get('/api/admin/settings')
      .then(res => { setBranding(res.data); setLoading(false); })
      .catch(() => { setLoading(false); showNotification('Failed to load branding', 'error'); });
  }

  function saveBranding() {
    axios.put('/api/admin/settings', branding)
      .then(res => {
        setBranding(res.data);
        showNotification('Branding saved successfully', 'success');
      })
      .catch(() => showNotification('Failed to save branding', 'error'));
  }

  function updateUserRole(userId, role, userType) {
    axios.put(`/api/admin/users/${userId}`, { role, user_type: userType })
      .then(() => {
        showNotification('User updated', 'success');
        loadUsers();
      })
      .catch(() => showNotification('Failed to update user', 'error'));
  }

  function deleteUser(userId, username) {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    axios.delete(`/api/admin/users/${userId}`)
      .then(() => {
        showNotification('User deleted', 'success');
        loadUsers();
      })
      .catch(() => showNotification('Failed to delete user', 'error'));
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  }

  return (
    <div className="sysadmin-page">
      <div className="container">
        <div className="page-header">
          <h1>🖥️ System Administration</h1>
          <p className="subtitle">Remote management and monitoring dashboard</p>
        </div>

        {notification && (
          <div className={`notification notification-${notification.type}`}>
            {notification.message}
          </div>
        )}

        <div className="tabs">
          {['health', 'users', 'stats', 'config', 'branding'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'health' && '❤️ Health'}
              {tab === 'users' && '👥 Users'}
              {tab === 'stats' && '📊 Database'}
              {tab === 'config' && '⚙️ Config'}
              {tab === 'branding' && '🎨 Branding'}
            </button>
          ))}
        </div>

        {loading && <div className="spinner"></div>}

        {/* Health Tab */}
        {!loading && activeTab === 'health' && health && (
          <div className="tab-content">
            <div className="health-grid">
              <div className={`health-card ${health.status === 'healthy' ? 'healthy' : 'unhealthy'}`}>
                <div className="health-icon">{health.status === 'healthy' ? '🟢' : '🔴'}</div>
                <div className="health-label">System Status</div>
                <div className="health-value">{health.status}</div>
              </div>
              <div className="health-card">
                <div className="health-icon">⏱️</div>
                <div className="health-label">Uptime</div>
                <div className="health-value">{formatUptime(health.uptime)}</div>
              </div>
              <div className="health-card">
                <div className="health-icon">💾</div>
                <div className="health-label">Database</div>
                <div className="health-value">{health.database}</div>
              </div>
              <div className="health-card">
                <div className="health-icon">🌐</div>
                <div className="health-label">Environment</div>
                <div className="health-value">{health.environment}</div>
              </div>
            </div>

            <div className="info-card">
              <h3>System Information</h3>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-key">Node.js Version</span>
                  <span className="info-val">{health.nodeVersion}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Platform</span>
                  <span className="info-val">{health.platform}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Total Memory</span>
                  <span className="info-val">{formatBytes(health.memory?.total)}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Free Memory</span>
                  <span className="info-val">{formatBytes(health.memory?.free)}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Heap Used</span>
                  <span className="info-val">{formatBytes(health.memory?.usage?.heapUsed)}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Database Tables</span>
                  <span className="info-val">{health.tables?.length || 0}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Last Checked</span>
                  <span className="info-val">{new Date(health.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button className="btn btn-primary" onClick={loadHealth}>🔄 Refresh</button>
          </div>
        )}

        {/* Users Tab */}
        {!loading && activeTab === 'users' && (
          <div className="tab-content">
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Service Calls</th>
                    <th>Avg Rating</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan="8" className="empty-row">No users found</td></tr>
                  ) : users.map(user => (
                    <tr key={user.id}>
                      <td className="user-name">{user.username}</td>
                      <td>{user.email || '—'}</td>
                      <td>
                        <select
                          value={user.role}
                          onChange={e => updateUserRole(user.id, e.target.value, user.user_type)}
                          className="inline-select"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={user.user_type}
                          onChange={e => updateUserRole(user.id, user.role, e.target.value)}
                          className="inline-select"
                        >
                          <option value="admin">admin</option>
                          <option value="technician">technician</option>
                          <option value="client">client</option>
                        </select>
                      </td>
                      <td>{user.serviceCallCount || 0}</td>
                      <td>{user.averageRating ? `⭐ ${user.averageRating}` : '—'}</td>
                      <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => deleteUser(user.id, user.username)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Database Stats Tab */}
        {!loading && activeTab === 'stats' && stats && (
          <div className="tab-content">
            <div className="stats-summary">
              <span className="stats-total">Total Records: <strong>{stats.totalRecords?.toLocaleString()}</strong></span>
              <span className="stats-time">As of {new Date(stats.timestamp).toLocaleString()}</span>
            </div>
            <div className="stats-grid">
              {Object.entries(stats.tableCounts || {}).map(([table, count]) => (
                <div key={table} className="stats-card">
                  <span className="stats-card-count">{count}</span>
                  <span className="stats-card-label">{table.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={loadStats}>🔄 Refresh</button>
          </div>
        )}

        {/* Config Tab */}
        {!loading && activeTab === 'config' && config && (
          <div className="tab-content">
            <div className="info-card">
              <h3>Server Configuration</h3>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-key">App Version</span>
                  <span className="info-val">{config.version}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Environment</span>
                  <span className="info-val">
                    <span className={`env-badge env-${config.nodeEnv}`}>{config.nodeEnv}</span>
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-key">Port</span>
                  <span className="info-val">{config.port}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">CORS Origin</span>
                  <span className="info-val">{config.corsOrigin}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Trust Proxy</span>
                  <span className="info-val">{config.trustProxy ? 'Yes' : 'No'}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Rate Limit Window</span>
                  <span className="info-val">{(config.rateLimitWindow / 60000).toFixed(0)} minutes</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Rate Limit Max Requests</span>
                  <span className="info-val">{config.rateLimitMax}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branding / White-Label Tab */}
        {!loading && activeTab === 'branding' && branding && (
          <div className="tab-content">
            <div className="info-card">
              <h3>🏷️ Brand Identity</h3>
              <div className="branding-form">
                <div className="form-group">
                  <label className="form-label">Brand Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={branding.brandName || ''}
                    onChange={e => setBranding({ ...branding, brandName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tagline</label>
                  <input
                    type="text"
                    className="form-control"
                    value={branding.brandTagline || ''}
                    onChange={e => setBranding({ ...branding, brandTagline: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Logo URL</label>
                  <input
                    type="text"
                    className="form-control"
                    value={branding.brandLogo || ''}
                    onChange={e => setBranding({ ...branding, brandLogo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
            </div>

            <div className="info-card">
              <h3>🎨 Theme Colors</h3>
              <div className="branding-form color-grid">
                <div className="form-group color-input-group">
                  <label className="form-label">Primary Color</label>
                  <div className="color-row">
                    <input
                      type="color"
                      value={branding.primaryColor || '#2563eb'}
                      onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-control"
                      value={branding.primaryColor || '#2563eb'}
                      onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group color-input-group">
                  <label className="form-label">Secondary Color</label>
                  <div className="color-row">
                    <input
                      type="color"
                      value={branding.secondaryColor || '#1e40af'}
                      onChange={e => setBranding({ ...branding, secondaryColor: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-control"
                      value={branding.secondaryColor || '#1e40af'}
                      onChange={e => setBranding({ ...branding, secondaryColor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group color-input-group">
                  <label className="form-label">Accent Color</label>
                  <div className="color-row">
                    <input
                      type="color"
                      value={branding.accentColor || '#3b82f6'}
                      onChange={e => setBranding({ ...branding, accentColor: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-control"
                      value={branding.accentColor || '#3b82f6'}
                      onChange={e => setBranding({ ...branding, accentColor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group color-input-group">
                  <label className="form-label">Navbar Background</label>
                  <div className="color-row">
                    <input
                      type="color"
                      value={branding.navbarBg || '#1e293b'}
                      onChange={e => setBranding({ ...branding, navbarBg: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-control"
                      value={branding.navbarBg || '#1e293b'}
                      onChange={e => setBranding({ ...branding, navbarBg: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group color-input-group">
                  <label className="form-label">Navbar Text</label>
                  <div className="color-row">
                    <input
                      type="color"
                      value={branding.navbarText || '#ffffff'}
                      onChange={e => setBranding({ ...branding, navbarText: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-control"
                      value={branding.navbarText || '#ffffff'}
                      onChange={e => setBranding({ ...branding, navbarText: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="branding-preview">
              <h3>Preview</h3>
              <div
                className="preview-navbar"
                style={{
                  background: branding.navbarBg || '#1e293b',
                  color: branding.navbarText || '#ffffff',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>⚡</span>
                <strong>{branding.brandName || 'ServiceNexus'}</strong>
                <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: '0.85rem' }}>
                  Dashboard &nbsp; Forms &nbsp; Dispatch
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ background: branding.primaryColor || '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px' }}>
                  Primary
                </button>
                <button style={{ background: branding.secondaryColor || '#1e40af', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px' }}>
                  Secondary
                </button>
                <button style={{ background: branding.accentColor || '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px' }}>
                  Accent
                </button>
              </div>
            </div>

            <button className="btn btn-primary" onClick={saveBranding}>💾 Save Branding</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SystemAdmin;
