/**
 * Shared formatting and display helpers used across multiple pages.
 */

/**
 * Map a status string to a CSS badge colour class.
 * @param {string} status
 * @returns {string}
 */
export function getStatusColor(status) {
  const colors = {
    pending: 'warning',
    'in-progress': 'primary',
    completed: 'success',
    cancelled: 'danger',
    active: 'primary',
    draft: 'secondary',
    sent: 'info',
    accepted: 'success',
    declined: 'danger',
    paid: 'success',
    partial: 'warning',
    overdue: 'danger',
  };
  return colors[status] || 'primary';
}

/**
 * Map a priority string to an emoji icon.
 * @param {string} priority
 * @returns {string}
 */
export function getPriorityIcon(priority) {
  const icons = {
    low: '🟢',
    normal: '🟡',
    high: '🟠',
    urgent: '🔴',
  };
  return icons[priority] || '🟡';
}

/**
 * Human-readable relative time string (e.g. "3h ago").
 * @param {Date|string} date
 * @returns {string}
 */
export function formatTimeAgo(date) {
  const d = date instanceof Date ? date : new Date(date);
  const seconds = Math.floor((new Date() - d) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format cents or dollars to a currency string.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
}
