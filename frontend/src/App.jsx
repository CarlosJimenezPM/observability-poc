import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  header: {
    background: 'rgba(255,255,255,0.95)',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  logo: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#667eea',
  },
  tenantBadge: {
    background: '#667eea',
    color: 'white',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    fontSize: '0.9rem',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #e74c3c',
    color: '#e74c3c',
    padding: '0.5rem 1rem',
    borderRadius: '5px',
    cursor: 'pointer',
    marginLeft: '1rem',
  },
  main: {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: '2rem',
  },
  notification: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: '#27ae60',
    color: 'white',
    padding: '1rem 2rem',
    borderRadius: '10px',
    boxShadow: '0 5px 20px rgba(0,0,0,0.2)',
    animation: 'slideIn 0.3s ease',
  }
};

export default function App() {
  const [tenant, setTenant] = useState(null);
  const [token, setToken] = useState(null);
  const [notification, setNotification] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogin = (selectedTenant, jwt) => {
    setTenant(selectedTenant);
    setToken(jwt);
  };

  const handleLogout = () => {
    setTenant(null);
    setToken(null);
  };

  const handleOrderCreated = (order) => {
    setNotification(`✓ Pedido ${order.order_id} creado`);
    // Small delay to ensure data is written to TimescaleDB
    setTimeout(() => setRefreshKey(k => k + 1), 500);
    setTimeout(() => setNotification(null), 3000);
  };

  if (!tenant) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>🔭 Observability PoC</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={styles.tenantBadge}>{tenant}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.grid}>
          <Dashboard token={token} refreshKey={refreshKey} />
          <OrderForm token={token} tenant={tenant} onOrderCreated={handleOrderCreated} />
        </div>
      </main>

      {notification && (
        <div style={styles.notification}>{notification}</div>
      )}
    </div>
  );
}
