# frontend/CLAUDE.md

## Overview

React demo app for the observability PoC. Shows multi-tenant login and dashboard.

## Stack

- **React 18** with Vite
- **Plain CSS** (inline styles in components)
- **No state management library** — useState/useEffect only

## Structure

```
frontend/
├── src/
│   ├── App.jsx           # Main app, auth state, layout
│   ├── main.jsx          # Entry point
│   ├── api/              # API client helpers
│   └── components/
│       ├── Login.jsx     # Tenant selector
│       ├── Dashboard.jsx # Charts from Cube.js
│       └── OrderForm.jsx # Create orders (writes to PG)
├── server.js             # Express backend (JWT, proxy to Cube.js)
└── vite.config.js
```

## Running

```bash
# Via Docker (recommended)
make up   # Starts frontend on :3000

# Local dev
cd frontend
npm install
npm run dev      # Vite dev server
node server.js   # Backend API (separate terminal)
```

## Key Points

- **Auth flow**: Login.jsx creates a JWT with selected tenant → stored in App state → passed to Dashboard/OrderForm
- **Writes go to PostgreSQL** via `server.js` → CDC replicates to ClickHouse
- **Dashboard queries Cube.js** with JWT → Cube.js enforces tenant isolation

## Style Guide

- Inline styles (no CSS files) — keeps components self-contained
- Functional components only
- No prop drilling beyond 2 levels — lift state up if needed

## Adding a Component

1. Create `src/components/MyComponent.jsx`
2. Define styles object at top of file
3. Export default function component
4. Import in parent (App.jsx or another component)
