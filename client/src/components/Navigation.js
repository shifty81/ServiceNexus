import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Navigation.css';

function Navigation({ user, onLogout }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { t, i18n } = useTranslation();
  
  const userType = user?.user_type || 'admin';

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          <span className="nav-logo">⚡</span>
          ServiceNexus {userType === 'client' ? 'Client' : userType === 'technician' ? 'Technician' : ''}
        </Link>
        
        <button 
          className="nav-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <div className={`nav-menu ${menuOpen ? 'active' : ''}`}>
          <Link to="/" className="nav-link" onClick={() => setMenuOpen(false)}>
            {t('nav.dashboard')}
          </Link>
          
          {/* Client view - simplified menu */}
          {userType === 'client' && (
            <>
              <Link to="/servicecalls" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.myServiceRequests')}
              </Link>
              <Link to="/estimates" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.estimates')}
              </Link>
              <Link to="/invoices" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.invoices')}
              </Link>
            </>
          )}
          
          {/* Technician view - field work focused */}
          {userType === 'technician' && (
            <>
              <Link to="/servicecalls" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.serviceCalls')}
              </Link>
              <Link to="/dispatch" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.dispatch')}
              </Link>
              <Link to="/purchaseorders" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.purchaseOrders')}
              </Link>
              <Link to="/inventory" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.inventory')}
              </Link>
              <Link to="/timetracking" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.timeTracking')}
              </Link>
            </>
          )}
          
          {/* Admin view - full access */}
          {userType === 'admin' && (
            <>
              <Link to="/forms" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.forms')}
              </Link>
              <Link to="/ai-upload" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.aiUpload')}
              </Link>
              <Link to="/servicecalls" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.serviceCalls')}
              </Link>
              <Link to="/dispatch" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.dispatch')}
              </Link>
              <Link to="/purchaseorders" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.purchaseOrders')}
              </Link>
              <Link to="/inventory" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.inventory')}
              </Link>
              <Link to="/customers" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.customers')}
              </Link>
              <Link to="/estimates" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.estimates')}
              </Link>
              <Link to="/invoices" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.invoices')}
              </Link>
              <Link to="/timetracking" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.timeTracking')}
              </Link>
              <Link to="/integrations" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.integrations')}
              </Link>
              <Link to="/feedback" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.feedback')}
              </Link>
              <Link to="/analytics" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.analytics')}
              </Link>
              <Link to="/smart-routing" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.smartRouting')}
              </Link>
              <Link to="/maintenance" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.maintenance')}
              </Link>
              <Link to="/reports" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.reports')}
              </Link>
              <Link to="/api-docs" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.apiDocs')}
              </Link>
              <Link to="/system" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t('nav.system')}
              </Link>
            </>
          )}
          
          <div className="nav-user">
            <div className="language-switcher">
              <button
                className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
                onClick={() => changeLanguage('en')}
                title="English"
              >
                EN
              </button>
              <button
                className={`lang-btn ${i18n.language === 'es' ? 'active' : ''}`}
                onClick={() => changeLanguage('es')}
                title="Español"
              >
                ES
              </button>
            </div>
            <span className="user-name">{user?.username || 'User'} ({userType})</span>
            <button className="btn btn-sm btn-outline" onClick={onLogout}>
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
