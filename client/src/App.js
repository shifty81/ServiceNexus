import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import FormBuilder from './pages/FormBuilder';
import FormsList from './pages/FormsList';
import FormView from './pages/FormView';
import EditableDocumentForm from './pages/EditableDocumentForm';
import Dispatch from './pages/Dispatch';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Estimates from './pages/Estimates';
import Invoices from './pages/Invoices';
import Login from './pages/Login';
import AIFormUpload from './pages/AIFormUpload';
import Reports from './pages/Reports';
import TimeTracking from './pages/TimeTracking';
import ServiceCalls from './pages/ServiceCalls';
import ServiceCallDetail from './pages/ServiceCallDetail';
import PurchaseOrders from './pages/PurchaseOrders';
import Integrations from './pages/Integrations';
import CustomerPortal from './pages/CustomerPortal';
import TechPortal from './pages/TechPortal';
import { io } from 'socket.io-client';

function App() {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Check for stored token
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Initialize socket connection
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001');
    setSocket(newSocket);

    return () => {
      if (newSocket) newSocket.close();
    };
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const userType = user?.user_type || 'admin';

  const PortalDashboard = () => {
    if (userType === 'client') return <CustomerPortal socket={socket} />;
    if (userType === 'technician') return <TechPortal socket={socket} />;
    return <Dashboard socket={socket} />;
  };

  return (
    <Router>
      <div className="App">
        <Navigation user={user} onLogout={handleLogout} />
        <main style={{ paddingTop: '80px', minHeight: '100vh' }}>
          <Routes>
            <Route path="/" element={<PortalDashboard />} />
            <Route path="/forms" element={<FormsList />} />
            <Route path="/forms/new" element={<FormBuilder />} />
            <Route path="/forms/:id" element={<FormView />} />
            <Route path="/forms/:id/edit" element={<FormBuilder />} />
            <Route path="/forms/:id/fill-document" element={<EditableDocumentForm />} />
            <Route path="/ai-upload" element={<AIFormUpload />} />
            <Route path="/servicecalls" element={<ServiceCalls socket={socket} />} />
            <Route path="/servicecalls/:id" element={<ServiceCallDetail socket={socket} />} />
            <Route path="/purchaseorders" element={<PurchaseOrders socket={socket} />} />
            <Route path="/dispatch" element={<Dispatch socket={socket} />} />
            <Route path="/inventory" element={<Inventory socket={socket} />} />
            <Route path="/customers" element={<Customers socket={socket} />} />
            <Route path="/estimates" element={<Estimates socket={socket} />} />
            <Route path="/invoices" element={<Invoices socket={socket} />} />
            <Route path="/timetracking" element={<TimeTracking socket={socket} />} />
            <Route path="/integrations" element={<Integrations socket={socket} />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
