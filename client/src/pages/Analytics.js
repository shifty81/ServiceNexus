import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import axios from 'axios';
import './Analytics.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  function fetchAnalytics() {
    setLoading(true);
    setError(null);
    axios.get('/api/analytics')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load analytics data');
        setLoading(false);
      });
  }

  function formatCurrency(value) {
    return '$' + (value || 0).toLocaleString();
  }

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="container">
          <div className="error-state">
            <h2>⚠️ Error</h2>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={fetchAnalytics}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const revenue = data?.revenue || {};
  const servicePerformance = data?.servicePerformance || {};
  const teamProductivity = data?.teamProductivity || {};
  const customerInsights = data?.customerInsights || {};
  const operationalMetrics = data?.operationalMetrics || {};

  const monthlyRevenueLabels = (revenue.monthlyRevenue || []).map(m => m.month);
  const monthlyRevenueData = {
    labels: monthlyRevenueLabels,
    datasets: [
      {
        label: 'Revenue',
        data: (revenue.monthlyRevenue || []).map(m => m.revenue),
        backgroundColor: 'rgba(37, 99, 235, 0.7)',
        borderColor: '#2563eb',
        borderWidth: 1
      },
      {
        label: 'Paid',
        data: (revenue.monthlyRevenue || []).map(m => m.paid),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: '#10b981',
        borderWidth: 1
      }
    ]
  };

  const monthlyRevenueOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Monthly Revenue' }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + value.toLocaleString();
          }
        }
      }
    }
  };

  const serviceCallLabels = (servicePerformance.monthlyServiceCalls || []).map(m => m.month);
  const serviceCallData = {
    labels: serviceCallLabels,
    datasets: [
      {
        label: 'Total Calls',
        data: (servicePerformance.monthlyServiceCalls || []).map(m => m.total),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Completed',
        data: (servicePerformance.monthlyServiceCalls || []).map(m => m.completed),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  };

  const serviceCallOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Service Call Trends' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  const serviceStatusData = {
    labels: ['Pending', 'In Progress', 'Completed'],
    datasets: [{
      data: [
        servicePerformance.pendingCalls || 0,
        servicePerformance.inProgressCalls || 0,
        servicePerformance.completedCalls || 0
      ],
      backgroundColor: ['#f59e0b', '#2563eb', '#10b981'],
      borderColor: ['#d97706', '#1d4ed8', '#059669'],
      borderWidth: 2
    }]
  };

  const serviceStatusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: 'Service Status Breakdown' }
    }
  };

  const customerGrowthLabels = (customerInsights.monthlyCustomerGrowth || []).map(m => m.month);
  const customerGrowthData = {
    labels: customerGrowthLabels,
    datasets: [{
      label: 'New Customers',
      data: (customerInsights.monthlyCustomerGrowth || []).map(m => m.count),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: true,
      tension: 0.3
    }]
  };

  const customerGrowthOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Customer Growth' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  const topTechnicians = teamProductivity.topTechnicians || [];
  const topCustomers = customerInsights.topCustomersByRevenue || [];

  return (
    <div className="analytics-page">
      <div className="container">
        <div className="page-header">
          <h1>📊 Analytics &amp; Business Intelligence</h1>
          <p className="subtitle">Real-time insights into your business performance</p>
        </div>

        {/* KPI Summary Cards */}
        <div className="kpi-row">
          <div className="kpi-card kpi-blue">
            <div className="kpi-icon">💰</div>
            <div className="kpi-content">
              <span className="kpi-value">{formatCurrency(revenue.totalRevenue)}</span>
              <span className="kpi-label">Total Revenue</span>
            </div>
          </div>
          <div className="kpi-card kpi-green">
            <div className="kpi-icon">✅</div>
            <div className="kpi-content">
              <span className="kpi-value">{(servicePerformance.completionRate || 0).toFixed(1)}%</span>
              <span className="kpi-label">Service Completion Rate</span>
            </div>
          </div>
          <div className="kpi-card kpi-amber">
            <div className="kpi-icon">⭐</div>
            <div className="kpi-content">
              <span className="kpi-value">{(servicePerformance.averageRating || 0).toFixed(1)}</span>
              <span className="kpi-label">Average Rating</span>
            </div>
          </div>
          <div className="kpi-card kpi-purple">
            <div className="kpi-icon">👥</div>
            <div className="kpi-content">
              <span className="kpi-value">{teamProductivity.activeEmployees || 0}</span>
              <span className="kpi-label">Active Employees</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-grid">
          <div className="chart-card chart-wide">
            <div className="chart-container">
              <Bar data={monthlyRevenueData} options={monthlyRevenueOptions} />
            </div>
          </div>
          <div className="chart-card chart-wide">
            <div className="chart-container">
              <Line data={serviceCallData} options={serviceCallOptions} />
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-container">
              <Doughnut data={serviceStatusData} options={serviceStatusOptions} />
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-container">
              <Line data={customerGrowthData} options={customerGrowthOptions} />
            </div>
          </div>
        </div>

        {/* Top Technicians Table */}
        <div className="table-card">
          <h2>🏆 Top Technicians</h2>
          <div className="table-responsive">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Username</th>
                  <th>Hours Worked</th>
                  <th>Completed Calls</th>
                  <th>Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {topTechnicians.length === 0 ? (
                  <tr><td colSpan="5" className="empty-row">No technician data available</td></tr>
                ) : (
                  topTechnicians.map((tech, index) => (
                    <tr key={tech.user_id}>
                      <td className="rank-cell">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </td>
                      <td>{tech.username}</td>
                      <td>{(tech.totalHours || 0).toFixed(1)}</td>
                      <td>{tech.completedCalls || 0}</td>
                      <td>⭐ {(tech.averageRating || 0).toFixed(1)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Customers Table */}
        <div className="table-card">
          <h2>🏅 Top Customers by Revenue</h2>
          <div className="table-responsive">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Total Revenue</th>
                  <th>Invoice Count</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.length === 0 ? (
                  <tr><td colSpan="4" className="empty-row">No customer data available</td></tr>
                ) : (
                  topCustomers.map((cust, index) => (
                    <tr key={cust.customer_id}>
                      <td className="rank-cell">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </td>
                      <td>{cust.name}</td>
                      <td>{formatCurrency(cust.totalRevenue)}</td>
                      <td>{cust.invoiceCount || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Metrics Grid */}
        <div className="section-header">
          <h2>⚙️ Operational Metrics</h2>
        </div>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-icon">🚚</span>
            <span className="metric-value">{operationalMetrics.completedDispatches || 0}/{operationalMetrics.totalDispatches || 0}</span>
            <span className="metric-label">Dispatches Completed</span>
            <span className="metric-sub">{(operationalMetrics.dispatchCompletionRate || 0).toFixed(1)}% completion</span>
          </div>
          <div className="metric-card">
            <span className="metric-icon">📋</span>
            <span className="metric-value">{operationalMetrics.totalForms || 0}</span>
            <span className="metric-label">Total Forms</span>
          </div>
          <div className="metric-card">
            <span className="metric-icon">📝</span>
            <span className="metric-value">{operationalMetrics.totalSubmissions || 0}</span>
            <span className="metric-label">Total Submissions</span>
          </div>
          <div className="metric-card">
            <span className="metric-icon">📦</span>
            <span className="metric-value">{operationalMetrics.totalInventoryItems || 0}</span>
            <span className="metric-label">Inventory Items</span>
            {(operationalMetrics.lowStockItems || 0) > 0 && (
              <span className="metric-sub metric-warning">⚠️ {operationalMetrics.lowStockItems} low stock</span>
            )}
          </div>
          <div className="metric-card">
            <span className="metric-icon">📄</span>
            <span className="metric-value">{operationalMetrics.acceptedEstimates || 0}/{operationalMetrics.totalEstimates || 0}</span>
            <span className="metric-label">Estimates Accepted</span>
            <span className="metric-sub">{(operationalMetrics.estimateConversionRate || 0).toFixed(1)}% conversion</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
