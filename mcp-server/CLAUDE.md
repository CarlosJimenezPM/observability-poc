# mcp-server/CLAUDE.md

## Overview

MCP (Model Context Protocol) server for AI agent integration. Allows Claude Desktop or other MCP clients to query analytics securely.

## Structure

```
mcp-server/
├── index.js              # Entry point: Express app, session management
├── lib/
│   ├── auth.js           # API key validation (PostgreSQL + JSON fallback)
│   ├── cube-client.js    # Cube.js API helper
│   ├── mcp-factory.js    # MCP server factory with tool registration
│   └── tools.js          # Tool handlers (whoami, query_analytics, etc.)
├── manage-keys.js        # CLI for API key management
├── test-mcp.js           # Test suite
├── api-keys.json         # API keys (gitignored in prod)
└── README.md             # Setup instructions
```

## Running

```bash
# Via Docker
make up   # MCP server on :3001

# Local
cd mcp-server
npm install
node index.js
```

## Testing

```bash
cd mcp-server
node test-mcp.js              # Full test suite
API_KEY=ak_xxx node test-mcp.js  # Test specific key
```

## Auth Model

- **API keys** bound to tenant (not JWTs)
- Key format: `ak_<tenant>_<random>` (e.g., `ak_tenant_a_6835307c...`)
- Keys stored in `api-keys.json` (dev) or PostgreSQL (prod)
- **Tenant derived from key** — AI agent cannot choose tenant

## Module Responsibilities

| Module | Purpose |
|--------|---------|
| `index.js` | Express routes, session lifecycle, startup/shutdown |
| `lib/auth.js` | API key validation, PostgreSQL/JSON fallback |
| `lib/cube-client.js` | JWT generation, Cube.js API calls |
| `lib/mcp-factory.js` | MCP server creation, tool registration with Zod schemas |
| `lib/tools.js` | Business logic for each tool |

## Adding a Tool

1. Add handler in `lib/tools.js`:
```javascript
export async function handleMyTool(args, tenantId) {
  // ... logic
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
```

2. Register in `lib/mcp-factory.js`:
```javascript
import { handleMyTool } from "./tools.js";

server.tool(
  "my_tool",
  "Description",
  { param: z.string().describe("...") },
  async (args) => handleMyTool(args, tenantId)
);
```

## Security Notes

- Always validate `tenantId` from the API key, never from request params
- Use Zod schemas for input validation
- Log auth failures but don't leak key details
