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
        if (this.serverProcess) {
            return;
        }

        const extensionPath = this.context.extensionPath;
        const backendPath = path.join(extensionPath, '..', 'backend');
        
        if (!fs.existsSync(backendPath)) {
            throw new Error(`Backend directory not found at ${backendPath}`);
        }

        const mainPyPath = path.join(backendPath, 'main.py');
        if (!fs.existsSync(mainPyPath)) {
            throw new Error(`main.py not found at ${mainPyPath}`);
        }

        const pythonPath = await this.findPython();
        if (!pythonPath) {
            throw new Error('Python not found. Please install Python 3.8+');
        }

        this.serverProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', String(this.serverPort)], {
            cwd: backendPath,
            stdio: ['ignore', 'pipe', 'pipe']
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

        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!this.serverProcess || this.serverProcess.killed) {
            throw new Error('Server failed to start');
        }
        
        await this.waitForServerReady();
    }

    private async waitForServerReady(maxRetries: number = 30, retryDelay: number = 500): Promise<void> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                try {
                    const response = await fetch(`${this.serverUrl}/api/health`, {
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        return;
                    }
                } catch (fetchError: any) {
                    clearTimeout(timeoutId);
                    throw fetchError;
                }
            } catch (error: any) {
                // Retry
            }
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        throw new Error(`Server did not become ready after ${maxRetries} attempts`);
    }

    stopServer(): void {
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
    }

    getServerUrl(): string {
        return this.serverUrl;
    }

    private async findPython(): Promise<string | null> {
        const extensionPath = this.context.extensionPath;
        const projectRootPath = path.join(extensionPath, '..');
        
        const venvPaths = [
            path.join(projectRootPath, 'venv', 'bin', 'python'),
            path.join(projectRootPath, 'venv', 'Scripts', 'python.exe'),
            path.join(projectRootPath, '.venv', 'bin', 'python'),
            path.join(projectRootPath, '.venv', 'Scripts', 'python.exe'),
            path.join(projectRootPath, 'env', 'bin', 'python'),
            path.join(projectRootPath, 'env', 'Scripts', 'python.exe'),
        ];
        
        for (const venvPath of venvPaths) {
            if (fs.existsSync(venvPath)) {
                const result = await this.checkPythonVersion(venvPath);
                if (result) {
                    return venvPath;
                }
            }
        }
        
        const pythonNames = ['python3', 'python', 'py'];
        
        for (const name of pythonNames) {
            try {
                const result = await this.checkPythonVersion(name);
                if (result) {
                    return name;
                }
            } catch {
                continue;
            }
        }
        
        return null;
    }

    private async checkPythonVersion(pythonName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const proc = spawn(pythonName, ['--version']);
            proc.on('close', (code) => {
                resolve(code === 0);
            });
            proc.on('error', () => {
                resolve(false);
            });
        });
    }
}
