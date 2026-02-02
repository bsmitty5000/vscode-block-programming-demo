import { EndpointMetadata } from './apiClient';

export interface BlockNode {
    id: string;
    endpointId: string;
    parameters?: Record<string, any>;
}

export interface BlockConnection {
    id: string;
    source: string;
    target: string;
}

export class BlockManager {
    private _blocks: Map<string, BlockNode> = new Map();
    private _connections: Map<string, BlockConnection> = new Map();
    private _blockOrder: string[] = []; // Execution order

    addBlock(endpointId: string, parameters?: Record<string, any>): string {
        const block: BlockNode = {
            id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            endpointId: endpointId,
            parameters: parameters || {}
        };
        this._blocks.set(block.id, block);
        this._updateExecutionOrder();
        return block.id;
    }

    removeBlock(blockId: string): void {
        this._blocks.delete(blockId);
        // Remove all connections involving this block
        const connectionsToRemove: string[] = [];
        this._connections.forEach((conn, id) => {
            if (conn.source === blockId || conn.target === blockId) {
                connectionsToRemove.push(id);
            }
        });
        connectionsToRemove.forEach(id => this._connections.delete(id));
        this._updateExecutionOrder();
    }

    connectBlocks(sourceId: string, targetId: string): string | null {
        // Check if connection already exists
        const exists = Array.from(this._connections.values()).some(
            c => c.source === sourceId && c.target === targetId
        );
        if (exists) {
            return null;
        }

        const connection: BlockConnection = {
            id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            source: sourceId,
            target: targetId
        };

        this._connections.set(connection.id, connection);
        this._updateExecutionOrder();
        return connection.id;
    }

    disconnectBlocks(connectionId: string): void {
        this._connections.delete(connectionId);
        this._updateExecutionOrder();
    }

    updateBlockParameters(blockId: string, parameters: Record<string, any>): void {
        const block = this._blocks.get(blockId);
        if (block) {
            block.parameters = parameters;
        }
    }

    getBlock(blockId: string): BlockNode | undefined {
        return this._blocks.get(blockId);
    }

    getAllBlocks(): BlockNode[] {
        return Array.from(this._blocks.values());
    }

    getConnections(): BlockConnection[] {
        return Array.from(this._connections.values());
    }

    getExecutionOrder(): string[] {
        return [...this._blockOrder];
    }

    getBlockChildren(blockId: string): string[] {
        // Return blocks that this block connects to (children in tree)
        return Array.from(this._connections.values())
            .filter(conn => conn.source === blockId)
            .map(conn => conn.target);
    }

    getBlockParent(blockId: string): string | undefined {
        // Return the block that connects to this one (parent in tree)
        const connection = Array.from(this._connections.values())
            .find(conn => conn.target === blockId);
        return connection?.source;
    }

    getRootBlocks(): string[] {
        // Blocks with no incoming connections
        const allBlockIds = Array.from(this._blocks.keys());
        const blocksWithParents = new Set(
            Array.from(this._connections.values()).map(conn => conn.target)
        );
        return allBlockIds.filter(id => !blocksWithParents.has(id));
    }

    clear(): void {
        this._blocks.clear();
        this._connections.clear();
        this._blockOrder = [];
    }

    private _updateExecutionOrder(): void {
        // Topological sort to determine execution order
        const visited = new Set<string>();
        const order: string[] = [];
        const blockIds = new Set(Array.from(this._blocks.keys()));

        // Build adjacency list (what blocks come before this one)
        const incoming = new Map<string, string[]>();
        blockIds.forEach(id => incoming.set(id, []));
        
        this._connections.forEach(conn => {
            if (blockIds.has(conn.source) && blockIds.has(conn.target)) {
                const deps = incoming.get(conn.target) || [];
                deps.push(conn.source);
                incoming.set(conn.target, deps);
            }
        });

        // Find blocks with no dependencies
        const queue: string[] = [];
        blockIds.forEach(id => {
            if ((incoming.get(id) || []).length === 0) {
                queue.push(id);
            }
        });

        // Process queue
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            
            visited.add(current);
            order.push(current);

            // Find blocks that depend on this one
            this._connections.forEach(conn => {
                if (conn.source === current && !visited.has(conn.target)) {
                    const deps = incoming.get(conn.target) || [];
                    if (deps.every(dep => visited.has(dep))) {
                        queue.push(conn.target);
                    }
                }
            });
        }

        // Add any remaining blocks (disconnected ones)
        blockIds.forEach(id => {
            if (!visited.has(id)) {
                order.push(id);
            }
        });

        this._blockOrder = order;
    }
}
