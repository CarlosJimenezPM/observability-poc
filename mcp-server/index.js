#!/usr/bin/env node
/**
 * MCP Streamable HTTP Server for Cube.js Analytics
 * Following the official SDK pattern from simpleStreamableHttp.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";

const CUBE_API_URL = process.env.CUBE_API_URL || "http://localhost:4000";
const PORT = Number(process.env.MCP_PORT || 3001);

// --- Token generation for Cube.js ---
function generateToken(tenantId = "mcp-server") {
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
async function cubeQuery(endpoint, body = null, tenantId = null) {
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

// --- Tool handlers ---
async function handleListCubes() {
  const meta = await cubeQuery("/cubejs-api/v1/meta");
  const summary = meta.cubes?.map((cube) => ({
    name: cube.name,
    measures: cube.measures.map((m) => m.name),
    dimensions: cube.dimensions.map((d) => d.name),
  })) || [];
  return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
}

async function handleQueryAnalytics(args = {}) {
  const tenantId = args.tenantId || "tenant_A";
  const query = {
    measures: args.measures || [],
    dimensions: args.dimensions || [],
    filters: args.filters || [],
    limit: args.limit || 100,
  };
  const result = await cubeQuery("/cubejs-api/v1/load", { query }, tenantId);
  if (result?.error) {
    return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
  }
  return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
}

async function handleGetCubeSchema(args = {}) {
  const meta = await cubeQuery("/cubejs-api/v1/meta");
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

// --- MCP Server factory ---
function createMcpServer() {
  const server = new McpServer({ name: "cube-analytics", version: "1.0.0" });

  server.tool("list_cubes", "List all available analytics cubes", {}, async () => handleListCubes());

  server.tool(
    "query_analytics",
    "Query analytics data from the observability platform",
    {
      tenantId: { type: "string", description: "Tenant ID (tenant_A, tenant_B, tenant_C)" },
      measures: { type: "array", items: { type: "string" }, description: "Measures like Orders.count" },
      dimensions: { type: "array", items: { type: "string" }, description: "Dimensions like Orders.region" },
      limit: { type: "number", description: "Max rows (default 100)" },
    },
    async (args) => handleQueryAnalytics(args)
  );

  server.tool(
    "get_cube_schema",
    "Get detailed schema for a specific cube",
    { cubeName: { type: "string", description: "Cube name like Orders" } },
    async (args) => handleGetCubeSchema(args)
  );

  return server;
}

// --- Express app ---
const app = express();
app.use(cors());
app.use(express.json());

// Map to store transports by session ID
const transports = {};

// POST handler - main MCP endpoint
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  
  console.log(`POST /mcp - sessionId: ${sessionId || "new"}, method: ${req.body?.method}`);

  try {
    let transport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request - create new transport
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          // Store transport AFTER session is initialized
          console.log(`Session initialized: ${sid}`);
          transports[sid] = transport;
        },
      });

      // Cleanup when transport closes
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}`);
          delete transports[sid];
        }
      };

      // Connect MCP server to transport BEFORE handling request
      const server = createMcpServer();
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
  });
});

// Root info
app.get("/", (_req, res) => {
  res.json({
    name: "cube-analytics-mcp",
    version: "1.0.0",
    endpoint: "/mcp",
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🤖 MCP Server listening on http://0.0.0.0:${PORT}/mcp`);
  console.log(`   Cube.js: ${CUBE_API_URL}`);
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
