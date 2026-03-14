#!/usr/bin/env node
/**
 * MCP Streamable HTTP Server for Cube.js Analytics
 * With API Key authentication per tenant
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CUBE_API_URL = process.env.CUBE_API_URL || "http://localhost:4000";
const PORT = Number(process.env.MCP_PORT || 3001);

// --- Load API Keys ---
function loadApiKeys() {
  try {
    const keysPath = process.env.API_KEYS_FILE || join(__dirname, "api-keys.json");
    const data = JSON.parse(readFileSync(keysPath, "utf-8"));
    console.log(`✅ Loaded ${Object.keys(data.keys).length} API keys`);
    return data.keys;
  } catch (error) {
    console.error("⚠️  Could not load api-keys.json, using empty key map");
    return {};
  }
}

const API_KEYS = loadApiKeys();

// --- Validate API Key and return tenant info ---
function validateApiKey(apiKey) {
  if (!apiKey) return null;
  
  // Strip "Bearer " prefix if present
  const key = apiKey.replace(/^Bearer\s+/i, "");
  
  const keyData = API_KEYS[key];
  if (!keyData || !keyData.enabled) {
    return null;
  }
  
  return {
    tenantId: keyData.tenantId,
    name: keyData.name,
  };
}

// --- Token generation for Cube.js ---
function generateToken(tenantId) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payload = Buffer.from(JSON.stringify({
    tenantId,
    userId: "mcp-server",
    role: "admin",
    iat: Math.floor(Date.now() / 1000),
  }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${payload}.mcp-signature`;
}

// --- Cube.js API helper ---
async function cubeQuery(endpoint, body = null, tenantId) {
  const token = generateToken(tenantId);
  const options = {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (body) options.body = JSON.stringify(body);
  const resp = await fetch(`${CUBE_API_URL}${endpoint}`, options);
  return resp.json();
}

// --- Tool handlers (now receive tenantId from auth context) ---
async function handleListCubes(tenantId) {
  const meta = await cubeQuery("/cubejs-api/v1/meta", null, tenantId);
  const summary = meta.cubes?.map((cube) => ({
    name: cube.name,
    measures: cube.measures.map((m) => m.name),
    dimensions: cube.dimensions.map((d) => d.name),
  })) || [];
  return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
}

async function handleQueryAnalytics(args, tenantId) {
  const query = {
    measures: args.measures || [],
    dimensions: args.dimensions || [],
    filters: args.filters || [],
    timeDimensions: args.timeDimensions || [],
    limit: args.limit || 100,
  };
  
  console.log(`📊 Query for tenant ${tenantId}:`, JSON.stringify(query));
  
  const result = await cubeQuery("/cubejs-api/v1/load", { query }, tenantId);
  if (result?.error) {
    return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
  }
  return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
}

async function handleGetCubeSchema(args, tenantId) {
  const meta = await cubeQuery("/cubejs-api/v1/meta", null, tenantId);
  const cube = meta.cubes?.find(
    (c) => c.name.toLowerCase() === String(args.cubeName || "").toLowerCase()
  );
  if (!cube) {
    return { content: [{ type: "text", text: `Cube '${args.cubeName}' not found` }], isError: true };
  }
  const schema = {
    name: cube.name,
    measures: cube.measures.map((m) => ({ name: m.name, type: m.type, title: m.title })),
    dimensions: cube.dimensions.map((d) => ({ name: d.name, type: d.type, title: d.title })),
  };
  return { content: [{ type: "text", text: JSON.stringify(schema, null, 2) }] };
}

async function handleGetMyTenant(tenantId, tenantName) {
  return { 
    content: [{ 
      type: "text", 
      text: JSON.stringify({ tenantId, name: tenantName }, null, 2) 
    }] 
  };
}

// --- MCP Server factory (receives tenant context) ---
function createMcpServer(tenantId, tenantName) {
  const server = new McpServer({ 
    name: "cube-analytics", 
    version: "1.0.0",
  });

  // Tool to check current tenant (useful for debugging)
  server.tool(
    "whoami",
    "Show current authenticated tenant information",
    {},
    async () => handleGetMyTenant(tenantId, tenantName)
  );

  server.tool(
    "list_cubes", 
    "List all available analytics cubes", 
    {}, 
    async () => handleListCubes(tenantId)
  );

  server.tool(
    "query_analytics",
    "Query analytics data for your tenant. Returns metrics like order counts, revenue, etc.",
    {
      measures: { 
        type: "array", 
        items: { type: "string" }, 
        description: "Measures to query: Orders.count, Orders.totalAmount, Orders.avgAmount, Orders.totalQuantity" 
      },
      dimensions: { 
        type: "array", 
        items: { type: "string" }, 
        description: "Dimensions to group by: Orders.productCategory, Orders.status, Orders.region, Orders.createdAt" 
      },
      filters: {
        type: "array",
        items: { type: "object" },
        description: "Filters array: [{member: 'Orders.status', operator: 'equals', values: ['completed']}]"
      },
      timeDimensions: {
        type: "array",
        items: { type: "object" },
        description: "Time dimensions: [{dimension: 'Orders.createdAt', granularity: 'day'}]"
      },
      limit: { 
        type: "number", 
        description: "Max rows to return (default 100)" 
      },
    },
    async (args) => handleQueryAnalytics(args, tenantId)
  );

  server.tool(
    "get_cube_schema",
    "Get detailed schema for a specific cube including all measures and dimensions",
    { cubeName: { type: "string", description: "Cube name (e.g., Orders)" } },
    async (args) => handleGetCubeSchema(args, tenantId)
  );

  return server;
}

// --- Express app ---
const app = express();
app.use(cors());
app.use(express.json());

// Map to store transports by session ID
const transports = {};
// Map session ID to tenant context
const sessionTenants = {};

// --- Auth middleware for MCP endpoints ---
function extractApiKey(req) {
  // Try Authorization header first
  const authHeader = req.headers["authorization"];
  if (authHeader) {
    return authHeader;
  }
  
  // Try X-API-Key header
  const apiKeyHeader = req.headers["x-api-key"];
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  // Try query param (for SSE connections that can't set headers easily)
  if (req.query.api_key) {
    return req.query.api_key;
  }
  
  return null;
}

// POST handler - main MCP endpoint
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const apiKey = extractApiKey(req);
  
  console.log(`POST /mcp - sessionId: ${sessionId || "new"}, method: ${req.body?.method}, hasApiKey: ${!!apiKey}`);

  try {
    let transport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request - validate API key
      const tenant = validateApiKey(apiKey);
      
      if (!tenant) {
        console.log(`❌ Invalid or missing API key`);
        res.status(401).json({
          jsonrpc: "2.0",
          error: { 
            code: -32001, 
            message: "Unauthorized: Invalid or missing API key. Provide via Authorization header." 
          },
          id: req.body?.id || null,
        });
        return;
      }
      
      console.log(`✅ Authenticated as: ${tenant.name} (${tenant.tenantId})`);
      
      // Create new transport
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          console.log(`Session initialized: ${sid} for tenant ${tenant.tenantId}`);
          transports[sid] = transport;
          sessionTenants[sid] = tenant;
        },
      });

      // Cleanup when transport closes
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          console.log(`Transport closed for session ${sid}`);
          delete transports[sid];
          delete sessionTenants[sid];
        }
      };

      // Connect MCP server with tenant context
      const server = createMcpServer(tenant.tenantId, tenant.name);
      await server.connect(transport);
      
      // Handle the request
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

    // Handle request with existing transport
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// GET handler - SSE streams
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  
  console.log(`GET /mcp - SSE stream request for session: ${sessionId}`);
  
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// DELETE handler - session termination
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  
  console.log(`DELETE /mcp - session termination for: ${sessionId}`);
  
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error handling session termination:", error);
    if (!res.headersSent) {
      res.status(500).send("Error processing session termination");
    }
  }
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    cubeUrl: CUBE_API_URL,
    activeSessions: Object.keys(transports).length,
    loadedApiKeys: Object.keys(API_KEYS).length,
  });
});

// Root info
app.get("/", (_req, res) => {
  res.json({
    name: "cube-analytics-mcp",
    version: "1.0.0",
    endpoint: "/mcp",
    auth: "Required. Use Authorization: Bearer <api_key> header",
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🤖 MCP Server listening on http://0.0.0.0:${PORT}/mcp`);
  console.log(`   Cube.js: ${CUBE_API_URL}`);
  console.log(`   Auth: API Key required (Authorization header)`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  for (const sessionId in transports) {
    try {
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (e) {
      console.error(`Error closing session ${sessionId}:`, e);
    }
  }
  process.exit(0);
});
