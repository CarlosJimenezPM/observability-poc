import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  card: {
    background: 'white',
    borderRadius: '15px',
    padding: '1.5rem',
    boxShadow: '0 5px 20px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#333',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  stat: {
    background: 'white',
    borderRadius: '15px',
    padding: '1.5rem',
    boxShadow: '0 5px 20px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    color: '#666',
    fontSize: '0.9rem',
    marginTop: '0.5rem',
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    color: '#666',
  },
  error: {
    background: '#fee',
    color: '#c00',
    padding: '1rem',
    borderRadius: '10px',
    textAlign: 'center',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  }
};

async function fetchCubeData(token, query) {
  const response = await fetch('/cubejs-api/v1/load?' + new URLSearchParams({
    query: JSON.stringify(query)
  }), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Error fetching data');
  }
  
  return response.json();
}

export default function Dashboard({ token, refreshKey }) {
  const [stats, setStats] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [byRegion, setByRegion] = useState([]);
  const [byStatus, setByStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch stats
        const statsResult = await fetchCubeData(token, {
          measures: ['Orders.count', 'Orders.totalAmount', 'Orders.avgAmount']
        });
        
        if (statsResult.data && statsResult.data[0]) {
          setStats({
            count: statsResult.data[0]['Orders.count'] || 0,
            total: statsResult.data[0]['Orders.totalAmount'] || 0,
            avg: statsResult.data[0]['Orders.avgAmount'] || 0,
          });
        }

        // Fetch by category
        const categoryResult = await fetchCubeData(token, {
          measures: ['Orders.totalAmount'],
          dimensions: ['Orders.productCategory']
        });
        setByCategory(categoryResult.data?.map(d => ({
          name: d['Orders.productCategory'],
          value: parseFloat(d['Orders.totalAmount']) || 0
        })) || []);

        // Fetch by region
        const regionResult = await fetchCubeData(token, {
          measures: ['Orders.count'],
          dimensions: ['Orders.region']
        });
        setByRegion(regionResult.data?.map(d => ({
          name: d['Orders.region'],
          value: parseInt(d['Orders.count']) || 0
        })) || []);

        // Fetch by status
        const statusResult = await fetchCubeData(token, {
          measures: ['Orders.count'],
          dimensions: ['Orders.status']
        });
        setByStatus(statusResult.data?.map(d => ({
          name: d['Orders.status'],
          value: parseInt(d['Orders.count']) || 0
        })) || []);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token, refreshKey]);

  if (loading) {
    return <div style={styles.loading}>⏳ Cargando datos...</div>;
  }

  if (error) {
    return <div style={styles.error}>❌ {error}</div>;
  }

  return (
    <div style={styles.container}>
      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.stat}>
          <div style={styles.statValue}>{stats?.count || 0}</div>
          <div style={styles.statLabel}>Total Pedidos</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statValue}>${(stats?.total || 0).toLocaleString()}</div>
          <div style={styles.statLabel}>Ingresos Totales</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statValue}>${(stats?.avg || 0).toFixed(0)}</div>
          <div style={styles.statLabel}>Ticket Medio</div>
        </div>
      </div>

      {/* Charts */}
      <div style={styles.chartsGrid}>
        <div style={styles.card}>
          <h3 style={styles.title}>💰 Ventas por Categoría</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCategory}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#667eea" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.card}>
          <h3 style={styles.title}>🌍 Pedidos por Región</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={byRegion}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {byRegion.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.title}>📊 Estado de Pedidos</h3>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={byStatus} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
            <Tooltip />
            <Bar dataKey="value" fill="#764ba2" radius={[0, 5, 5, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
