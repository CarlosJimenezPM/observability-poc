#!/usr/bin/env node
/**
 * MCP Server Test Suite
 * Tests the MCP server directly without Claude Desktop
 */

const API_KEY = process.env.API_KEY || "ak_tenant_a_6835307c5329e26c5b99b15371b42bf9d41823e8";
const MCP_URL = process.env.MCP_URL || "http://localhost:3001/mcp";

let sessionId = null;
let requestId = 0;

async function mcpRequest(method, params = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_KEY}`,
    "Accept": "application/json, text/event-stream",
  };
  
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }
  
  const body = {
    jsonrpc: "2.0",
    method,
    params,
    id: ++requestId,
  };
  
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  
  // Capture session ID from response headers
  const newSessionId = response.headers.get("mcp-session-id");
  if (newSessionId) {
    sessionId = newSessionId;
  }
  
  const text = await response.text();
  
  // Handle SSE-style response (event: message\ndata: {...})
  if (text.includes("data:")) {
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data:")) {
        try {
          return JSON.parse(line.slice(5).trim());
        } catch (e) {
          // Continue to next line
        }
      }
    }
  }
  
  try {
    return JSON.parse(text);
  } catch (e) {
    return { raw: text, status: response.status };
  }
}

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log("✅");
    return true;
  } catch (error) {
    console.log(`❌ ${error.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ============================================
// TEST CASES
// ============================================

async function testInitialize() {
  const result = await mcpRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  });
  
  assert(result.result, "Should return result");
  assert(result.result.serverInfo, "Should have serverInfo");
  assert(sessionId, "Should set session ID");
  console.log(`    Session: ${sessionId}`);
}

async function testToolsList() {
  const result = await mcpRequest("tools/list", {});
  
  assert(result.result, "Should return result");
  assert(result.result.tools, "Should have tools array");
  assert(result.result.tools.length >= 3, "Should have at least 3 tools");
  
  const toolNames = result.result.tools.map(t => t.name);
  console.log(`    Tools: ${toolNames.join(", ")}`);
  
  // Check query_analytics has proper schema
  const queryTool = result.result.tools.find(t => t.name === "query_analytics");
  assert(queryTool, "Should have query_analytics tool");
  assert(queryTool.inputSchema, "query_analytics should have inputSchema");
  assert(queryTool.inputSchema.properties, "inputSchema should have properties");
  assert(queryTool.inputSchema.properties.measures, "Should have measures property");
  
  console.log(`    query_analytics schema: ${JSON.stringify(Object.keys(queryTool.inputSchema.properties || {}))}`);
}

async function testWhoami() {
  const result = await mcpRequest("tools/call", {
    name: "whoami",
    arguments: {}
  });
  
  assert(result.result, "Should return result");
  assert(result.result.content, "Should have content");
  
  const content = JSON.parse(result.result.content[0].text);
  assert(content.tenantId === "tenant_A", "Should be tenant_A");
  console.log(`    Tenant: ${content.tenantId}, Auth: ${content.authSource}`);
}

async function testListCubes() {
  const result = await mcpRequest("tools/call", {
    name: "list_cubes",
    arguments: {}
  });
  
  assert(result.result, "Should return result");
  assert(result.result.content, "Should have content");
  
  const cubes = JSON.parse(result.result.content[0].text);
  assert(Array.isArray(cubes), "Should return array of cubes");
  console.log(`    Cubes: ${cubes.map(c => c.name).join(", ")}`);
}

async function testGetCubeSchema() {
  const result = await mcpRequest("tools/call", {
    name: "get_cube_schema",
    arguments: { cubeName: "Orders" }
  });
  
  assert(result.result, "Should return result");
  assert(result.result.content, "Should have content");
  
  const schema = JSON.parse(result.result.content[0].text);
  assert(schema.name === "Orders", "Should return Orders cube");
  assert(schema.measures, "Should have measures");
  assert(schema.dimensions, "Should have dimensions");
  console.log(`    Measures: ${schema.measures.map(m => m.name).join(", ")}`);
}

async function testQueryAnalyticsCount() {
  const result = await mcpRequest("tools/call", {
    name: "query_analytics",
    arguments: {
      measures: ["Orders.count"]
    }
  });
  
  console.log(`    Raw result: ${JSON.stringify(result).slice(0, 200)}`);
  
  assert(result.result, "Should return result");
  assert(result.result.content, "Should have content");
  
  const data = JSON.parse(result.result.content[0].text);
  assert(Array.isArray(data), "Should return array");
  console.log(`    Orders count: ${data[0]?.["Orders.count"] || "N/A"}`);
}

async function testQueryAnalyticsWithDimensions() {
  const result = await mcpRequest("tools/call", {
    name: "query_analytics",
    arguments: {
      measures: ["Orders.count", "Orders.totalAmount"],
      dimensions: ["Orders.status"]
    }
  });
  
  assert(result.result, "Should return result");
  
  const data = JSON.parse(result.result.content[0].text);
  console.log(`    Results by status: ${data.length} rows`);
}

async function testQueryAnalyticsWithFilters() {
  const result = await mcpRequest("tools/call", {
    name: "query_analytics",
    arguments: {
      measures: ["Orders.count"],
      filters: [
        { member: "Orders.status", operator: "equals", values: ["completed"] }
      ]
    }
  });
  
  assert(result.result, "Should return result");
  
  const data = JSON.parse(result.result.content[0].text);
  console.log(`    Completed orders: ${data[0]?.["Orders.count"] || "N/A"}`);
}

async function testInvalidApiKey() {
  const savedKey = API_KEY;
  const savedSession = sessionId;
  sessionId = null; // Force new session
  
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer invalid_key_12345",
  };
  
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {} },
      id: 999,
    }),
  });
  
  sessionId = savedSession; // Restore
  
  assert(response.status === 401, `Should return 401, got ${response.status}`);
  console.log(`    Correctly rejected with 401`);
}

// ============================================
// RUN TESTS
// ============================================

async function main() {
  console.log("\n🧪 MCP Server Test Suite\n");
  console.log(`   URL: ${MCP_URL}`);
  console.log(`   API Key: ${API_KEY.slice(0, 20)}...`);
  console.log("");
  
  let passed = 0;
  let failed = 0;
  
  console.log("1️⃣  Authentication & Session");
  if (await test("Initialize session", testInitialize)) passed++; else failed++;
  if (await test("Reject invalid API key", testInvalidApiKey)) passed++; else failed++;
  
  console.log("\n2️⃣  Tool Discovery");
  if (await test("List tools with schemas", testToolsList)) passed++; else failed++;
  
  console.log("\n3️⃣  Basic Tools");
  if (await test("whoami - check tenant", testWhoami)) passed++; else failed++;
  if (await test("list_cubes - list available cubes", testListCubes)) passed++; else failed++;
  if (await test("get_cube_schema - Orders schema", testGetCubeSchema)) passed++; else failed++;
  
  console.log("\n4️⃣  Query Analytics");
  if (await test("Simple count query", testQueryAnalyticsCount)) passed++; else failed++;
  if (await test("Query with dimensions", testQueryAnalyticsWithDimensions)) passed++; else failed++;
  if (await test("Query with filters", testQueryAnalyticsWithFilters)) passed++; else failed++;
  
  console.log("\n" + "═".repeat(50));
  console.log(`   Results: ${passed} passed, ${failed} failed`);
  console.log("═".repeat(50) + "\n");
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
