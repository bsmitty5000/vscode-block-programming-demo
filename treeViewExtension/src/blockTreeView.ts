import * as vscode from 'vscode';
import { DiscoveryService } from './discoveryService';
import { BlockManager, BlockNode } from './blockManager';
import { EndpointMetadata } from './apiClient';

export class BlockTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private discoveryService: DiscoveryService,
        private blockManager: BlockManager
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            // Root level: Show "Block Sequence" and "Available Blocks"
            return Promise.resolve([
                new RootTreeItem('Block Sequence', 'blockSequence'),
                new RootTreeItem('Available Blocks', 'availableBlocks')
            ]);
        }

        if (element instanceof RootTreeItem) {
            if (element.id === 'blockSequence') {
                // Show blocks in execution order
                const rootBlocks = this.blockManager.getRootBlocks();
                if (rootBlocks.length === 0) {
                    const allBlocks = this.blockManager.getAllBlocks();
                    if (allBlocks.length === 0) {
                        return Promise.resolve([
                            new EmptyTreeItem('No blocks added. Right-click "Available Blocks" to add blocks.')
                        ]);
                    }
                    // If there are blocks but no roots, show them anyway (circular dependencies)
                    return Promise.resolve(
                        allBlocks.map(block => {
                            const endpoint = this.discoveryService.getEndpoint(block.endpointId);
                            return new BlockTreeItem(block, endpoint, this.blockManager);
                        })
                    );
                }
                return Promise.resolve(
                    rootBlocks.map(blockId => {
                        const block = this.blockManager.getBlock(blockId);
                        if (!block) return null;
                        const endpoint = this.discoveryService.getEndpoint(block.endpointId);
                        return new BlockTreeItem(block, endpoint, this.blockManager);
                    }).filter(item => item !== null) as BlockTreeItem[]
                );
            } else if (element.id === 'availableBlocks') {
                // Show categories
                const categories = this.discoveryService.getCategories();
                return Promise.resolve(
                    categories.map(category => new CategoryTreeItem(category, this.discoveryService))
                );
            }
        }

        if (element instanceof BlockTreeItem) {
            // Show child blocks (blocks this block connects to)
            const children = this.blockManager.getBlockChildren(element.block.id);
            if (children.length === 0) {
                return Promise.resolve([]);
            }
            return Promise.resolve(
                children.map(blockId => {
                    const block = this.blockManager.getBlock(blockId);
                    if (!block) return null;
                    const endpoint = this.discoveryService.getEndpoint(block.endpointId);
                    return new BlockTreeItem(block, endpoint, this.blockManager);
                }).filter(item => item !== null) as BlockTreeItem[]
            );
        }

        if (element instanceof CategoryTreeItem) {
            // Show endpoints in category
            const endpoints = this.discoveryService.getEndpointsByCategory(element.category);
            return Promise.resolve(
                endpoints.map(endpoint => new EndpointTreeItem(endpoint))
            );
        }

        return Promise.resolve([]);
    }
}

abstract class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

class RootTreeItem extends TreeItem {
    constructor(
        label: string,
        public readonly id: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = id;
    }
}

class EmptyTreeItem extends TreeItem {
    constructor(message: string) {
        super(message, vscode.TreeItemCollapsibleState.None);
        this.description = '';
    }
}

class BlockTreeItem extends TreeItem {
    constructor(
        public readonly block: BlockNode,
        public readonly endpoint: EndpointMetadata | undefined,
        private blockManager: BlockManager
    ) {
        // Determine collapsible state based on whether block has children
        const children = blockManager.getBlockChildren(block.id);
        const collapsibleState = children.length > 0 
            ? vscode.TreeItemCollapsibleState.Expanded 
            : vscode.TreeItemCollapsibleState.None;
        
        super(
            endpoint?.name || block.endpointId,
            collapsibleState
        );
        this.tooltip = endpoint?.description || block.endpointId;
        this.description = children.length > 0 
            ? `${endpoint?.category || ''} → ${children.length} connected`
            : endpoint?.category || '';
        this.iconPath = new vscode.ThemeIcon('symbol-method');
        this.contextValue = 'block';
    }
}

class CategoryTreeItem extends TreeItem {
    constructor(
        public readonly category: string,
        private discoveryService: DiscoveryService
    ) {
        super(category, vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = `${category} category`;
        this.description = `${discoveryService.getEndpointsByCategory(category).length} endpoints`;
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = 'category';
    }
}

class EndpointTreeItem extends TreeItem {
    constructor(public readonly endpoint: EndpointMetadata) {
        super(endpoint.name, vscode.TreeItemCollapsibleState.None);
        this.tooltip = endpoint.description;
        this.description = endpoint.description;
        this.iconPath = new vscode.ThemeIcon('symbol-method');
        this.contextValue = 'endpoint';
    }
}
