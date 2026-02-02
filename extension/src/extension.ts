import * as vscode from 'vscode';
import { ServerManager } from './server';
import { ApiClient } from './apiClient';
import { DiscoveryService } from './discoveryService';
import { EndpointTreeProvider } from './treeView';
import { BlockEditor } from './blockEditor';

let serverManager: ServerManager;
let discoveryService: DiscoveryService;
let treeProvider: EndpointTreeProvider;
let statusBarItem: vscode.StatusBarItem;
let apiClient: ApiClient;

export function activate(context: vscode.ExtensionContext) {
    console.log('[Extension] Extension "vscode-extension-client-server" is now active!');
    console.log(`[Extension] Extension context path: ${context.extensionPath}`);
    console.log(`[Extension] Extension URI: ${context.extensionUri.toString()}`);
    console.log(`[Extension] Storage path: ${context.storagePath || 'none'}`);
    console.log(`[Extension] Global storage path: ${context.globalStoragePath || 'none'}`);

    // Initialize components
    console.log('[Extension] Initializing ServerManager...');
    serverManager = new ServerManager(context);
    console.log('[Extension] Initializing ApiClient...');
    apiClient = new ApiClient();
    console.log('[Extension] Initializing DiscoveryService...');
    discoveryService = new DiscoveryService(apiClient);
    console.log('[Extension] Initializing EndpointTreeProvider...');
    treeProvider = new EndpointTreeProvider(discoveryService);

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'extension.refreshEndpoints';
    context.subscriptions.push(statusBarItem);

    // Register tree view
    const treeView = vscode.window.createTreeView('discoveredEndpoints', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('extension.refreshEndpoints', async () => {
        console.log('[Extension] Refresh endpoints command triggered');
        await discoveryService.refresh();
        const count = discoveryService.getEndpointCount();
        console.log(`[Extension] Refresh complete. Found ${count} endpoints`);
        treeProvider.refresh();
        updateStatusBar();
    });
    context.subscriptions.push(refreshCommand);

    const executeCommand = vscode.commands.registerCommand('extension.executeEndpoint', async (endpointId: string) => {
        const endpoint = discoveryService.getEndpoint(endpointId);
        if (!endpoint) {
            vscode.window.showErrorMessage(`Endpoint ${endpointId} not found`);
            return;
        }

        try {
            const result = await apiClient.executeEndpoint(endpointId);
            if (result.success) {
                vscode.window.showInformationMessage(result.message);
                if (result.output) {
                    // Show output in a new document
                    const doc = await vscode.workspace.openTextDocument({
                        content: result.output,
                        language: 'plaintext'
                    });
                    await vscode.window.showTextDocument(doc);
                }
            } else {
                vscode.window.showErrorMessage(result.message);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to execute endpoint: ${error}`);
        }
    });
    context.subscriptions.push(executeCommand);

    const openBlockEditorCommand = vscode.commands.registerCommand('extension.openBlockEditor', () => {
        BlockEditor.createOrShow(context, discoveryService, apiClient);
    });
    context.subscriptions.push(openBlockEditorCommand);

    // Start server and initialize discovery
    initializeExtension();

    // Update status bar periodically
    const statusBarInterval = setInterval(() => {
        updateStatusBar();
    }, 5000);
    context.subscriptions.push({ dispose: () => clearInterval(statusBarInterval) });
}

async function initializeExtension() {
    console.log('[Extension] initializeExtension() called');
    try {
        // Start backend server (this now waits for server to be ready)
        console.log('[Extension] Starting backend server...');
        await serverManager.startServer();
        
        // Server is now ready, proceed with discovery
        console.log('[Extension] Server is ready, running initial discovery...');
        await discoveryService.refresh();
        const endpointCount = discoveryService.getEndpointCount();
        console.log(`[Extension] Discovery complete. Found ${endpointCount} endpoints`);
        
        treeProvider.refresh();
        updateStatusBar();
        console.log('[Extension] Extension initialization complete');
    } catch (error) {
        console.error(`[Extension] Failed to initialize extension: ${error}`);
        if (error instanceof Error) {
            console.error(`[Extension] Error stack: ${error.stack}`);
        }
        vscode.window.showErrorMessage(`Failed to initialize extension: ${error}`);
        updateStatusBar();
    }
}

function updateStatusBar() {
    const isConnected = discoveryService.isConnected();
    const endpointCount = discoveryService.getEndpointCount();
    
    console.log(`[Extension] updateStatusBar() - connected: ${isConnected}, endpoints: ${endpointCount}`);
    
    if (isConnected) {
        statusBarItem.text = `$(check) Connected (${endpointCount} endpoints)`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `$(error) Disconnected`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    statusBarItem.show();
}

export function deactivate() {
    if (serverManager) {
        serverManager.stopServer();
    }
}
