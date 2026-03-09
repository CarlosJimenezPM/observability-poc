/**
 * Cube.js Configuration
 * 
 * Security: JWT authentication with tenant isolation
 * All queries are automatically filtered by tenant_id
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.CUBEJS_API_SECRET || 'dev-secret-change-in-production';
const DEV_MODE = process.env.CUBEJS_DEV_MODE === 'true';

module.exports = {
  schemaPath: './model',

  // Verify JWT and extract tenant context
  checkAuth: (req, auth) => {
    if (!auth) {
      throw new Error('No authorization token provided');
    }

    try {
      const token = auth.replace(/^Bearer\s+/i, '');
      let decoded;

      if (DEV_MODE) {
        // Dev mode: decode without verifying signature (for demo frontend)
        const parts = token.split('.');
        if (parts.length >= 2) {
          try {
            decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          } catch (e) {
            throw new Error('Invalid token format');
          }
        } else {
          throw new Error('Invalid token format');
        }
      } else {
        // Production: verify signature
        decoded = jwt.verify(token, JWT_SECRET);
      }

      if (!decoded.tenantId) {
        throw new Error('Token missing tenantId claim');
      }

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

    query.filters = query.filters || [];
    query.filters.push({
      member: 'Orders.tenantId',
      operator: 'equals',
      values: [securityContext.tenantId]
    });

    return query;
  }
};
