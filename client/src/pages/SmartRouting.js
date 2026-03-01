import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './SmartRouting.css';

function SmartRouting({ socket }) {
  const [activeTab, setActiveTab] = useState('suggestions');
  const [suggestions, setSuggestions] = useState([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [techScores, setTechScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [autoAssigning, setAutoAssigning] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/routing');
      const data = response.data || [];
      setSuggestions(data);
      setUnassignedCount(data.length);
    } catch (err) {
      console.error('Error loading routing suggestions:', err);
      setError(err.response?.data?.error || 'Failed to load routing suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTechScores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/routing/technician-scores');
      setTechScores(response.data || []);
    } catch (err) {
      console.error('Error loading technician scores:', err);
      setError(err.response?.data?.error || 'Failed to load technician scores');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadData = useCallback(() => {
    if (activeTab === 'suggestions') {
      loadSuggestions();
    } else {
      loadTechScores();
    }
  }, [activeTab, loadSuggestions, loadTechScores]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (socket) {
      socket.on('service-call-changed', () => {
        loadData();
      });
    }

    return () => {
      if (socket) socket.off('service-call-changed');
    };
  }, [socket, loadData]);

  const handleAssign = async (serviceCallId) => {
    try {
      setAssigningId(serviceCallId);
      await axios.post('/api/routing/auto-assign', { service_call_id: serviceCallId });
      showToast('Technician assigned successfully');
      loadSuggestions();
    } catch (err) {
      console.error('Error assigning technician:', err);
      showToast(err.response?.data?.error || 'Failed to assign technician', 'error');
    } finally {
      setAssigningId(null);
    }
  };

  const handleAutoAssignAll = async () => {
    try {
      setAutoAssigning(true);
      const response = await axios.post('/api/routing/auto-assign-all');
      const count = response.data.totalAssigned || 0;
      showToast(`Successfully assigned ${count} service call${count !== 1 ? 's' : ''}`);
      loadSuggestions();
    } catch (err) {
      console.error('Error auto-assigning:', err);
      showToast(err.response?.data?.error || 'Failed to auto-assign service calls', 'error');
    } finally {
      setAutoAssigning(false);
    }
  };

  function getPriorityClass(priority) {
    switch ((priority || '').toLowerCase()) {
      case 'urgent': return 'priority-urgent';
      case 'high': return 'priority-high';
      case 'low': return 'priority-low';
      default: return 'priority-normal';
    }
  }

  function getScoreColorClass(score) {
    if (score > 70) return 'score-green';
    if (score > 40) return 'score-yellow';
    return 'score-red';
  }

  function renderStars(rating) {
    const count = Math.round(rating || 0);
    return '⭐'.repeat(Math.min(count, 5));
  }

  if (loading && suggestions.length === 0 && techScores.length === 0) {
    return (
      <div className="smart-routing-page">
        <div className="container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading smart routing data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && suggestions.length === 0 && techScores.length === 0) {
    return (
      <div className="smart-routing-page">
        <div className="container">
          <div className="error-state">
            <h2>⚠️ Error</h2>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={loadData}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="smart-routing-page">
      <div className="container">
        {toast && (
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </div>
        )}

        <div className="page-header">
          <div>
            <h1>🧭 Smart Routing</h1>
            <p className="subtitle">AI-powered technician assignment suggestions</p>
          </div>
        </div>

        <div className="routing-tabs">
          <button
            className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            Suggestions {unassignedCount > 0 && <span className="tab-badge">{unassignedCount}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'scores' ? 'active' : ''}`}
            onClick={() => setActiveTab('scores')}
          >
            Technician Scores
          </button>
        </div>

        {activeTab === 'suggestions' && (
          <div className="suggestions-panel">
            {suggestions.length > 0 && (
              <div className="panel-actions">
                <span className="unassigned-label">{unassignedCount} unassigned service call{unassignedCount !== 1 ? 's' : ''}</span>
                <button
                  className="btn btn-primary"
                  onClick={handleAutoAssignAll}
                  disabled={autoAssigning}
                >
                  {autoAssigning ? 'Assigning...' : '🚀 Auto-Assign All'}
                </button>
              </div>
            )}

            {suggestions.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">✅</span>
                <h3>No unassigned service calls</h3>
                <p>All service calls have been assigned to technicians.</p>
              </div>
            ) : (
              <div className="suggestions-grid">
                {suggestions.map((s) => (
                  <div className="suggestion-card" key={s.service_call_id || s.serviceCall?.id}>
                    <div className="suggestion-header">
                      <h3 className="suggestion-title">{s.serviceCall?.title || s.title || 'Untitled'}</h3>
                      <span className={`priority-badge ${getPriorityClass(s.serviceCall?.priority || s.priority)}`}>
                        {(s.serviceCall?.priority || s.priority || 'normal').toUpperCase()}
                      </span>
                    </div>
                    <div className="suggestion-details">
                      <div className="detail-row">
                        <span className="detail-label">👤 Customer</span>
                        <span className="detail-value">{s.serviceCall?.customer_name || s.customer_name || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">🔧 Suggested Tech</span>
                        <span className="detail-value">{s.suggestedTechnician?.username || s.technician?.username || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">📊 Match Score</span>
                        <div className="score-bar-container">
                          <div
                            className={`score-bar ${getScoreColorClass(s.score || 0)}`}
                            style={{ width: `${Math.min(s.score || 0, 100)}%` }}
                          ></div>
                        </div>
                        <span className="score-value">{Math.round(s.score || 0)}%</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-assign"
                      onClick={() => handleAssign(s.service_call_id || s.serviceCall?.id)}
                      disabled={assigningId === (s.service_call_id || s.serviceCall?.id)}
                    >
                      {assigningId === (s.service_call_id || s.serviceCall?.id) ? 'Assigning...' : '✓ Assign'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'scores' && (
          <div className="scores-panel">
            {techScores.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">👷</span>
                <h3>No technician data</h3>
                <p>No technician scores available yet.</p>
              </div>
            ) : (
              <div className="scores-grid">
                {techScores.map((t) => (
                  <div className="tech-score-card" key={t.technician?.id || t.id}>
                    <div className="tech-header">
                      <h3 className="tech-name">{t.technician?.username || t.username || 'Unknown'}</h3>
                      <span className={`availability-badge ${(t.availabilityStatus || '').toLowerCase() === 'available' ? 'avail-green' : 'avail-orange'}`}>
                        {t.availabilityStatus || 'Unknown'}
                      </span>
                    </div>
                    <div className="tech-metrics">
                      <div className="metric">
                        <span className="metric-label">Active Calls</span>
                        <span className="metric-value">{t.activeCallCount ?? 0}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Completed</span>
                        <span className="metric-value">{t.completedCallCount ?? 0}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Completion Rate</span>
                        <span className="metric-value">{Math.round(t.completionRate ?? 0)}%</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Rating</span>
                        <span className="metric-value">{renderStars(t.averageRating)} {(t.averageRating ?? 0).toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="overall-score-row">
                      <span className="metric-label">Overall Score</span>
                      <div className="score-bar-container">
                        <div
                          className={`score-bar ${getScoreColorClass(t.overallScore || 0)}`}
                          style={{ width: `${Math.min(t.overallScore || 0, 100)}%` }}
                        ></div>
                      </div>
                      <span className="score-value">{Math.round(t.overallScore || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SmartRouting;
