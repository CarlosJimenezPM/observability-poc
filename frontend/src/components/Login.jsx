import React, { useState } from 'react';

// In production, tokens should be generated server-side
const API_SECRET = import.meta.env.VITE_CUBEJS_API_SECRET || 'dev-secret-change-in-production';

// Simple JWT creation (for demo only - in production, server generates tokens)
function createToken(tenantId) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ 
    tenantId, 
    userId: 'demo-user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 
  }));
  // Note: This is a simplified demo. Real JWT needs proper HMAC signing.
  // The backend in this PoC accepts this format for demo purposes.
  return `${header}.${payload}.demo-signature`;
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  card: {
    background: 'white',
    padding: '3rem',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
    minWidth: '400px',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
    color: '#333',
  },
  subtitle: {
    color: '#666',
    marginBottom: '2rem',
  },
  label: {
    display: 'block',
    textAlign: 'left',
    marginBottom: '0.5rem',
    fontWeight: '500',
    color: '#333',
  },
  select: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    marginBottom: '1.5rem',
    cursor: 'pointer',
  },
  button: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.1rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  info: {
    marginTop: '2rem',
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '10px',
    fontSize: '0.85rem',
    color: '#666',
  }
};

export default function Login({ onLogin }) {
  const [selectedTenant, setSelectedTenant] = useState('tenant_A');

  const handleSubmit = (e) => {
    e.preventDefault();
    const token = createToken(selectedTenant);
    onLogin(selectedTenant, token);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🔭 Observability PoC</h1>
        <p style={styles.subtitle}>Demo Multi-tenant</p>
        
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Selecciona un Tenant</label>
          <select 
            style={styles.select}
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
          >
            <option value="tenant_A">🏢 Tenant A - Acme Corp</option>
            <option value="tenant_B">🏭 Tenant B - Beta Industries</option>
            <option value="tenant_C">🏗️ Tenant C - Gamma Solutions</option>
          </select>

          <button type="submit" style={styles.button}>
            Entrar al Dashboard
          </button>
        </form>

        <div style={styles.info}>
          <strong>💡 Demo:</strong> Cada tenant solo verá sus propios datos.
          <br />Cambia de tenant para ver el aislamiento en acción.
        </div>
      </div>
    </div>
  );
}
