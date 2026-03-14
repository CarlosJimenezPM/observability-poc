/**
 * MCP Tool Handlers
 */

import { cubeQuery } from "./cube-client.js";

// --- whoami ---
export async function handleWhoami(tenantId, tenantName, authSource) {
  return { 
    content: [{ 
      type: "text", 
      text: JSON.stringify({ tenantId, name: tenantName, authSource }, null, 2) 
    }] 
  };
}

// --- list_cubes ---
export async function handleListCubes(tenantId) {
  const meta = await cubeQuery("/cubejs-api/v1/meta", null, tenantId);
  
  const summary = meta.cubes?.map((cube) => ({
    name: cube.name,
    measures: cube.measures.map((m) => m.name),
    dimensions: cube.dimensions.map((d) => d.name),
  })) || [];
  
  return { 
    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] 
  };
}

// --- query_analytics ---
export async function handleQueryAnalytics(args, tenantId) {
  console.log(`🔍 Raw args received:`, JSON.stringify(args));
  
  const params = args.arguments || args.params || args;
  
  const query = {
    measures: params.measures || [],
    dimensions: params.dimensions || [],
    filters: params.filters || [],
    timeDimensions: params.timeDimensions || [],
    limit: params.limit || 100,
  };
  
  console.log(`📊 Query for tenant ${tenantId}:`, JSON.stringify(query));
  
  const result = await cubeQuery("/cubejs-api/v1/load", { query }, tenantId);
  
  if (result?.error) {
    return { 
      content: [{ type: "text", text: `Error: ${result.error}` }], 
      isError: true 
    };
  }
  
  return { 
    content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] 
  };
}

// --- get_cube_schema ---
export async function handleGetCubeSchema(args, tenantId) {
  const meta = await cubeQuery("/cubejs-api/v1/meta", null, tenantId);
  
  const cube = meta.cubes?.find(
    (c) => c.name.toLowerCase() === String(args.cubeName || "").toLowerCase()
  );
  
  if (!cube) {
    return { 
      content: [{ type: "text", text: `Cube '${args.cubeName}' not found` }], 
      isError: true 
    };
  }
  
  const schema = {
    name: cube.name,
    measures: cube.measures.map((m) => ({ 
      name: m.name, 
      type: m.type, 
      title: m.title 
    })),
    dimensions: cube.dimensions.map((d) => ({ 
      name: d.name, 
      type: d.type, 
      title: d.title 
    })),
  };
  
  return { 
    content: [{ type: "text", text: JSON.stringify(schema, null, 2) }] 
  };
}
