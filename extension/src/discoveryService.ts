import { ApiClient, EndpointMetadata } from './apiClient';

export class DiscoveryService {
    private apiClient: ApiClient;
    private endpoints: Map<string, EndpointMetadata> = new Map();
    private lastRefreshTime: Date | null = null;
    private isConnectedFlag: boolean = false;

    constructor(apiClient: ApiClient) {
        this.apiClient = apiClient;
    }

    async refresh(): Promise<void> {
        try {
            // First check health
            await this.apiClient.healthCheck();
            this.isConnectedFlag = true;

            // Refresh discovery
            await this.apiClient.refreshDiscovery();

            // Get all endpoints
            const endpoints = await this.apiClient.discoverEndpoints();
            
            this.endpoints.clear();
            endpoints.forEach(endpoint => {
                this.endpoints.set(endpoint.id, endpoint);
            });

            this.lastRefreshTime = new Date();
        } catch (error) {
            this.isConnectedFlag = false;
            console.error('Discovery refresh failed:', error);
            throw error;
        }
    }

    getEndpoint(endpointId: string): EndpointMetadata | undefined {
        return this.endpoints.get(endpointId);
    }

    getAllEndpoints(): EndpointMetadata[] {
        return Array.from(this.endpoints.values());
    }

    getEndpointsByCategory(category: string): EndpointMetadata[] {
        return Array.from(this.endpoints.values()).filter(
            endpoint => endpoint.category === category
        );
    }

    getCategories(): string[] {
        const categories = new Set<string>();
        this.endpoints.forEach(endpoint => {
            categories.add(endpoint.category);
        });
        return Array.from(categories).sort();
    }

    getEndpointCount(): number {
        return this.endpoints.size;
    }

    isConnected(): boolean {
        return this.isConnectedFlag;
    }

    getLastRefreshTime(): Date | null {
        return this.lastRefreshTime;
    }
}
