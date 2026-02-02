# VS Code Extension with Python Backend

A VS Code extension that communicates with a local FastAPI Python backend server. The server auto-discovers and registers endpoints based on system capabilities, and the extension queries these endpoints and displays available features in a UI.

## Architecture

The project consists of two main components:

1. **Python Backend Server** (FastAPI) - Runs locally, auto-discovers system capabilities, and registers dynamic endpoints
2. **VS Code Extension** (TypeScript) - Communicates with the backend via HTTP, queries available endpoints, and displays features in a UI

## Project Structure

```
project-root/
├── backend/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── discovery.py         # System capability discovery
│   ├── registry.py          # Endpoint registry
│   └── requirements.txt     # Python dependencies
├── extension/
│   ├── src/
│   │   ├── extension.ts     # Main extension entry point
│   │   ├── server.ts        # Backend server process management
│   │   ├── apiClient.ts     # HTTP client for backend communication
│   │   ├── discoveryService.ts  # Service to query and cache endpoints
│   │   └── treeView.ts      # Tree view provider for sidebar UI
│   ├── package.json         # Extension manifest
│   └── tsconfig.json        # TypeScript configuration
└── README.md
```

## Setup Instructions

### Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows: `venv\Scripts\activate`
   - On macOS/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Run the backend server:
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

   Or directly:
   ```bash
   python main.py
   ```

### Extension Setup

1. Navigate to the `extension` directory:
   ```bash
   cd extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile TypeScript:
   ```bash
   npm run compile
   ```

4. Open the project in VS Code and press `F5` to launch a new Extension Development Host window.

## Features

### Backend Features

- **Auto-discovery**: Scans the system for installed tools and commands
- **Dynamic endpoint registration**: Registers endpoints based on discovered capabilities
- **RESTful API**: Provides endpoints for discovery, health checks, and execution
- **Categories**: Organizes discovered endpoints by category (Tools, Python Tools, Node.js Tools, Git, System)

### Extension Features

- **Automatic server management**: Starts and stops the backend server automatically
- **Sidebar tree view**: Displays discovered endpoints organized by category
- **Status bar indicator**: Shows connection status and endpoint count
- **Endpoint execution**: Execute discovered endpoints directly from the UI
- **Auto-refresh**: Periodically refreshes the endpoint list

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/discover` - Returns all discovered endpoints
- `POST /api/execute/{endpoint_id}` - Execute a discovered endpoint
- `POST /api/refresh` - Refresh discovery and re-scan system

## Development

### Backend Development

The backend uses FastAPI and can be run in development mode with auto-reload:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Extension Development

Watch mode for TypeScript compilation:

```bash
npm run watch
```

## Usage

1. Install and activate the extension in VS Code
2. The extension will automatically start the backend server
3. Discovered endpoints will appear in the sidebar under "Discovered Endpoints"
4. Click on an endpoint to execute it
5. Use the refresh button to re-scan for new endpoints

## Requirements

- Python 3.8+
- Node.js 16+
- VS Code 1.74+

## License

MIT
