import fetch from 'node-fetch';

export interface EndpointMetadata {
    id: string;
    name: string;
    description: string;
    category: string;
    parameters: Record<string, any>;
    discovered_at: string;
}

export interface ExecuteRequest {
    parameters?: Record<string, any>;
}

export interface ExecuteResponse {
    success: boolean;
    message: string;
    output?: string;
}

export class ApiClient {
    private baseUrl: string;
    private timeout: number = 5000;

    constructor(baseUrl: string = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }

    setBaseUrl(url: string): void {
        this.baseUrl = url;
    }

    private createTimeoutSignal(): AbortSignal {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), this.timeout);
        return controller.signal;
    }

    async healthCheck(): Promise<{ status: string; endpoints_registered: number }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`, {
                signal: this.createTimeoutSignal()
            });
            
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.statusText}`);
            }
            
            return await response.json() as { status: string; endpoints_registered: number };
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw new Error(`Failed to connect to server: ${error.message || error}`);
        }
    }

    async discoverEndpoints(): Promise<EndpointMetadata[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/discover`, {
                signal: this.createTimeoutSignal()
            });
            
            if (!response.ok) {
                throw new Error(`Discovery failed: ${response.statusText}`);
            }
            
            return await response.json() as EndpointMetadata[];
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw new Error(`Failed to discover endpoints: ${error.message || error}`);
        }
    }

    async executeEndpoint(endpointId: string, parameters?: Record<string, any>): Promise<ExecuteResponse> {
        try {
            const requestBody: ExecuteRequest = { parameters };
            
            const response = await fetch(`${this.baseUrl}/api/execute/${endpointId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: this.createTimeoutSignal()
            });
            
            if (!response.ok) {
                throw new Error(`Execution failed: ${response.statusText}`);
            }
            
            return await response.json() as ExecuteResponse;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw new Error(`Failed to execute endpoint: ${error.message || error}`);
        }
    }

    async refreshDiscovery(): Promise<{ status: string; endpoints_registered: number }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/refresh`, {
                method: 'POST',
                signal: this.createTimeoutSignal()
            });
            
            if (!response.ok) {
                throw new Error(`Refresh failed: ${response.statusText}`);
            }
            
            return await response.json() as { status: string; endpoints_registered: number };
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw new Error(`Failed to refresh discovery: ${error.message || error}`);
        }
    }
}
