# Extension Startup Flow

A step-by-step breakdown of what happens when the VS Code extension starts.

## Overview Timeline

```
VS Code Loads Extension
    ↓
activate() called
    ↓
Initialize Components
    ↓
Register Commands & UI
    ↓
Start Backend Server
    ↓
Wait for Server Ready
    ↓
Discover Endpoints
    ↓
Update UI
    ↓
Ready!
```

## Detailed Step-by-Step

### Step 1: Extension Activation

**File:** `extension/src/extension.ts`  
**Function:** `activate(context: vscode.ExtensionContext)`

```typescript
export function activate(context: vscode.ExtensionContext) {
    // VS Code calls this when extension is activated
}
```

**What happens:**
- VS Code calls `activate()` when the extension loads
- Receives `ExtensionContext` (like dependency injection container)
- Logs extension paths for debugging

**C# Analogy:**
```csharp
public class Extension : IExtension {
    public void Activate(IExtensionContext context) {
        // Extension startup code
    }
}
```

---

### Step 2: Initialize Core Components

**Lines 22-29 in extension.ts**

```typescript
// Create component instances
serverManager = new ServerManager(context);      // Manages Python backend process
apiClient = new ApiClient();                     // HTTP client for API calls
discoveryService = new DiscoveryService(apiClient);  // Caches discovered endpoints
treeProvider = new EndpointTreeProvider(discoveryService);  // Tree view data provider
```

**What happens:**
1. **ServerManager** - Created but server not started yet
2. **ApiClient** - HTTP client ready (defaults to `http://localhost:8000`)
3. **DiscoveryService** - Wraps ApiClient, manages endpoint cache
4. **EndpointTreeProvider** - Provides data for sidebar tree view

**C# Analogy:**
```csharp
_serverManager = new ServerManager(context);
_apiClient = new ApiClient();
_discoveryService = new DiscoveryService(_apiClient);
_treeProvider = new EndpointTreeProvider(_discoveryService);
```

---

### Step 3: Create UI Components

**Lines 31-41 in extension.ts**

```typescript
// Status bar item (shows connection status)
statusBarItem = vscode.window.createStatusBarItem(...);
statusBarItem.command = 'extension.refreshEndpoints';

// Tree view (sidebar showing discovered endpoints)
const treeView = vscode.window.createTreeView('discoveredEndpoints', {
    treeDataProvider: treeProvider
});
```

**What happens:**
- Creates status bar item (bottom right of VS Code)
- Creates tree view in sidebar (shows endpoints organized by category)
- UI is created but empty until endpoints are discovered

**C# Analogy:**
```csharp
_statusBarItem = new StatusBarItem { Command = "RefreshEndpoints" };
_treeView = new TreeView { DataProvider = _treeProvider };
```

---

### Step 4: Register Commands

**Lines 43-85 in extension.ts**

```typescript
// Register command handlers
vscode.commands.registerCommand('extension.refreshEndpoints', ...);
vscode.commands.registerCommand('extension.executeEndpoint', ...);
vscode.commands.registerCommand('extension.openBlockEditor', ...);
```

**What happens:**
- Registers 3 commands that users can invoke:
  1. **Refresh Endpoints** - Re-discovers endpoints
  2. **Execute Endpoint** - Runs a single endpoint
  3. **Open Block Editor** - Opens the visual block editor

**C# Analogy:**
```csharp
Commands.Register("RefreshEndpoints", async () => { ... });
Commands.Register("ExecuteEndpoint", async (endpointId) => { ... });
Commands.Register("OpenBlockEditor", () => { ... });
```

---

### Step 5: Start Initialization

**Line 88 in extension.ts**

```typescript
initializeExtension();  // Called asynchronously
```

**What happens:**
- Calls `initializeExtension()` function
- This is **async** but not awaited, so it runs in background
- Extension activation completes immediately (non-blocking)

**C# Analogy:**
```csharp
_ = InitializeExtensionAsync();  // Fire and forget
```

---

### Step 6: Start Backend Server

**File:** `extension/src/server.ts`  
**Function:** `startServer()`

**Sub-steps:**

