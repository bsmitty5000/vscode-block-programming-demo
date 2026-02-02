import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import fetch from 'node-fetch';

export class ServerManager {
    private serverProcess: ChildProcess | null = null;
    private context: vscode.ExtensionContext;
    private readonly serverPort = 8000;
    private readonly serverUrl = `http://localhost:${this.serverPort}`;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async startServer(): Promise<void> {
        console.log('[ServerManager] startServer() called');
        
        if (this.serverProcess) {
            console.log('[ServerManager] Server is already running');
            return;
        }

        // Get backend directory path
        const extensionPath = this.context.extensionPath;
        console.log(`[ServerManager] Extension path: ${extensionPath}`);
        
        const backendPath = path.join(extensionPath, '..', 'backend');
        console.log(`[ServerManager] Calculated backend path: ${backendPath}`);
        console.log(`[ServerManager] Backend path exists: ${fs.existsSync(backendPath)}`);
        
        if (!fs.existsSync(backendPath)) {
            console.error(`[ServerManager] Backend directory not found at ${backendPath}`);
            throw new Error(`Backend directory not found at ${backendPath}`);
        }

        // Check if requirements are installed
        const mainPyPath = path.join(backendPath, 'main.py');
        console.log(`[ServerManager] Looking for main.py at: ${mainPyPath}`);
        console.log(`[ServerManager] main.py exists: ${fs.existsSync(mainPyPath)}`);
        
        if (!fs.existsSync(mainPyPath)) {
            console.error(`[ServerManager] main.py not found at ${mainPyPath}`);
            throw new Error(`main.py not found at ${mainPyPath}`);
        }

        // Find Python executable
        console.log('[ServerManager] Searching for Python executable...');
        const pythonPath = await this.findPython();
        
        if (!pythonPath) {
            console.error('[ServerManager] Python not found. Please install Python 3.8+');
            throw new Error('Python not found. Please install Python 3.8+');
        }

        console.log(`[ServerManager] Found Python at: ${pythonPath}`);
        
        // Start the server
        console.log(`[ServerManager] Starting server with Python: ${pythonPath}`);
        console.log(`[ServerManager] Backend path: ${backendPath}`);
        console.log(`[ServerManager] Server port: ${this.serverPort}`);

        this.serverProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', String(this.serverPort)], {
            cwd: backendPath,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        this.serverProcess.stdout?.on('data', (data) => {
            console.log(`[ServerManager] Server stdout: ${data}`);
        });

        this.serverProcess.stderr?.on('data', (data) => {
            console.error(`[ServerManager] Server stderr: ${data}`);
        });

        this.serverProcess.on('error', (error) => {
            console.error(`[ServerManager] Server process error: ${error}`);
            vscode.window.showErrorMessage(`Failed to start server: ${error.message}`);
        });

        this.serverProcess.on('exit', (code, signal) => {
            console.log(`[ServerManager] Server exited with code ${code}, signal ${signal}`);
            this.serverProcess = null;
        });

        // Wait a bit to see if server starts successfully
        console.log('[ServerManager] Waiting for server process to initialize...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!this.serverProcess || this.serverProcess.killed) {
            console.error('[ServerManager] Server failed to start - process is null or killed');
            throw new Error('Server failed to start');
        }
        
        console.log('[ServerManager] Server process started successfully');
        
        // Wait for server to be ready to accept connections
        console.log('[ServerManager] Waiting for server to be ready...');
        await this.waitForServerReady();
        console.log('[ServerManager] Server is ready!');
    }

