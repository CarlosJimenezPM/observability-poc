/**
 * Cube.js Configuration
 * 
 * Security: JWT authentication with tenant isolation
 * All queries are automatically filtered by tenant_id
 */

const jwt = require('jsonwebtoken');

// Secret from environment (generate with: openssl rand -hex 32)
const JWT_SECRET = process.env.CUBEJS_API_SECRET || 'dev-secret-change-in-production';

module.exports = {
  schemaPath: './model',

  // Verify JWT and extract tenant context
  checkAuth: (req, auth) => {
    if (!auth) {
      throw new Error('No authorization token provided');
    }

    try {
      // Remove 'Bearer ' prefix if present
      const token = auth.replace(/^Bearer\s+/i, '');
      
      // Verify and decode JWT
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (!decoded.tenantId) {
        throw new Error('Token missing tenantId claim');
      }

      // Set security context for query rewriting
      req.securityContext = {
        tenantId: decoded.tenantId,
        userId: decoded.userId || null,
        role: decoded.role || 'user'
      };

    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      if (err.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      throw err;
    }
  },

  // Inject tenant_id filter into ALL queries (security enforcement)
  queryRewrite: (query, { securityContext }) => {
    if (!securityContext || !securityContext.tenantId) {
      throw new Error('No tenant context - query rejected');
    }

    // Force tenant isolation - cannot be bypassed by client
    query.filters = query.filters || [];
    query.filters.push({
      member: 'Orders.tenantId',
      operator: 'equals',
      values: [securityContext.tenantId]
    });

    return query;
  }
};