#### 6a. Find Backend Directory
```typescript
const extensionPath = this.context.extensionPath;  // e.g., ".../extension"
const backendPath = path.join(extensionPath, '..', 'backend');  // ".../backend"
```

#### 6b. Verify Backend Exists
```typescript
if (!fs.existsSync(backendPath)) {
    throw new Error('Backend directory not found');
}
if (!fs.existsSync(path.join(backendPath, 'main.py'))) {
    throw new Error('main.py not found');
}
```

#### 6c. Find Python Executable
```typescript
const pythonPath = await this.findPython();
// Checks for:
// 1. Virtual environment (.venv/Scripts/python.exe)
// 2. System Python (python3, python, py)
```

#### 6d. Start Python Process
```typescript
this.serverProcess = spawn(pythonPath, [
    '-m', 'uvicorn', 
    'main:app', 
    '--host', '0.0.0.0', 
    '--port', '8000'
], {
    cwd: backendPath  // Run from backend directory
});
```

**What happens:**
- Spawns a Python subprocess running FastAPI/uvicorn
- Server starts on `http://localhost:8000`
- Process output is logged to console

**C# Analogy:**
```csharp
var process = new Process {
    StartInfo = new ProcessStartInfo {
        FileName = pythonPath,
        Arguments = "-m uvicorn main:app --host 0.0.0.0 --port 8000",
        WorkingDirectory = backendPath
    }
};
process.Start();
```

---

### Step 7: Wait for Server Process

**Lines 88-96 in server.ts**

```typescript
// Wait 1 second for process to initialize
await new Promise(resolve => setTimeout(resolve, 1000));

// Check if process is still running
if (!this.serverProcess || this.serverProcess.killed) {
    throw new Error('Server failed to start');
}
```

**What happens:**
- Waits 1 second for Python process to start
- Verifies process didn't crash immediately
- If process died, throws error

---

### Step 8: Wait for Server to be Ready

**Function:** `waitForServerReady()`

```typescript
// Poll /api/health endpoint until it responds
for (let i = 0; i < 30; i++) {
    const response = await fetch('http://localhost:8000/api/health');
    if (response.ok) {
        return;  // Server is ready!
    }
    await sleep(500);  // Wait 500ms before retry
}
```

**What happens:**
- Polls `/api/health` endpoint every 500ms
- Up to 30 attempts (15 seconds total)
- Returns when server responds successfully
- This ensures FastAPI has finished starting up

**C# Analogy:**
```csharp
for (int i = 0; i < 30; i++) {
    try {
        var response = await _httpClient.GetAsync("http://localhost:8000/api/health");
        if (response.IsSuccessStatusCode) {
            return;  // Ready!
        }
    } catch { }
    await Task.Delay(500);
}
```

---

### Step 9: Discover Endpoints

**File:** `extension/src/discoveryService.ts`  
**Function:** `refresh()`

**Sub-steps:**

#### 9a. Health Check
```typescript
await this.apiClient.healthCheck();
// GET http://localhost:8000/api/health
// Returns: { status: "healthy", endpoints_registered: 14 }
```

#### 9b. Refresh Discovery
```typescript
await this.apiClient.refreshDiscovery();
// POST http://localhost:8000/api/refresh
// Tells backend to re-scan for endpoints
```

#### 9c. Get All Endpoints
```typescript
const endpoints = await this.apiClient.discoverEndpoints();
// GET http://localhost:8000/api/discover
// Returns: Array of EndpointMetadata objects
```

#### 9d. Cache Endpoints
```typescript
this.endpoints.clear();
endpoints.forEach(endpoint => {
    this.endpoints.set(endpoint.id, endpoint);
});
```

**What happens:**
- Backend scans system and registers endpoints (sample modules + discovered tools)
- Extension fetches all endpoints
- Stores them in a Map for quick lookup

**C# Analogy:**
```csharp
var health = await _apiClient.HealthCheckAsync();
await _apiClient.RefreshDiscoveryAsync();
var endpoints = await _apiClient.DiscoverEndpointsAsync();

_endpoints.Clear();
foreach (var endpoint in endpoints) {
    _endpoints[endpoint.Id] = endpoint;
}
```

---

### Step 10: Update UI

**Lines 110-111 in extension.ts**

