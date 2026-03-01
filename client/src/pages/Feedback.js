import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Feedback.css';

function Feedback({ socket }) {
  const [feedback, setFeedback] = useState([]);
  const [techStats, setTechStats] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    if (socket) {
      socket.on('feedback-submitted', () => loadData());
    }

    return () => {
      if (socket) {
        socket.off('feedback-submitted');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const loadData = async () => {
    try {
      const [feedbackRes, statsRes] = await Promise.all([
        axios.get('/api/feedback'),
        axios.get('/api/feedback/stats/summary')
      ]);
      setFeedback(feedbackRes.data);
      setTechStats(statsRes.data);
    } catch (error) {
      console.error('Error loading feedback data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  const overallAvg = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
    : '0.0';

  return (
    <div className="feedback-page">
      <div className="container">
        <div className="feedback-header">
          <h1>⭐ Customer Feedback</h1>
          <p>Review ratings and comments from customers</p>
        </div>

        <div className="feedback-overview">
          <div className="feedback-stat-card">
            <div className="feedback-stat-value">{feedback.length}</div>
            <div className="feedback-stat-label">Total Reviews</div>
          </div>
          <div className="feedback-stat-card">
            <div className="feedback-stat-value">{overallAvg}</div>
            <div className="feedback-stat-label">Average Rating</div>
          </div>
          <div className="feedback-stat-card">
            <div className="feedback-stat-value">{feedback.filter(f => f.rating >= 4).length}</div>
            <div className="feedback-stat-label">Positive (4-5★)</div>
          </div>
          <div className="feedback-stat-card">
            <div className="feedback-stat-value">{feedback.filter(f => f.rating <= 2).length}</div>
            <div className="feedback-stat-label">Needs Attention (1-2★)</div>
          </div>
        </div>

        <div className="feedback-tabs">
          <button
            className={`feedback-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Reviews ({feedback.length})
          </button>
          <button
            className={`feedback-tab ${activeTab === 'technicians' ? 'active' : ''}`}
            onClick={() => setActiveTab('technicians')}
          >
            By Technician ({techStats.length})
          </button>
        </div>

        {activeTab === 'all' && (
          <div className="feedback-list">
            {feedback.length === 0 ? (
              <div className="feedback-empty">
                <p>No feedback received yet</p>
              </div>
            ) : (
              feedback.map(fb => (
                <div key={fb.id} className="feedback-card">
                  <div className="feedback-card-header">
                    <div className="feedback-card-stars">
                      {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                    </div>
                    <div className="feedback-card-date">
                      {new Date(fb.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="feedback-card-title">{fb.service_call_title}</div>
                  {fb.comment && (
                    <div className="feedback-card-comment">{fb.comment}</div>
                  )}
                  <div className="feedback-card-meta">
                    {fb.submitted_by_name && <span>By: {fb.submitted_by_name}</span>}
                    {fb.technician_name && <span>Technician: {fb.technician_name}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'technicians' && (
          <div className="feedback-tech-grid">
            {techStats.length === 0 ? (
              <div className="feedback-empty">
                <p>No technician ratings yet</p>
              </div>
            ) : (
              techStats.map(tech => (
                <div key={tech.technician_id} className="feedback-tech-card">
                  <div className="feedback-tech-name">{tech.technician_name || 'Unknown'}</div>
                  <div className="feedback-tech-rating">
                    <span className="feedback-tech-stars">
                      {'★'.repeat(Math.round(tech.average_rating))}
                      {'☆'.repeat(5 - Math.round(tech.average_rating))}
                    </span>
                    <span className="feedback-tech-avg">{tech.average_rating}</span>
                  </div>
                  <div className="feedback-tech-stats">
                    <span>{tech.total_reviews} review{tech.total_reviews !== 1 ? 's' : ''}</span>
                    <span className="feedback-tech-positive">👍 {tech.positive_reviews}</span>
                    <span className="feedback-tech-negative">👎 {tech.negative_reviews}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Feedback;
