/**
 * Cube.js API Client
 */

const CUBE_API_URL = process.env.CUBE_API_URL || "http://localhost:4000";

// --- Generate JWT token for Cube.js ---
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

// --- Query Cube.js API ---
export async function cubeQuery(endpoint, body = null, tenantId) {
  const token = generateToken(tenantId);
  
  const options = {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const resp = await fetch(`${CUBE_API_URL}${endpoint}`, options);
  return resp.json();
}

// --- Get Cube.js URL ---
export function getCubeUrl() {
  return CUBE_API_URL;
}
