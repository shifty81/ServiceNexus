import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import './Login.css';

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const data = isRegister 
        ? { username, password, email, user_type: userType } 
        : { username, password };
      
      const response = await axios.post(endpoint, data);
      onLogin(response.data.user, response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>📋 {t('login.title')}</h1>
          <p>{t('login.subtitle')}</p>
          <div className="login-lang-switcher">
            <button className={`lang-btn-login ${i18n.language === 'en' ? 'active' : ''}`} onClick={() => i18n.changeLanguage('en')}>EN</button>
            <button className={`lang-btn-login ${i18n.language === 'es' ? 'active' : ''}`} onClick={() => i18n.changeLanguage('es')}>ES</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="alert alert-error">{error}</div>}
          
          <div className="form-group">
            <label className="form-label">{t('login.username')}</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          {isRegister && (
            <>
              <div className="form-group">
                <label className="form-label">{t('login.email')}</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('login.userType')}</label>
                <select
                  className="form-control"
                  value={userType}
                  onChange={(e) => setUserType(e.target.value)}
                  required
                >
                  <option value="admin">{t('login.admin')}</option>
                  <option value="technician">{t('login.technician')}</option>
                  <option value="client">{t('login.client')}</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">{t('login.password')}</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? (isRegister ? t('login.creating') : t('login.signingIn'))
              : (isRegister ? t('login.register') : t('login.signIn'))}
          </button>

          <div className="login-toggle">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
            >
              {isRegister 
                ? t('login.switchToLogin')
                : t('login.switchToRegister')}
            </button>
          </div>
        </form>

        <div className="features-preview">
          <h3>Key Features</h3>
          <ul>
            <li>✨ AI-Powered Form Creation from PDF/Word</li>
            <li>📱 Mobile-First Responsive Design</li>
            <li>✍️ UETA Compliant eSignatures</li>
            <li>📍 GPS & Map Integration</li>
            <li>📊 Real-Time Inventory Tracking</li>
            <li>🚀 Dispatching & Workflow Automation</li>
            <li>📷 OCR, Barcode Scanning & Rich Media</li>
            <li>📈 Advanced Reporting & Analytics</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Login;
