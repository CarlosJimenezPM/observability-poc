// =============================================
// Cube.js Schema: Orders
// =============================================
// Capa semántica con seguridad multitenant
// =============================================

cube('Orders', {
  sql: `SELECT * FROM orders_olap`,
  
  // ==========================================
  // SEGURIDAD MULTITENANT
  // ==========================================
  // Inyecta filtro obligatorio por tenant_id
  // Imposible que un tenant vea datos de otro
  // ==========================================
  queryRewrite: (query, { securityContext }) => {
    // Requerir autenticación
    if (!securityContext || !securityContext.tenantId) {
      throw new Error('Authentication required: tenantId missing');
    }
    
    // Forzar filtro por tenant
    query.filters.push({
      member: 'Orders.tenantId',
      operator: 'equals',
      values: [securityContext.tenantId]
    });
    
    return query;
  },
  
  // ==========================================
  // MEDIDAS (Métricas que se pueden consultar)
  // ==========================================
  measures: {
    count: {
      type: 'count',
      title: 'Total Orders'
    },
    
    totalAmount: {
      type: 'sum',
      sql: 'amount',
      title: 'Total Revenue'
    },
    
    avgAmount: {
      type: 'avg',
      sql: 'amount',
      title: 'Average Order Value'
    },
    
    maxAmount: {
      type: 'max',
      sql: 'amount',
      title: 'Largest Order'
    },
    
    minAmount: {
      type: 'min', 
      sql: 'amount',
      title: 'Smallest Order'
    }
  },
  
  // ==========================================
  // DIMENSIONES (Campos para agrupar/filtrar)
  // ==========================================
  dimensions: {
    id: {
      sql: 'id',
      type: 'string',
      primaryKey: true
    },
    
    tenantId: {
      sql: 'tenant_id',
      type: 'string',
      title: 'Tenant'
    },
    
    product: {
      sql: 'product',
      type: 'string',
      title: 'Product'
    },
    
    timestamp: {
      sql: 'timestamp',
      type: 'time',
      title: 'Order Time'
    },
    
    date: {
      sql: 'date',
      type: 'time',
      title: 'Order Date'
    },
    
    hour: {
      sql: 'hour',
      type: 'number',
      title: 'Hour of Day'
    }
  },
  
  // ==========================================
  // SEGMENTOS (Filtros predefinidos)
  // ==========================================
  segments: {
    highValue: {
      sql: `${CUBE}.amount > 500`
    },
    
    today: {
      sql: `${CUBE}.date = today()`
    },
    
    thisWeek: {
      sql: `${CUBE}.date >= toStartOfWeek(today())`
    }
  },
  
  // ==========================================
  // PRE-AGREGACIONES (Caché para performance)
  // ==========================================
  preAggregations: {
    hourly: {
      measures: [count, totalAmount, avgAmount],
      dimensions: [product],
      timeDimension: timestamp,
      granularity: 'hour',
      refreshKey: {
        every: '1 minute'
      }
    }
  }
});
