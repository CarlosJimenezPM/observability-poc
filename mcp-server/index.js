#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const CUBE_API_URL = process.env.CUBE_API_URL || "http://localhost:4000";

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

// Crear servidor MCP
const server = new Server(
  { name: "cube-analytics", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Definir herramientas disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
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
  ]
}));

// Manejar llamadas a herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_cubes": {
        const meta = await cubeQuery("/cubejs-api/v1/meta");
        const summary = meta.cubes.map(cube => ({
          name: cube.name,
          measures: cube.measures.map(m => m.name),
          dimensions: cube.dimensions.map(d => d.name)
        }));
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
        const cube = meta.cubes.find(c => 
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
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cube MCP Server running on stdio");
}

main().catch(console.error);
