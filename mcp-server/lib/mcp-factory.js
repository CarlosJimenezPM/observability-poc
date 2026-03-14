/**
 * MCP Server Factory
 * Creates MCP server instances with tenant context
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleWhoami, 
  handleListCubes, 
  handleQueryAnalytics, 
  handleGetCubeSchema 
} from "./tools.js";

// --- Tool schemas ---
const queryAnalyticsSchema = {
  measures: z.array(z.string())
    .describe("Measures to query, e.g. ['Orders.count', 'Orders.totalAmount']"),
  dimensions: z.array(z.string())
    .optional()
    .describe("Dimensions to group by, e.g. ['Orders.status', 'Orders.region']"),
  filters: z.array(z.object({
    member: z.string(),
    operator: z.string(),
    values: z.array(z.string())
  }))
    .optional()
    .describe("Filters array"),
  timeDimensions: z.array(z.object({
    dimension: z.string(),
    granularity: z.string().optional(),
    dateRange: z.string().optional()
  }))
    .optional()
    .describe("Time dimensions"),
  limit: z.number()
    .optional()
    .describe("Max rows to return (default 100)")
};

const getCubeSchemaArgs = {
  cubeName: z.string().describe("Cube name, e.g. 'Orders'")
};

// --- Create MCP Server with tenant context ---
export function createMcpServer(tenantId, tenantName, authSource) {
  const server = new McpServer({ 
    name: "cube-analytics", 
    version: "1.0.0",
  });

  server.tool(
    "whoami",
    "Show current authenticated tenant information",
    {},
    async () => handleWhoami(tenantId, tenantName, authSource)
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
    queryAnalyticsSchema,
    async (args) => handleQueryAnalytics(args, tenantId)
  );

  server.tool(
    "get_cube_schema",
    "Get detailed schema for a specific cube including all measures and dimensions",
    getCubeSchemaArgs,
    async (args) => handleGetCubeSchema(args, tenantId)
  );

  return server;
}
