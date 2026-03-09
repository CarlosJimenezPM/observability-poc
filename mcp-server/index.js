#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";

const CUBE_API_URL = process.env.CUBE_API_URL || "http://localhost:4000";
const PORT = process.env.MCP_PORT || 3001;

// Helper para llamar a Cube.js
async function cubeQuery(endpoint, body = null) {
  const options = {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
  };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(`${CUBE_API_URL}${endpoint}`, options);
  return response.json();
}

// Tool definitions
const tools = [
  {
    name: "list_cubes",
    description: "List all available analytics cubes with their measures and dimensions",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "query_analytics",
    description: "Query analytics data. Use measures like 'Orders.count', 'Orders.totalAmount' and dimensions like 'Orders.productCategory', 'Orders.region'",
    inputSchema: {
      type: "object",
      properties: {
        measures: {
          type: "array",
          items: { type: "string" },
          description: "Metrics to retrieve, e.g. ['Orders.count', 'Orders.totalAmount']"
        },
        dimensions: {
          type: "array", 
          items: { type: "string" },
          description: "Fields to group by, e.g. ['Orders.productCategory']"
        },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              member: { type: "string" },
              operator: { type: "string" },
              values: { type: "array", items: { type: "string" } }
            }
          },
          description: "Optional filters"
        },
        limit: {
          type: "number",
          description: "Max rows to return (default 100)"
        }
      },
      required: ["measures"]
    }
  },
  {
    name: "get_cube_schema",
    description: "Get detailed schema for a specific cube including all measures, dimensions and their types",
    inputSchema: {
      type: "object",
      properties: {
        cubeName: {
          type: "string",
          description: "Name of the cube, e.g. 'Orders'"
        }
      },
      required: ["cubeName"]
    }
  }
];

// Tool handler
async function handleToolCall(name, args) {
  switch (name) {
    case "list_cubes": {
      const meta = await cubeQuery("/cubejs-api/v1/meta");
      const summary = meta.cubes?.map(cube => ({
        name: cube.name,
        measures: cube.measures.map(m => m.name),
        dimensions: cube.dimensions.map(d => d.name)
      })) || [];
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
      };
    }

    case "query_analytics": {
      const query = {
        measures: args.measures || [],
        dimensions: args.dimensions || [],
        filters: args.filters || [],
        limit: args.limit || 100
      };
      const result = await cubeQuery("/cubejs-api/v1/load", { query });
      
      if (result.error) {
        return {
          content: [{ type: "text", text: `Error: ${result.error}` }],
          isError: true
        };
      }
      
      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
      };
    }

    case "get_cube_schema": {
      const meta = await cubeQuery("/cubejs-api/v1/meta");
      const cube = meta.cubes?.find(c => 
        c.name.toLowerCase() === args.cubeName.toLowerCase()
      );
      
      if (!cube) {
        return {
          content: [{ type: "text", text: `Cube '${args.cubeName}' not found` }],
          isError: true
        };
      }
      
      const schema = {
        name: cube.name,
        measures: cube.measures.map(m => ({
          name: m.name,
          type: m.type,
          title: m.title
        })),
        dimensions: cube.dimensions.map(d => ({
          name: d.name,
          type: d.type,
          title: d.title
        }))
      };
      
      return {
        content: [{ type: "text", text: JSON.stringify(schema, null, 2) }]
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true
      };
  }
}

// Factory: crea un nuevo Server MCP por conexión
function createMCPServer() {
  const server = new Server(
    { name: "cube-analytics", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await handleToolCall(name, args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true
      };
    }
  });

  return server;
}

// HTTP Server
const app = express();
app.use(cors());
app.use(express.json());

// Store active transports
const transports = new Map();

app.get("/sse", async (req, res) => {
  console.log("New SSE connection from", req.ip);
  
  // Crear servidor MCP nuevo para esta conexión
  const server = createMCPServer();
  const transport = new SSEServerTransport("/message", res);
  
  transports.set(transport, server);
  
  res.on("close", () => {
    transports.delete(transport);
    console.log("SSE connection closed");
  });
  
  await server.connect(transport);
});

app.post("/message", async (req, res) => {
  for (const [transport] of transports) {
    try {
      await transport.handlePostMessage(req, res);
      return;
    } catch (e) {
      // Try next transport
    }
  }
  res.status(400).json({ error: "No active connection" });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    cubeUrl: CUBE_API_URL,
    connections: transports.size
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🤖 MCP Server running on http://0.0.0.0:${PORT}`);
  console.log(`   Cube.js URL: ${CUBE_API_URL}`);
  console.log(`   SSE endpoint: /sse`);
});