    private async waitForServerReady(maxRetries: number = 30, retryDelay: number = 500): Promise<void> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`[ServerManager] Health check attempt ${i + 1}/${maxRetries}...`);
                
                // Create timeout signal
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                try {
                    const response = await fetch(`${this.serverUrl}/api/health`, {
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log(`[ServerManager] Server is ready! Health check response: ${JSON.stringify(data)}`);
                        return;
                    } else {
                        console.log(`[ServerManager] Health check returned status ${response.status}, retrying...`);
                    }
                } catch (fetchError: any) {
                    clearTimeout(timeoutId);
                    throw fetchError;
                }
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.log(`[ServerManager] Health check timeout, retrying...`);
                } else {
                    console.log(`[ServerManager] Health check failed: ${error.message}, retrying...`);
                }
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        throw new Error(`Server did not become ready after ${maxRetries} attempts`);
    }

    stopServer(): void {
        console.log('[ServerManager] stopServer() called');
        if (this.serverProcess) {
            console.log('[ServerManager] Stopping server...');
            this.serverProcess.kill();
            this.serverProcess = null;
            console.log('[ServerManager] Server stopped');
        } else {
            console.log('[ServerManager] No server process to stop');
        }
    }

    getServerUrl(): string {
        return this.serverUrl;
    }

    private async findPython(): Promise<string | null> {
        console.log('[ServerManager] findPython() called');
        
        // First, check if there's a virtual environment in the backend directory
        const extensionPath = this.context.extensionPath;
        //const backendPath = path.join(extensionPath, '..', 'backend');
        const projectRootPath = path.join(extensionPath, '..');
        
        console.log(`[ServerManager] Checking for virtual environment in: ${projectRootPath}`);
        
        // Check for common venv locations
        const venvPaths = [
            path.join(projectRootPath, 'venv', 'bin', 'python'),
            path.join(projectRootPath, 'venv', 'Scripts', 'python.exe'),
            path.join(projectRootPath, '.venv', 'bin', 'python'),
            path.join(projectRootPath, '.venv', 'Scripts', 'python.exe'),
            path.join(projectRootPath, 'env', 'bin', 'python'),
            path.join(projectRootPath, 'env', 'Scripts', 'python.exe'),
        ];
        
        console.log(`[ServerManager] Checking ${venvPaths.length} venv paths...`);
        for (const venvPath of venvPaths) {
            const exists = fs.existsSync(venvPath);
            console.log(`[ServerManager]   ${venvPath} - exists: ${exists}`);
            
            if (exists) {
                console.log(`[ServerManager] Testing venv Python: ${venvPath}`);
                const result = await this.checkPythonVersion(venvPath);
                console.log(`[ServerManager]   Version check result: ${result}`);
                if (result) {
                    console.log(`[ServerManager] Using venv Python: ${venvPath}`);
                    return venvPath;
                }
            }
        }
        
        // Fall back to system Python
        console.log('[ServerManager] No venv found, checking system Python...');
        const pythonNames = ['python3', 'python', 'py'];
        
        for (const name of pythonNames) {
            console.log(`[ServerManager] Checking system Python: ${name}`);
            try {
                const result = await this.checkPythonVersion(name);
                console.log(`[ServerManager]   ${name} - available: ${result}`);
                if (result) {
                    console.log(`[ServerManager] Using system Python: ${name}`);
                    return name;
                }
            } catch (error) {
                console.log(`[ServerManager]   ${name} - error: ${error}`);
                continue;
            }
        }
        
        console.error('[ServerManager] No Python executable found');
        return null;
    }

    private async checkPythonVersion(pythonName: string): Promise<boolean> {
        return new Promise((resolve) => {
            console.log(`[ServerManager] checkPythonVersion(${pythonName})`);
            const proc = spawn(pythonName, ['--version']);
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            
            proc.on('close', (code) => {
                const success = code === 0;
                console.log(`[ServerManager]   ${pythonName} --version: code=${code}, success=${success}`);
                if (stdout) console.log(`[ServerManager]   stdout: ${stdout.trim()}`);
                if (stderr) console.log(`[ServerManager]   stderr: ${stderr.trim()}`);
                resolve(success);
            });
            
            proc.on('error', (error) => {
                console.log(`[ServerManager]   ${pythonName} --version error: ${error.message}`);
                resolve(false);
            });
        });
    }
}
