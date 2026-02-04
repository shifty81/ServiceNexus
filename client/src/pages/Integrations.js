import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Integrations.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Integrations() {
  const [integrations, setIntegrations] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [activeTab, setActiveTab] = useState('integrations');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('integration');
  const [newApiKey, setNewApiKey] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'quickbooks',
    url: '',
    events: [],
    permissions: []
  });
  const [testResult, setTestResult] = useState(null);

  const integrationTypes = [
    { value: 'quickbooks', label: 'QuickBooks', icon: '📊' },
    { value: 'salesforce', label: 'Salesforce', icon: '☁️' },
    { value: 'google', label: 'Google Workspace', icon: '🔍' },
    { value: 'procore', label: 'Procore', icon: '🏗️' },
    { value: 'microsoft365', label: 'Microsoft 365', icon: '📧' }
  ];

  const eventTypes = [
    'customer.created', 'customer.updated', 'customer.deleted',
    'invoice.created', 'invoice.updated', 'invoice.paid',
    'estimate.created', 'estimate.updated', 'estimate.accepted',
    'dispatch.created', 'dispatch.updated', 'dispatch.completed',
    'form.submitted', 'servicecall.created', 'servicecall.completed'
  ];

  const permissionTypes = [
    'customers:read', 'customers:write',
    'invoices:read', 'invoices:write',
    'estimates:read', 'estimates:write',
    'forms:read', 'forms:write',
    'dispatches:read', 'dispatches:write'
  ];

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (activeTab === 'integrations') {
        const response = await axios.get(`${API_BASE_URL}/integrations`, { headers });
        setIntegrations(response.data);
      } else if (activeTab === 'apikeys') {
        const response = await axios.get(`${API_BASE_URL}/apikeys`, { headers });
        setApiKeys(response.data);
      } else if (activeTab === 'webhooks') {
        const response = await axios.get(`${API_BASE_URL}/webhooks`, { headers });
        setWebhooks(response.data);
      }

      setError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (modalType === 'integration') {
        await axios.post(`${API_BASE_URL}/integrations`, formData, { headers });
      } else if (modalType === 'apikey') {
        const response = await axios.post(`${API_BASE_URL}/apikeys`, formData, { headers });
        setNewApiKey(response.data.key);
      } else if (modalType === 'webhook') {
        await axios.post(`${API_BASE_URL}/webhooks`, formData, { headers });
      }

      fetchData();
      if (modalType !== 'apikey') {
        setShowModal(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating:', error);
      setError('Failed to create. Please try again.');
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(`${API_BASE_URL}/${type}/${id}`, { headers });
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      setError('Failed to delete. Please try again.');
    }
  };

  const handleTest = async (id, type) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.post(`${API_BASE_URL}/${type}/${id}/test`, {}, { headers });
      setTestResult({
        success: response.data.success,
        message: response.data.success ? 'Test successful!' : `Test failed: ${response.data.message}`
      });
      
      // Auto-hide after 5 seconds
      setTimeout(() => setTestResult(null), 5000);
    } catch (error) {
      console.error('Error testing:', error);
      setTestResult({
        success: false,
        message: 'Test failed. Please check the configuration.'
      });
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleToggleActive = async (id, type, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Determine new status based on type and current status
      const isActive = currentStatus === 'active' || currentStatus === 1;
      const newStatus = type === 'integrations' 
        ? (isActive ? 'inactive' : 'active')
        : (isActive ? 0 : 1);

      await axios.put(`${API_BASE_URL}/${type}/${id}`, 
        { [type === 'integrations' ? 'status' : 'is_active']: newStatus },
        { headers }
      );
      fetchData();
    } catch (error) {
      console.error('Error toggling status:', error);
      setError('Failed to update status. Please try again.');
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setShowModal(true);
    resetForm();
  };

  const closeModal = () => {
    setShowModal(false);
    setNewApiKey(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'quickbooks',
      url: '',
      events: [],
      permissions: []
    });
  };

  const handleCheckboxChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }));
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { label: 'Active', class: 'badge-active' },
      inactive: { label: 'Inactive', class: 'badge-inactive' },
      healthy: { label: 'Healthy', class: 'badge-success' },
      error: { label: 'Error', class: 'badge-error' }
    };
    const statusInfo = statusMap[status] || { label: status, class: 'badge-default' };
    return <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  return (
    <div className="integrations-container">
      <div className="integrations-header">
        <h1>⚙️ Integrations</h1>
        <p>Manage external system integrations, API keys, and webhooks</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {testResult && (
        <div className={testResult.success ? 'success-message' : 'error-message'}>
          {testResult.message}
          <button onClick={() => setTestResult(null)}>✕</button>
        </div>
      )}

      <div className="tabs">
        <button 
          className={activeTab === 'integrations' ? 'active' : ''}
          onClick={() => setActiveTab('integrations')}
        >
          🔌 Integrations
        </button>
        <button 
          className={activeTab === 'apikeys' ? 'active' : ''}
          onClick={() => setActiveTab('apikeys')}
        >
          🔑 API Keys
        </button>
        <button 
          className={activeTab === 'webhooks' ? 'active' : ''}
          onClick={() => setActiveTab('webhooks')}
        >
          🪝 Webhooks
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'integrations' && (
          <div className="integrations-section">
            <div className="section-header">
              <h2>External Integrations</h2>
              <button className="btn-primary" onClick={() => openModal('integration')}>
                + Add Integration
              </button>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="integrations-grid">
                {integrations.map(integration => (
                  <div key={integration.id} className="integration-card">
                    <div className="integration-header">
                      <div>
                        <span className="integration-icon">
                          {integrationTypes.find(t => t.value === integration.type)?.icon || '🔌'}
                        </span>
                        <h3>{integration.name}</h3>
                      </div>
                      {getStatusBadge(integration.status)}
                    </div>
                    <p className="integration-type">
                      {integrationTypes.find(t => t.value === integration.type)?.label || integration.type}
                    </p>
                    {integration.last_sync && (
                      <p className="integration-sync">
                        Last sync: {new Date(integration.last_sync).toLocaleString()}
                      </p>
                    )}
                    {integration.sync_status && getStatusBadge(integration.sync_status)}
                    <div className="integration-actions">
                      <button onClick={() => handleTest(integration.id, 'integrations')} className="btn-secondary">
                        Test
                      </button>
                      <button 
                        onClick={() => handleToggleActive(integration.id, 'integrations', integration.status)}
                        className="btn-secondary"
                      >
                        {integration.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(integration.id, 'integrations')} className="btn-danger">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'apikeys' && (
          <div className="apikeys-section">
            <div className="section-header">
              <h2>API Keys</h2>
              <button className="btn-primary" onClick={() => openModal('apikey')}>
                + Generate API Key
              </button>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="apikeys-list">
                {apiKeys.map(apiKey => (
                  <div key={apiKey.id} className="apikey-card">
                    <div className="apikey-info">
                      <h3>{apiKey.name}</h3>
                      <code>{apiKey.key_prefix}</code>
                      <p className="apikey-permissions">
                        Permissions: {Array.isArray(apiKey.permissions) ? apiKey.permissions.join(', ') : 'None'}
                      </p>
                      {apiKey.last_used && (
                        <p className="apikey-used">Last used: {new Date(apiKey.last_used).toLocaleString()}</p>
                      )}
                      {apiKey.expires_at && (
                        <p className="apikey-expires">Expires: {new Date(apiKey.expires_at).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="apikey-actions">
                      <button 
                        onClick={() => handleToggleActive(apiKey.id, 'apikeys', apiKey.is_active)}
                        className="btn-secondary"
                      >
                        {apiKey.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(apiKey.id, 'apikeys')} className="btn-danger">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div className="webhooks-section">
            <div className="section-header">
              <h2>Webhooks</h2>
              <button className="btn-primary" onClick={() => openModal('webhook')}>
                + Add Webhook
              </button>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="webhooks-list">
                {webhooks.map(webhook => (
                  <div key={webhook.id} className="webhook-card">
                    <div className="webhook-info">
                      <h3>{webhook.name}</h3>
                      <p className="webhook-url">{webhook.url}</p>
                      <p className="webhook-events">
                        Events: {Array.isArray(webhook.events) ? webhook.events.join(', ') : 'None'}
                      </p>
                      {webhook.last_triggered && (
                        <p className="webhook-triggered">Last triggered: {new Date(webhook.last_triggered).toLocaleString()}</p>
                      )}
                      {getStatusBadge(webhook.is_active ? 'active' : 'inactive')}
                    </div>
                    <div className="webhook-actions">
                      <button onClick={() => handleTest(webhook.id, 'webhooks')} className="btn-secondary">
                        Test
                      </button>
                      <button 
                        onClick={() => handleToggleActive(webhook.id, 'webhooks', webhook.is_active)}
                        className="btn-secondary"
                      >
                        {webhook.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(webhook.id, 'webhooks')} className="btn-danger">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              {modalType === 'integration' && 'Add Integration'}
              {modalType === 'apikey' && 'Generate API Key'}
              {modalType === 'webhook' && 'Add Webhook'}
            </h2>

            {newApiKey ? (
              <div className="apikey-created">
                <p className="warning">⚠️ Save this API key now. You won't be able to see it again!</p>
                <code className="apikey-value">{newApiKey}</code>
                <button className="btn-primary" onClick={closeModal}>Done</button>
              </div>
            ) : (
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                {modalType === 'integration' && (
                  <div className="form-group">
                    <label>Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      required
                    >
                      {integrationTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {modalType === 'webhook' && (
                  <>
                    <div className="form-group">
                      <label>URL *</label>
                      <input
                        type="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://example.com/webhook"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Events *</label>
                      <div className="checkbox-group">
                        {eventTypes.map(event => (
                          <label key={event} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={formData.events.includes(event)}
                              onChange={() => handleCheckboxChange('events', event)}
                            />
                            {event}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {modalType === 'apikey' && (
                  <>
                    <div className="form-group">
                      <label>Permissions *</label>
                      <div className="checkbox-group">
                        {permissionTypes.map(permission => (
                          <label key={permission} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission)}
                              onChange={() => handleCheckboxChange('permissions', permission)}
                            />
                            {permission}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Expires In (days)</label>
                      <input
                        type="number"
                        onChange={(e) => setFormData({ ...formData, expiresIn: e.target.value })}
                        placeholder="Leave empty for no expiration"
                      />
                    </div>
                  </>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Integrations;
