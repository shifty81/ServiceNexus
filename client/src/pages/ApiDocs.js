import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ApiDocs.css';

function ApiDocs() {
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [copied, setCopied] = useState(false);

  const apiBaseUrl = window.location.origin + '/api';

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/docs/endpoints');
      setGroups(response.data.groups || {});
      setError(null);
    } catch (err) {
      setError('Failed to load API documentation');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (category) => {
    setExpandedGroups(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const copyBaseUrl = () => {
    navigator.clipboard.writeText(apiBaseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMethodClass = (method) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'method-get';
      case 'POST': return 'method-post';
      case 'PUT': return 'method-put';
      case 'PATCH': return 'method-patch';
      case 'DELETE': return 'method-delete';
      default: return '';
    }
  };

  const term = search.toLowerCase();
  const filteredGroups = {};
  let filteredCount = 0;

  for (const [category, eps] of Object.entries(groups)) {
    const matched = eps.filter(ep => {
      if (!term) return true;
      return (
        (ep.method && ep.method.toLowerCase().includes(term)) ||
        (ep.path && ep.path.toLowerCase().includes(term)) ||
        (ep.summary && ep.summary.toLowerCase().includes(term)) ||
        category.toLowerCase().includes(term)
      );
    });
    if (matched.length > 0) {
      filteredGroups[category] = matched;
      filteredCount += matched.length;
    }
  }

  const categories = Object.keys(filteredGroups).sort();

  if (loading) {
    return (
      <div className="api-docs-page">
        <div className="container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading API documentation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="api-docs-page">
        <div className="container">
          <div className="error-state">
            <h2>⚠️ Error</h2>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={loadEndpoints}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-docs-page">
      <div className="container">
        <div className="page-header">
          <h1>API Documentation</h1>
          <p className="subtitle">Browse and explore the FieldForge REST API</p>
        </div>

        <div className="api-info-cards">
          <div className="info-card">
            <h3>Base URL</h3>
            <div className="base-url-row">
              <code>{apiBaseUrl}</code>
              <button className="copy-btn" onClick={copyBaseUrl}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="info-card">
            <h3>Authentication</h3>
            <p>Include a Bearer token in the Authorization header:</p>
            <code>Authorization: Bearer &lt;your-jwt-token&gt;</code>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search endpoints by method, path, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="endpoint-count">{filteredCount} endpoint{filteredCount !== 1 ? 's' : ''}</span>
        </div>

        <div className="endpoint-groups">
          {categories.length === 0 && (
            <div className="empty-state">
              <p>No endpoints match your search.</p>
            </div>
          )}
          {categories.map(category => (
            <div className="endpoint-group" key={category}>
              <div
                className={`group-header ${expandedGroups[category] ? 'expanded' : ''}`}
                onClick={() => toggleGroup(category)}
              >
                <span className="group-arrow">{expandedGroups[category] ? '▼' : '▶'}</span>
                <h2>{category}</h2>
                <span className="group-count">{filteredGroups[category].length}</span>
              </div>
              {expandedGroups[category] && (
                <div className="group-endpoints">
                  {filteredGroups[category].map((ep, idx) => (
                    <div className="endpoint-row" key={idx}>
                      <span className={`method-badge ${getMethodClass(ep.method)}`}>
                        {ep.method}
                      </span>
                      <code className="endpoint-path">{ep.path}</code>
                      <span className="endpoint-desc">{ep.summary}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ApiDocs;
