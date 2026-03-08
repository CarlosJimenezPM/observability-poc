// =============================================
// Cube.js Schema: Orders
// =============================================
// Capa semántica con seguridad multitenant
// Compatible con ClickHouse y TimescaleDB
// =============================================

cube('Orders', {
  // Tabla base - funciona en ClickHouse y PostgreSQL/TimescaleDB
  sql: `SELECT * FROM orders`,
  
  // ==========================================
  // SEGURIDAD MULTITENANT
  // ==========================================
  queryRewrite: (query, { securityContext }) => {
    // En modo desarrollo, permitir sin auth
    if (process.env.CUBEJS_DEV_MODE === 'true' && !securityContext?.tenantId) {
      return query;
    }
    
    // En producción, requerir autenticación
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
  // MEDIDAS
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
    
    totalQuantity: {
      type: 'sum',
      sql: 'quantity',
      title: 'Total Quantity'
    }
  },
  
  // ==========================================
  // DIMENSIONES
  // ==========================================
  dimensions: {
    orderId: {
      sql: 'order_id',
      type: 'string',
      primaryKey: true,
      title: 'Order ID'
    },
    
    tenantId: {
      sql: 'tenant_id',
      type: 'string',
      title: 'Tenant'
    },
    
    customerId: {
      sql: 'customer_id',
      type: 'string',
      title: 'Customer'
    },
    
    productCategory: {
      sql: 'product_category',
      type: 'string',
      title: 'Category'
    },
    
    status: {
      sql: 'status',
      type: 'string',
      title: 'Status'
    },
    
    region: {
      sql: 'region',
      type: 'string',
      title: 'Region'
    },
    
    createdAt: {
      sql: 'time',
      type: 'time',
      title: 'Created At'
    }
  },
  
  // ==========================================
  // SEGMENTOS
  // ==========================================
  segments: {
    completed: {
      sql: `${CUBE}.status = 'completed'`
    },
    
    pending: {
      sql: `${CUBE}.status = 'pending'`
    },
    
    highValue: {
      sql: `${CUBE}.amount > 200`
    }
  }
});
