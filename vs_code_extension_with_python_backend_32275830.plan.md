---
name: VS Code Extension with Python Backend
overview: Create a VS Code extension that communicates with a local FastAPI Python backend server. The server will auto-discover and register endpoints based on system capabilities, and the extension will query these endpoints and display available features in a UI.
todos:
  - id: setup-backend
    content: "Create FastAPI backend with basic structure: main.py, discovery.py, registry.py, and requirements.txt"
    status: pending
  - id: implement-discovery
    content: Implement auto-discovery mechanism that scans system and registers endpoints dynamically
    status: pending
    dependencies:
      - setup-backend
  - id: create-api-endpoints
    content: Create /api/discover, /api/health, and /api/execute endpoints in FastAPI
    status: pending
    dependencies:
      - setup-backend
      - implement-discovery
  - id: setup-extension
    content: Initialize VS Code extension project structure with package.json, tsconfig.json, and basic extension.ts
    status: pending
  - id: implement-http-client
    content: Create HTTP client service in extension to communicate with backend server
    status: pending
    dependencies:
      - setup-extension
  - id: implement-discovery-service
    content: Create discovery service that queries backend and caches available endpoints
    status: pending
    dependencies:
      - implement-http-client
      - create-api-endpoints
  - id: create-ui-components
    content: Implement sidebar tree view and status bar UI components to display discovered endpoints
    status: pending
    dependencies:
      - implement-discovery-service
  - id: server-management
    content: Add backend server process management (start/stop) in extension
    status: pending
    dependencies:
      - setup-extension
---

# VS Code Extension with Python Backend Server

## Architecture Overview

The project consists of two main components:

1. **Python Backend Server** (FastAPI) - Runs locally, auto-discovers system capabilities, and registers dynamic endpoints
2. **VS Code Extension** (TypeScript) - Communicates with the backend via HTTP, queries available endpoints, and displays features in a UI

## Component Structure

### Backend Server (`backend/`)

- **FastAPI application** with dynamic endpoint registration
- **Discovery module** that scans the system and registers endpoints based on detected capabilities
- **Endpoint registry** to manage available endpoints
- **Health check endpoint** for extension connectivity
- **Discovery endpoint** (`/api/discover`) that returns all registered endpoints with metadata

### VS Code Extension (`extension/`)

- **Extension activation** that starts/stops the backend server process
- **HTTP client service** using Node.js `https` module or `node-fetch` for communication
- **Discovery service** that queries the backend for available endpoints
- **UI components**:
  - Sidebar tree view showing available endpoints/features
  - Status bar indicator showing connection status
  - Command palette commands for discovered features

## Implementation Details

### Backend (Python/FastAPI)

**Key Files:**

- `backend/main.py` - FastAPI app with dynamic routing
- `backend/discovery.py` - System capability discovery logic
- `backend/registry.py` - Endpoint registry and management
- `backend/requirements.txt` - Dependencies (FastAPI, uvicorn)

**Discovery Mechanism:**

- Scan for installed tools/commands in PATH
- Check for specific files/configurations in the workspace
- Register endpoints dynamically based on findings
- Provide metadata (name, description, parameters) for each endpoint

**API Endpoints:**

- `GET /api/discover` - Returns list of all registered endpoints
- `GET /api/health` - Health check
- `POST /api/execute/{endpoint_id}` - Execute a discovered endpoint

### Extension (TypeScript)

**Key Files:**

- `extension/src/extension.ts` - Main extension entry point
- `extension/src/server.ts` - Backend server process management
- `extension/src/apiClient.ts` - HTTP client for backend communication
- `extension/src/discoveryService.ts` - Service to query and cache discovered endpoints
- `extension/src/treeView.ts` - Tree view provider for sidebar UI
- `extension/package.json` - Extension manifest

**Communication:**

- Use Node.js `https` module or `node-fetch` for HTTP requests
- Default server URL: `http://localhost:8000`
- Handle connection errors gracefully
- Poll for endpoint updates periodically

**UI Components:**

- Tree view in sidebar showing discovered endpoints grouped by category
- Status bar item showing "Connected" or "Disconnected"
- Context menu actions on tree items to execute endpoints

## Example References

- **FastAPI Tutorial**: [VS Code FastAPI Tutorial](https://code.visualstudio.com/docs/python/tutorial-fastapi)
- **Extension Samples**: [vscode-extension-samples](https://github.com/microsoft/vscode-extension-samples)
- **Tree View Example**: Extension samples include tree view implementations

## Development Workflow

1. Backend runs as a separate process (can be started manually or by extension)
2. Extension activates and connects to backend on startup
3. Extension queries `/api/discover` to get available endpoints
4. Extension updates UI based on discovered endpoints
5. User can interact with discovered features through the UI

## Project Structure

```
project-root/
├── backend/
│   ├── main.py
│   ├── discovery.py
│   ├── registry.py
│   └── requirements.txt
├── extension/
│   ├── src/
│   │   ├── extension.ts
│   │   ├── server.ts
│   │   ├── apiClient.ts
│   │   ├── discoveryService.ts
│   │   └── treeView.ts
│   ├── package.json
│   └── tsconfig.json
└── README.md
```