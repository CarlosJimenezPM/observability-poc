# mcp-server/CLAUDE.md

## Overview

MCP (Model Context Protocol) server for AI agent integration. Allows Claude Desktop or other MCP clients to query analytics securely.

## Key Files

```
mcp-server/
├── index.js          # Main server, tool definitions, auth
├── manage-keys.js    # CLI for API key management
├── test-mcp.js       # Test suite (run with node)
├── api-keys.json     # API keys (gitignored in prod)
└── README.md         # Setup instructions
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

## Available Tools

| Tool | Description |
|------|-------------|
| `whoami` | Returns authenticated tenant info |
| `list_cubes` | Lists available Cube.js models |
| `query_analytics` | Query metrics (orders, revenue, etc.) |
| `get_cube_schema` | Get schema for a specific cube |

## Adding a Tool

In `index.js`, find the tools array and add:

```javascript
{
  name: "my_tool",
  description: "What it does",
  inputSchema: {
    type: "object",
    properties: {
      param: { type: "string", description: "..." }
    },
    required: ["param"]
  }
}
```

Then handle it in the `tools/call` switch statement.

## Security Notes

- Always validate `tenantId` from the API key, never from request params
- Use Zod schemas for input validation
- Log auth failures but don't leak key details
