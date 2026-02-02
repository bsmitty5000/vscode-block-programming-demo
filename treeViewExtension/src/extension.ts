import * as vscode from 'vscode';
import { ServerManager } from './server';
import { ApiClient } from './apiClient';
import { DiscoveryService } from './discoveryService';
import { BlockTreeProvider } from './blockTreeView';
import { BlockManager } from './blockManager';

let serverManager: ServerManager;
let discoveryService: DiscoveryService;
let blockManager: BlockManager;
let treeProvider: BlockTreeProvider;
let statusBarItem: vscode.StatusBarItem;
let apiClient: ApiClient;

export function activate(context: vscode.ExtensionContext) {
    console.log('TreeView Block Editor Extension is now active!');

    // Initialize components
    serverManager = new ServerManager(context);
    apiClient = new ApiClient();
    discoveryService = new DiscoveryService(apiClient);
    blockManager = new BlockManager();
    treeProvider = new BlockTreeProvider(discoveryService, blockManager);

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'treeBlockEditor.refreshEndpoints';
    context.subscriptions.push(statusBarItem);

    // Register tree view
    const treeView = vscode.window.createTreeView('treeBlockEditor', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('treeBlockEditor.refreshEndpoints', async () => {
        await discoveryService.refresh();
        treeProvider.refresh();
        updateStatusBar();
    });
    context.subscriptions.push(refreshCommand);

    const addBlockCommand = vscode.commands.registerCommand('treeBlockEditor.addBlock', async (endpointId: string) => {
        const blockId = blockManager.addBlock(endpointId);
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Added block: ${discoveryService.getEndpoint(endpointId)?.name || endpointId}`);
    });
    context.subscriptions.push(addBlockCommand);

    const removeBlockCommand = vscode.commands.registerCommand('treeBlockEditor.removeBlock', async (blockId: string) => {
        const block = blockManager.getBlock(blockId);
        if (block) {
            const endpoint = discoveryService.getEndpoint(block.endpointId);
            blockManager.removeBlock(blockId);
            treeProvider.refresh();
            vscode.window.showInformationMessage(`Removed block: ${endpoint?.name || blockId}`);
        }
    });
    context.subscriptions.push(removeBlockCommand);

    const connectBlocksCommand = vscode.commands.registerCommand('treeBlockEditor.connectBlocks', async (sourceId: string) => {
        // Get target block from user
        const blocks = blockManager.getAllBlocks();
        const sourceBlock = blockManager.getBlock(sourceId);
        if (!sourceBlock) return;

        const sourceEndpoint = discoveryService.getEndpoint(sourceBlock.endpointId);
        
        // Filter out source block and blocks it already connects to
        const availableTargets = blocks.filter(b => {
            if (b.id === sourceId) return false;
            const children = blockManager.getBlockChildren(sourceId);
            return !children.includes(b.id);
        });

        if (availableTargets.length === 0) {
            vscode.window.showWarningMessage('No available blocks to connect to');
            return;
        }

        const items = availableTargets.map(b => {
            const endpoint = discoveryService.getEndpoint(b.endpointId);
            return {
                label: endpoint?.name || b.endpointId,
                description: endpoint?.description || '',
                blockId: b.id
            };
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Connect "${sourceEndpoint?.name}" to which block?`
        });

        if (selected) {
            const connectionId = blockManager.connectBlocks(sourceId, selected.blockId);
            if (connectionId) {
                treeProvider.refresh();
                vscode.window.showInformationMessage(`Connected "${sourceEndpoint?.name}" → "${selected.label}"`);
            }
        }
    });
    context.subscriptions.push(connectBlocksCommand);

    const disconnectBlocksCommand = vscode.commands.registerCommand('treeBlockEditor.disconnectBlocks', async (blockId: string) => {
        const block = blockManager.getBlock(blockId);
        if (!block) return;

        const children = blockManager.getBlockChildren(blockId);
        if (children.length === 0) {
            vscode.window.showInformationMessage('This block has no connections');
            return;
        }

        const items = children.map(childId => {
            const childBlock = blockManager.getBlock(childId);
            const endpoint = childBlock ? discoveryService.getEndpoint(childBlock.endpointId) : undefined;
            return {
                label: endpoint?.name || childId,
                blockId: childId
            };
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Disconnect which block?'
        });

        if (selected) {
            const connections = blockManager.getConnections();
            const connection = connections.find(c => c.source === blockId && c.target === selected.blockId);
            if (connection) {
                blockManager.disconnectBlocks(connection.id);
                treeProvider.refresh();
                vscode.window.showInformationMessage('Connection removed');
            }
        }
    });
    context.subscriptions.push(disconnectBlocksCommand);

    const executeSequenceCommand = vscode.commands.registerCommand('treeBlockEditor.executeSequence', async () => {
        const blocks = blockManager.getAllBlocks();
        if (blocks.length === 0) {
            vscode.window.showWarningMessage('No blocks to execute');
            return;
        }

        const executionOrder = blockManager.getExecutionOrder();
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Executing Block Sequence",
            cancellable: false
        }, async (progress) => {
            const results: Array<{ blockId: string; success: boolean; message: string }> = [];

            for (let i = 0; i < executionOrder.length; i++) {
                const blockId = executionOrder[i];
                const block = blockManager.getBlock(blockId);
                if (!block) continue;

                const endpoint = discoveryService.getEndpoint(block.endpointId);
                if (!endpoint) continue;

                progress.report({
                    increment: 100 / executionOrder.length,
                    message: `Executing ${endpoint.name}...`
                });

                try {
                    const result = await apiClient.executeEndpoint(
                        block.endpointId,
                        block.parameters
                    );
                    results.push({
                        blockId: blockId,
                        success: result.success,
                        message: result.message
                    });
                } catch (error: any) {
                    results.push({
                        blockId: blockId,
                        success: false,
                        message: error.message || 'Execution failed'
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const message = `Execution complete: ${successCount}/${results.length} blocks succeeded`;
            
            if (successCount === results.length) {
                vscode.window.showInformationMessage(message);
            } else {
                vscode.window.showWarningMessage(message);
            }
        });
    });
    context.subscriptions.push(executeSequenceCommand);

    const clearBlocksCommand = vscode.commands.registerCommand('treeBlockEditor.clearBlocks', async () => {
        const result = await vscode.window.showWarningMessage(
            'Clear all blocks?',
            { modal: true },
            'Yes',
            'No'
        );
        if (result === 'Yes') {
            blockManager.clear();
            treeProvider.refresh();
            vscode.window.showInformationMessage('All blocks cleared');
        }
    });
    context.subscriptions.push(clearBlocksCommand);

    // Start server and initialize discovery
    initializeExtension();

    // Update status bar periodically
    const statusBarInterval = setInterval(() => {
        updateStatusBar();
    }, 5000);
    context.subscriptions.push({ dispose: () => clearInterval(statusBarInterval) });
}

async function initializeExtension() {
    try {
        await serverManager.startServer();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await discoveryService.refresh();
        treeProvider.refresh();
        updateStatusBar();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize extension: ${error}`);
        updateStatusBar();
    }
}

function updateStatusBar() {
    const isConnected = discoveryService.isConnected();
    const endpointCount = discoveryService.getEndpointCount();
    const blockCount = blockManager.getAllBlocks().length;
    
    if (isConnected) {
        statusBarItem.text = `$(check) Connected (${endpointCount} endpoints, ${blockCount} blocks)`;
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