```typescript
treeProvider.refresh();  // Update sidebar tree view
updateStatusBar();       // Update status bar
```

**What happens:**
- **Tree View** - Refreshes to show discovered endpoints organized by category
- **Status Bar** - Updates to show "Connected (14 endpoints)" or "Disconnected"

**C# Analogy:**
```csharp
_treeProvider.Refresh();  // Notify tree view to reload
UpdateStatusBar();        // Update status bar text
```

---

### Step 11: Periodic Updates

**Lines 91-94 in extension.ts**

```typescript
// Update status bar every 5 seconds
setInterval(() => {
    updateStatusBar();
}, 5000);
```

**What happens:**
- Every 5 seconds, status bar is updated
- Checks if still connected
- Updates endpoint count if changed

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. VS Code calls activate(context)                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Initialize Components                                     │
│    - ServerManager (not started yet)                        │
│    - ApiClient                                               │
│    - DiscoveryService                                        │
│    - EndpointTreeProvider                                    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Create UI                                                 │
│    - Status bar item                                         │
│    - Tree view in sidebar                                    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Register Commands                                        │
│    - extension.refreshEndpoints                             │
│    - extension.executeEndpoint                              │
│    - extension.openBlockEditor                              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Call initializeExtension() (async, non-blocking)        │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Start Backend Server                                      │
│    6a. Find backend directory                               │
│    6b. Verify main.py exists                                 │
│    6c. Find Python (venv or system)                        │
│    6d. Spawn: python -m uvicorn main:app                    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Wait 1 second for process to initialize                  │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Poll /api/health until ready (max 15 seconds)            │
│    - Try every 500ms                                        │
│    - Up to 30 attempts                                       │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. Discover Endpoints                                       │
│    9a. GET /api/health (verify connection)                 │
│    9b. POST /api/refresh (tell backend to scan)             │
│    9c. GET /api/discover (get all endpoints)                │
│    9d. Cache endpoints in Map                              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. Update UI                                               │
│     - Refresh tree view (show endpoints in sidebar)         │
│     - Update status bar ("Connected (14 endpoints)")        │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 11. Extension Ready!                                        │
│     - Status bar updates every 5 seconds                    │
│     - User can open Block Editor                            │
│     - User can execute endpoints                            │
└─────────────────────────────────────────────────────────────┘
```

## Timing Estimates

- **Steps 1-5:** ~10-50ms (synchronous, instant)
- **Step 6:** ~100-500ms (finding Python, spawning process)
- **Step 7:** 1000ms (fixed 1 second wait)
- **Step 8:** 0-15000ms (depends on server startup time, usually 1-3 seconds)
- **Step 9:** ~100-500ms (API calls)
- **Step 10:** ~10ms (UI updates)

**Total:** Typically 2-5 seconds from activation to ready

## Error Handling

If any step fails:

1. **Backend not found** → Error shown, status bar shows "Disconnected"
2. **Python not found** → Error shown, user needs to install Python
3. **Server fails to start** → Error shown, check Python/uvicorn installation
4. **Server doesn't become ready** → Error after 15 seconds, check server logs
5. **Discovery fails** → Error shown, but extension still works (just no endpoints)

## Key Points

1. **Non-blocking startup** - `initializeExtension()` is async and doesn't block activation
2. **Health check polling** - Waits for server to actually be ready, not just process started
3. **Cached endpoints** - Endpoints are cached in memory for fast access
4. **Automatic retry** - Health check retries up to 30 times
5. **Status feedback** - Status bar shows connection state and endpoint count

## Opening Block Editor

When user opens Block Editor (via command):

```
User: Ctrl+Shift+P → "Open Block Editor"
    ↓
Command handler: BlockEditor.createOrShow()
    ↓
Creates WebviewPanel (embedded browser)
    ↓
Loads HTML/CSS/JavaScript
    ↓
Webview sends 'webviewReady' message
    ↓
Extension sends endpoints to webview
    ↓
Webview renders palette with blocks
    ↓
Ready for user interaction!
```

---

**Summary:** The extension starts quickly (steps 1-5), then asynchronously starts the Python backend, waits for it to be ready, discovers endpoints, and updates the UI. The whole process typically takes 2-5 seconds.
