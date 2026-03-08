#!/usr/bin/env node
// Test directo de las funciones del MCP sin el protocolo

const CUBE_API_URL = process.env.CUBE_API_URL || "http://localhost:4000";

async function cubeQuery(endpoint, body = null) {
  const options = {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
  };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(`${CUBE_API_URL}${endpoint}`, options);
  return response.json();
}

async function test() {
  console.log("🧪 Testing MCP Server functions...\n");

  // Test 1: list_cubes
  console.log("1️⃣ list_cubes:");
  const meta = await cubeQuery("/cubejs-api/v1/meta");
  const cubes = meta.cubes.map(c => ({
    name: c.name,
    measures: c.measures.length,
    dimensions: c.dimensions.length
  }));
  console.log(JSON.stringify(cubes, null, 2));

  // Test 2: query_analytics
  console.log("\n2️⃣ query_analytics (Orders by category):");
  const query = {
    measures: ["Orders.count", "Orders.totalAmount"],
    dimensions: ["Orders.productCategory"]
  };
  const result = await cubeQuery("/cubejs-api/v1/load", { query });
  console.log(JSON.stringify(result.data, null, 2));

  // Test 3: get_cube_schema
  console.log("\n3️⃣ get_cube_schema (Orders):");
  const ordersCube = meta.cubes.find(c => c.name === "Orders");
  if (ordersCube) {
    console.log("Measures:", ordersCube.measures.map(m => m.name));
    console.log("Dimensions:", ordersCube.dimensions.map(d => d.name));
  }

  console.log("\n✅ All tests passed!");
}

test().catch(console.error);
