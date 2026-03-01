import React from 'react';
import { Link } from 'react-router-dom';
import './Navigation.css';

function Navigation({ user, onLogout }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  
  const userType = user?.user_type || 'admin';

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
            Dashboard
          </Link>
          
          {/* Client view - simplified menu */}
          {userType === 'client' && (
            <>
              <Link to="/servicecalls" className="nav-link" onClick={() => setMenuOpen(false)}>
                My Service Requests
              </Link>
              <Link to="/estimates" className="nav-link" onClick={() => setMenuOpen(false)}>
                Estimates
              </Link>
              <Link to="/invoices" className="nav-link" onClick={() => setMenuOpen(false)}>
                Invoices
              </Link>
            </>
          )}
          
          {/* Technician view - field work focused */}
          {userType === 'technician' && (
            <>
              <Link to="/servicecalls" className="nav-link" onClick={() => setMenuOpen(false)}>
                Service Calls
              </Link>
              <Link to="/dispatch" className="nav-link" onClick={() => setMenuOpen(false)}>
                Dispatch
              </Link>
              <Link to="/purchaseorders" className="nav-link" onClick={() => setMenuOpen(false)}>
                Purchase Orders
              </Link>
              <Link to="/inventory" className="nav-link" onClick={() => setMenuOpen(false)}>
                Inventory
              </Link>
              <Link to="/timetracking" className="nav-link" onClick={() => setMenuOpen(false)}>
                Time Tracking
              </Link>
            </>
          )}
          
          {/* Admin view - full access */}
          {userType === 'admin' && (
            <>
              <Link to="/forms" className="nav-link" onClick={() => setMenuOpen(false)}>
                Forms
              </Link>
              <Link to="/ai-upload" className="nav-link" onClick={() => setMenuOpen(false)}>
                AI Upload
              </Link>
              <Link to="/servicecalls" className="nav-link" onClick={() => setMenuOpen(false)}>
                Service Calls
              </Link>
              <Link to="/dispatch" className="nav-link" onClick={() => setMenuOpen(false)}>
                Dispatch
              </Link>
              <Link to="/purchaseorders" className="nav-link" onClick={() => setMenuOpen(false)}>
                Purchase Orders
              </Link>
              <Link to="/inventory" className="nav-link" onClick={() => setMenuOpen(false)}>
                Inventory
              </Link>
              <Link to="/customers" className="nav-link" onClick={() => setMenuOpen(false)}>
                Customers
              </Link>
              <Link to="/estimates" className="nav-link" onClick={() => setMenuOpen(false)}>
                Estimates
              </Link>
              <Link to="/invoices" className="nav-link" onClick={() => setMenuOpen(false)}>
                Invoices
              </Link>
              <Link to="/timetracking" className="nav-link" onClick={() => setMenuOpen(false)}>
                Time Tracking
              </Link>
              <Link to="/integrations" className="nav-link" onClick={() => setMenuOpen(false)}>
                Integrations
              </Link>
              <Link to="/feedback" className="nav-link" onClick={() => setMenuOpen(false)}>
                Feedback
              </Link>
              <Link to="/analytics" className="nav-link" onClick={() => setMenuOpen(false)}>
                Analytics
              </Link>
              <Link to="/smart-routing" className="nav-link" onClick={() => setMenuOpen(false)}>
                Smart Routing
              </Link>
              <Link to="/maintenance" className="nav-link" onClick={() => setMenuOpen(false)}>
                Maintenance
              </Link>
              <Link to="/reports" className="nav-link" onClick={() => setMenuOpen(false)}>
                Reports
              </Link>
              <Link to="/api-docs" className="nav-link" onClick={() => setMenuOpen(false)}>
                API Docs
              </Link>
              <Link to="/system" className="nav-link" onClick={() => setMenuOpen(false)}>
                System
              </Link>
            </>
          )}
          
          <div className="nav-user">
            <span className="user-name">{user?.username || 'User'} ({userType})</span>
            <button className="btn btn-sm btn-outline" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
