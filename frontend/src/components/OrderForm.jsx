import React, { useState } from 'react';

const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Books', 'Home'];
const REGIONS = ['North', 'South', 'East', 'West'];

const styles = {
  card: {
    background: 'white',
    borderRadius: '15px',
    padding: '1.5rem',
    boxShadow: '0 5px 20px rgba(0,0,0,0.1)',
    height: 'fit-content',
  },
  title: {
    fontSize: '1.3rem',
    fontWeight: '600',
    marginBottom: '1.5rem',
    color: '#333',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    fontWeight: '500',
    color: '#555',
    marginBottom: '0.3rem',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '0.8rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '1rem',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    padding: '0.8rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    background: 'white',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  button: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.1rem',
    background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    marginTop: '0.5rem',
    transition: 'transform 0.2s',
  },
  buttonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
  },
  info: {
    marginTop: '1rem',
    padding: '1rem',
    background: '#f0f7ff',
    borderRadius: '10px',
    fontSize: '0.85rem',
    color: '#444',
  },
  recentOrder: {
    marginTop: '1.5rem',
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '10px',
    borderLeft: '4px solid #27ae60',
  },
  recentTitle: {
    fontWeight: '600',
    marginBottom: '0.5rem',
    color: '#27ae60',
  }
};

function generateOrderId() {
  return 'ORD-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

export default function OrderForm({ token, tenant, onOrderCreated }) {
  const [loading, setLoading] = useState(false);
  const [recentOrder, setRecentOrder] = useState(null);
  const [form, setForm] = useState({
    category: 'Electronics',
    region: 'North',
    amount: 100,
    quantity: 1,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const order = {
      order_id: generateOrderId(),
      tenant_id: tenant,
      customer_id: `CUST-${Math.floor(Math.random() * 1000)}`,
      product_category: form.category,
      amount: parseFloat(form.amount),
      quantity: parseInt(form.quantity),
      status: 'pending',
      region: form.region,
      time: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(order)
      });

      if (response.ok) {
        setRecentOrder(order);
        onOrderCreated(order);
        // Reset form
        setForm(prev => ({ ...prev, amount: 100, quantity: 1 }));
      }
    } catch (err) {
      console.error('Error creating order:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>➕ Crear Pedido</h2>
      
      <form style={styles.form} onSubmit={handleSubmit}>
        <div>
          <label style={styles.label}>Categoría</label>
          <select 
            name="category" 
            value={form.category} 
            onChange={handleChange}
            style={styles.select}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={styles.label}>Región</label>
          <select 
            name="region" 
            value={form.region} 
            onChange={handleChange}
            style={styles.select}
          >
            {REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div style={styles.row}>
          <div>
            <label style={styles.label}>Importe ($)</label>
            <input
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              min="1"
              max="10000"
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Cantidad</label>
            <input
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              min="1"
              max="100"
              style={styles.input}
            />
          </div>
        </div>

        <button 
          type="submit" 
          style={{...styles.button, ...(loading ? styles.buttonDisabled : {})}}
          disabled={loading}
        >
          {loading ? '⏳ Creando...' : '🛒 Crear Pedido'}
        </button>
      </form>

      <div style={styles.info}>
        <strong>💡 Flujo de datos:</strong>
        <br />1. El pedido se guarda en PostgreSQL (OLTP)
        <br />2. Se envía a Redpanda (streaming)
        <br />3. ClickHouse lo consume automáticamente
        <br />4. El dashboard se actualiza
      </div>

      {recentOrder && (
        <div style={styles.recentOrder}>
          <div style={styles.recentTitle}>✓ Último pedido creado</div>
          <div><strong>ID:</strong> {recentOrder.order_id}</div>
          <div><strong>Categoría:</strong> {recentOrder.product_category}</div>
          <div><strong>Importe:</strong> ${recentOrder.amount}</div>
        </div>
      )}
    </div>
  );
}
