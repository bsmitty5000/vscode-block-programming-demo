import * as vscode from 'vscode';
import { DiscoveryService } from './discoveryService';
import { EndpointMetadata } from './apiClient';

export class EndpointTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private discoveryService: DiscoveryService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            // Root level: show categories
            const categories = this.discoveryService.getCategories();
            return Promise.resolve(
                categories.map(category => new CategoryTreeItem(category, this.discoveryService))
            );
        } else if (element instanceof CategoryTreeItem) {
            // Category level: show endpoints in this category
            const endpoints = this.discoveryService.getEndpointsByCategory(element.category);
            return Promise.resolve(
                endpoints.map(endpoint => new EndpointTreeItem(endpoint))
            );
        } else {
            // Endpoint level: no children
            return Promise.resolve([]);
        }
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

class CategoryTreeItem extends TreeItem {
    constructor(
        public readonly category: string,
        private discoveryService: DiscoveryService
    ) {
        super(category, vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = `${category} category`;
        this.description = `${discoveryService.getEndpointsByCategory(category).length} endpoints`;
        this.iconPath = new vscode.ThemeIcon('folder');
    }
}

class EndpointTreeItem extends TreeItem {
    constructor(public readonly endpoint: EndpointMetadata) {
        super(endpoint.name, vscode.TreeItemCollapsibleState.None);
        this.tooltip = endpoint.description;
        this.description = endpoint.description;
        this.iconPath = new vscode.ThemeIcon('symbol-method');
        this.command = {
            command: 'extension.executeEndpoint',
            title: 'Execute Endpoint',
            arguments: [endpoint.id]
        };
    }

    contextValue = 'endpoint';
}
