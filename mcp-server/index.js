#!/usr/bin/env node
/**
 * MCP Streamable HTTP Server for Cube.js Analytics
 * Entry point - Express app and session management
 */

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";

import { initAuth, closeAuth, validateApiKey, extractApiKey, getAuthStatus } from "./lib/auth.js";
import { getCubeUrl } from "./lib/cube-client.js";
import { createMcpServer } from "./lib/mcp-factory.js";

const PORT = Number(process.env.MCP_PORT || 3001);

// Session storage
const transports = {};
const sessionTenants = {};

// --- Express app ---
const app = express();
app.use(cors());
app.use(express.json());

// --- POST /mcp - Main MCP endpoint ---
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
      // New initialization - validate API key
      const tenant = await validateApiKey(apiKey);
      
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
      
      console.log(`✅ Authenticated as: ${tenant.name} (${tenant.tenantId}) via ${tenant.source}`);
      
      // Create new transport
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          console.log(`Session initialized: ${sid} for tenant ${tenant.tenantId}`);
          transports[sid] = transport;
          sessionTenants[sid] = tenant;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          console.log(`Transport closed for session ${sid}`);
          delete transports[sid];
          delete sessionTenants[sid];
        }
      };

      // Connect MCP server with tenant context
      const server = createMcpServer(tenant.tenantId, tenant.name, tenant.source);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

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

// --- GET /mcp - SSE streams ---
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  
  console.log(`GET /mcp - SSE stream request for session: ${sessionId}`);
  
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  await transports[sessionId].handleRequest(req, res);
});

// --- DELETE /mcp - Session termination ---
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  
  console.log(`DELETE /mcp - session termination for: ${sessionId}`);
  
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  try {
    await transports[sessionId].handleRequest(req, res);
  } catch (error) {
    console.error("Error handling session termination:", error);
    if (!res.headersSent) {
      res.status(500).send("Error processing session termination");
    }
  }
});

// --- Health check ---
app.get("/health", (_req, res) => {
  const authStatus = getAuthStatus();
  res.json({
    status: "ok",
    cubeUrl: getCubeUrl(),
    activeSessions: Object.keys(transports).length,
    ...authStatus,
  });
});

// --- Root info ---
app.get("/", (_req, res) => {
  const authStatus = getAuthStatus();
  res.json({
    name: "cube-analytics-mcp",
    version: "1.0.0",
    endpoint: "/mcp",
    auth: "Required. Use Authorization: Bearer <api_key> header",
    authSource: authStatus.source,
  });
});

// --- Startup ---
async function start() {
  await initAuth();
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🤖 MCP Server listening on http://0.0.0.0:${PORT}/mcp`);
    console.log(`   Cube.js: ${getCubeUrl()}`);
    console.log(`   Auth: ${getAuthStatus().source}`);
  });
}

start();

// --- Graceful shutdown ---
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
  
  await closeAuth();
  process.exit(0);
});
