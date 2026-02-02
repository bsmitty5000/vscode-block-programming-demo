import * as vscode from 'vscode';
import { DiscoveryService } from './discoveryService';
import { ApiClient, EndpointMetadata } from './apiClient';

export interface BlockNode {
    id: string;
    endpointId: string;
    x: number;
    y: number;
    parameters?: Record<string, any>;
}

export interface BlockConnection {
    id: string;
    source: string;
    target: string;
}

export class BlockEditor {
    private static currentPanel: BlockEditor | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _discoveryService: DiscoveryService;
    private readonly _apiClient: ApiClient;
    private _blocks: BlockNode[] = [];
    private _connections: BlockConnection[] = [];
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        discoveryService: DiscoveryService,
        apiClient: ApiClient
    ) {
        this._panel = panel;
        this._discoveryService = discoveryService;
        this._apiClient = apiClient;

        // Set initial webview content
        this._update();

        // Refresh discovery and send endpoints when webview is ready
        this._panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'webviewReady') {
                    this._refreshAndSendEndpoints();
                }
            },
            null,
            this._disposables
        );

        // Also send endpoints after a short delay to ensure webview is ready
        setTimeout(() => {
            this._refreshAndSendEndpoints();
        }, 500);

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                const startTime = Date.now();
                console.log(`[BlockEditor] Received message: ${message.command}`, message);
                
                switch (message.command) {
                    case 'addBlock':
                        this._addBlock(message.endpointId, message.x, message.y);
                        break;
                    case 'updateBlockPosition':
                        this._updateBlockPosition(message.blockId, message.x, message.y);
                        break;
                    case 'connectBlocks':
                        this._connectBlocks(message.sourceId, message.targetId);
                        break;
                    case 'disconnectBlocks':
                        this._disconnectBlocks(message.connectionId);
                        break;
                    case 'deleteBlock':
                        this._deleteBlock(message.blockId);
                        break;
                    case 'updateBlockParameters':
                        this._updateBlockParameters(message.blockId, message.parameters);
                        break;
                    case 'executeSequence':
                        this._executeSequence();
                        break;
                    case 'getEndpoints':
                        this._refreshAndSendEndpoints();
                        break;
                    default:
                        console.warn(`[BlockEditor] Unknown command: ${message.command}`);
                }
                
                const duration = Date.now() - startTime;
                if (duration > 10) {
                    console.warn(`[BlockEditor] Command ${message.command} took ${duration}ms`);
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(
        context: vscode.ExtensionContext,
        discoveryService: DiscoveryService,
        apiClient: ApiClient
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (BlockEditor.currentPanel) {
            BlockEditor.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'blockEditor',
            'Block Editor',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'media')
                ]
            }
        );

        BlockEditor.currentPanel = new BlockEditor(panel, discoveryService, apiClient);
    }

    public dispose() {
        BlockEditor.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _addBlock(endpointId: string, x: number, y: number) {
        console.log(`[BlockEditor] _addBlock(${endpointId}, ${x}, ${y})`);
        const startTime = Date.now();
        
        const endpoint = this._discoveryService.getEndpoint(endpointId);
        if (!endpoint) {
            console.warn(`[BlockEditor] Endpoint ${endpointId} not found`);
            return;
        }

        const block: BlockNode = {
            id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            endpointId: endpointId,
            x: x,
            y: y,
            parameters: {}
        };

        this._blocks.push(block);
        console.log(`[BlockEditor] Added block ${block.id}. Total blocks: ${this._blocks.length}`);
        console.log(`[BlockEditor] _addBlock took ${Date.now() - startTime}ms`);
        this._update();
    }

    private _updateBlockPosition(blockId: string, x: number, y: number) {
        // Throttle position updates to avoid excessive re-renders
        const block = this._blocks.find(b => b.id === blockId);
        if (block) {
            const oldX = block.x;
            const oldY = block.y;
            block.x = x;
            block.y = y;
            
            // Only update if position changed significantly (more than 5px) or if it's been a while
            const dx = Math.abs(x - oldX);
            const dy = Math.abs(y - oldY);
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Don't log every tiny movement, only significant changes
            if (dx > 5 || dy > 5) {
                console.log(`[BlockEditor] _updateBlockPosition(${blockId}, ${x}, ${y}) - moved ${distance.toFixed(1)}px`);
            }
            
            // Only send state update (without regenerating HTML) on significant moves
            // The webview will handle smooth dragging client-side
            if (dx > 10 || dy > 10) {
                // Don't regenerate HTML for position updates - just send state
                this._update(false);
            }
        } else {
            console.warn(`[BlockEditor] Block ${blockId} not found for position update`);
        }
    }

    private _connectBlocks(sourceId: string, targetId: string) {
        console.log(`[BlockEditor] _connectBlocks(${sourceId}, ${targetId})`);
        const startTime = Date.now();
        
        // Check if connection already exists
        const exists = this._connections.some(
            c => c.source === sourceId && c.target === targetId
        );
        if (exists) {
            console.log(`[BlockEditor] Connection already exists`);
            return;
        }

        const connection: BlockConnection = {
            id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            source: sourceId,
            target: targetId
        };

        this._connections.push(connection);
        console.log(`[BlockEditor] Added connection ${connection.id}. Total connections: ${this._connections.length}`);
        console.log(`[BlockEditor] _connectBlocks took ${Date.now() - startTime}ms`);
        this._update();
    }

    private _disconnectBlocks(connectionId: string) {
        console.log(`[BlockEditor] _disconnectBlocks(${connectionId})`);
        const beforeCount = this._connections.length;
        this._connections = this._connections.filter(c => c.id !== connectionId);
        console.log(`[BlockEditor] Removed connection. Connections: ${beforeCount} -> ${this._connections.length}`);
        this._update();
    }

    private _deleteBlock(blockId: string) {
        console.log(`[BlockEditor] _deleteBlock(${blockId})`);
        const startTime = Date.now();
        const beforeBlocks = this._blocks.length;
        const beforeConnections = this._connections.length;
        
        this._blocks = this._blocks.filter(b => b.id !== blockId);
        this._connections = this._connections.filter(
            c => c.source !== blockId && c.target !== blockId
        );
        
        console.log(`[BlockEditor] Deleted block. Blocks: ${beforeBlocks} -> ${this._blocks.length}, Connections: ${beforeConnections} -> ${this._connections.length}`);
        console.log(`[BlockEditor] _deleteBlock took ${Date.now() - startTime}ms`);
        this._update();
    }

    private _updateBlockParameters(blockId: string, parameters: Record<string, any>) {
        console.log(`[BlockEditor] _updateBlockParameters(${blockId})`, parameters);
        const block = this._blocks.find(b => b.id === blockId);
        if (block) {
            block.parameters = parameters;
            this._update();
        } else {
            console.warn(`[BlockEditor] Block ${blockId} not found for parameter update`);
        }
    }

    private async _executeSequence() {
        console.log('[BlockEditor] _executeSequence() called');
        const startTime = Date.now();
        
        if (this._blocks.length === 0) {
            console.warn('[BlockEditor] No blocks to execute');
            vscode.window.showWarningMessage('No blocks to execute');
            return;
        }

        console.log(`[BlockEditor] Executing sequence with ${this._blocks.length} blocks and ${this._connections.length} connections`);
        
        // Find the execution order (topological sort based on connections)
        const orderStartTime = Date.now();
        const executionOrder = this._getExecutionOrder();
        console.log(`[BlockEditor] Execution order calculated in ${Date.now() - orderStartTime}ms:`, executionOrder);
        
        if (executionOrder.length === 0) {
            vscode.window.showWarningMessage('No valid execution order found');
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Executing Block Sequence",
            cancellable: false
        }, async (progress) => {
            const results: Array<{ blockId: string; success: boolean; message: string }> = [];

            for (let i = 0; i < executionOrder.length; i++) {
                const blockId = executionOrder[i];
                const block = this._blocks.find(b => b.id === blockId);
                if (!block) continue;

                const endpoint = this._discoveryService.getEndpoint(block.endpointId);
                if (!endpoint) continue;

                progress.report({
                    increment: 100 / executionOrder.length,
                    message: `Executing ${endpoint.name}...`
                });

                try {
                    const result = await this._apiClient.executeEndpoint(
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

            // Show results
            const successCount = results.filter(r => r.success).length;
            const message = `Execution complete: ${successCount}/${results.length} blocks succeeded`;
            
            if (successCount === results.length) {
                vscode.window.showInformationMessage(message);
            } else {
                vscode.window.showWarningMessage(message);
            }

            // Send results to webview
            this._panel.webview.postMessage({
                command: 'executionResults',
                results: results
            });
        });
    }

    private _getExecutionOrder(): string[] {
        // Simple topological sort
        const visited = new Set<string>();
        const order: string[] = [];
        const blockIds = new Set(this._blocks.map(b => b.id));

        // Build adjacency list (reverse: what blocks come before this one)
        const incoming = new Map<string, string[]>();
        blockIds.forEach(id => incoming.set(id, []));
        
        this._connections.forEach(conn => {
            if (blockIds.has(conn.source) && blockIds.has(conn.target)) {
                const targets = incoming.get(conn.target) || [];
                targets.push(conn.source);
                incoming.set(conn.target, targets);
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

        return order;
    }

    private async _refreshAndSendEndpoints() {
        console.log('[BlockEditor] _refreshAndSendEndpoints() called');
        const startTime = Date.now();
        try {
            // Refresh discovery to get latest endpoints
            console.log('[BlockEditor] Refreshing discovery service...');
            await this._discoveryService.refresh();
            const refreshTime = Date.now() - startTime;
            console.log(`[BlockEditor] Discovery refresh took ${refreshTime}ms`);
            this._sendEndpoints();
        } catch (error) {
            console.error('[BlockEditor] Failed to refresh endpoints:', error);
            // Still send whatever endpoints we have
            this._sendEndpoints();
        }
    }

    private _sendEndpoints() {
        const startTime = Date.now();
        const endpoints = this._discoveryService.getAllEndpoints();
        const endpointSize = JSON.stringify(endpoints).length;
        console.log(`[BlockEditor] Sending ${endpoints.length} endpoints to webview (${endpointSize} bytes)`);
        
        this._panel.webview.postMessage({
            command: 'endpoints',
            endpoints: endpoints
        });
        
        console.log(`[BlockEditor] _sendEndpoints() took ${Date.now() - startTime}ms`);
    }

    private _update(regenerateHtml: boolean = true) {
        const startTime = Date.now();
        console.log(`[BlockEditor] _update(regenerateHtml=${regenerateHtml}) called - blocks: ${this._blocks.length}, connections: ${this._connections.length}`);
        
        let htmlTime = 0;
        
        // Only regenerate HTML if explicitly requested (e.g., when blocks are added/removed)
        // For position updates, we can just send state updates without regenerating HTML
        if (regenerateHtml) {
            const htmlStartTime = Date.now();
            this._panel.webview.html = this._getHtmlForWebview();
            htmlTime = Date.now() - htmlStartTime;
            if (htmlTime > 50) {
                console.warn(`[BlockEditor] HTML generation took ${htmlTime}ms`);
            } else {
                console.log(`[BlockEditor] HTML generation took ${htmlTime}ms`);
            }
        }
        
        // Always send current state
        const messageStartTime = Date.now();
        const stateSize = JSON.stringify({ blocks: this._blocks, connections: this._connections }).length;
        console.log(`[BlockEditor] Sending state update (${stateSize} bytes)`);
        
        this._panel.webview.postMessage({
            command: 'updateState',
            blocks: this._blocks,
            connections: this._connections
        });
        
        const messageTime = Date.now() - messageStartTime;
        const totalTime = Date.now() - startTime;
        if (totalTime > 100) {
            console.warn(`[BlockEditor] _update() took ${totalTime}ms (HTML: ${htmlTime}ms, Message: ${messageTime}ms)`);
        } else {
            console.log(`[BlockEditor] _update() completed in ${totalTime}ms (HTML: ${htmlTime}ms, Message: ${messageTime}ms)`);
        }
    }

    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Block Editor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .toolbar {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: var(--vscode-titleBar-activeBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            gap: 8px;
        }

        .toolbar button {
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
        }

        .toolbar button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .toolbar button.primary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .toolbar button.primary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .toolbar .spacer {
            flex: 1;
        }

        .editor-container {
            flex: 1;
            position: relative;
            overflow: hidden;
        }

        .canvas {
            width: 100%;
            height: 100%;
            position: relative;
            background: var(--vscode-editor-background);
            background-image: 
                linear-gradient(rgba(128, 128, 128, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(128, 128, 128, 0.1) 1px, transparent 1px);
            background-size: 20px 20px;
            overflow: auto;
        }

        .block {
            position: absolute;
            min-width: 150px;
            background: var(--vscode-input-background);
            border: 2px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 12px;
            cursor: move;
            user-select: none;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .block:hover {
            border-color: var(--vscode-focusBorder);
        }

        .block.selected {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 2px var(--vscode-focusBorder);
        }

        .block-header {
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-textLink-foreground);
        }

        .block-description {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }

        .block-category {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            opacity: 0.7;
        }

        .block-connector {
            position: absolute;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--vscode-button-background);
            border: 2px solid var(--vscode-input-border);
            cursor: pointer;
            z-index: 10;
            pointer-events: auto;
            transition: all 0.2s ease;
        }

        .block-connector.output {
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
        }

        .block-connector.input {
            left: -6px;
            top: 50%;
            transform: translateY(-50%);
        }

        .block-connector:hover {
            background: var(--vscode-focusBorder);
            transform: translateY(-50%) scale(1.2);
        }

        .block-connector.connecting {
            background: var(--vscode-textLink-foreground) !important;
            transform: translateY(-50%) scale(1.5) !important;
            box-shadow: 0 0 8px var(--vscode-textLink-foreground);
        }

        .block-connector.can-connect {
            background: var(--vscode-textLink-foreground) !important;
            transform: translateY(-50%) scale(1.5) !important;
        }

        .connection-line {
            position: absolute;
            pointer-events: none;
            stroke: var(--vscode-textLink-foreground);
            stroke-width: 2;
            fill: none;
        }

        .palette {
            position: absolute;
            top: 0;
            right: 0;
            width: 250px;
            height: 100%;
            background: var(--vscode-sideBar-background);
            border-left: 1px solid var(--vscode-panel-border);
            overflow-y: auto;
            padding: 12px;
            z-index: 10;
        }

        .palette-header {
            font-weight: 600;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .palette-item {
            padding: 8px;
            margin-bottom: 8px;
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            cursor: grab;
            border: 1px solid transparent;
        }

        .palette-item:hover {
            border-color: var(--vscode-focusBorder);
        }

        .palette-item:active {
            cursor: grabbing;
        }

        .palette-item-name {
            font-weight: 500;
            margin-bottom: 4px;
        }

        .palette-item-desc {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .palette-category {
            margin-top: 16px;
            margin-bottom: 8px;
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }

        .delete-button {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 20px;
            height: 20px;
            border: none;
            background: var(--vscode-input-background);
            color: var(--vscode-errorForeground);
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            display: none;
        }

        .block:hover .delete-button {
            display: block;
        }

        .delete-button:hover {
            background: var(--vscode-inputValidation-errorBackground);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button class="primary" id="playButton">▶ Play</button>
        <button id="clearButton">Clear</button>
        <div class="spacer"></div>
        <span id="statusText">Ready</span>
    </div>
    <div class="editor-container">
        <div class="canvas" id="canvas"></div>
        <div class="palette" id="palette">
            <div class="palette-header">Available Blocks</div>
            <div id="paletteContent">Loading...</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let blocks = [];
        let connections = [];
        let endpoints = [];
        let selectedBlock = null;
        let dragging = false;
        let dragOffset = { x: 0, y: 0 };
        let connecting = null;
        let canvas = null;
        let svg = null;

        // Initialize
        window.addEventListener('DOMContentLoaded', () => {
            canvas = document.getElementById('canvas');
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            canvas.appendChild(svg);

            setupEventListeners();
            
            // Notify extension that webview is ready
            vscode.postMessage({ command: 'webviewReady' });
            
            // Request endpoints
            requestEndpoints();
        });

        function setupEventListeners() {
            document.getElementById('playButton').addEventListener('click', () => {
                vscode.postMessage({ command: 'executeSequence' });
            });

            document.getElementById('clearButton').addEventListener('click', () => {
                if (confirm('Clear all blocks?')) {
                    blocks = [];
                    connections = [];
                    render();
                }
            });
        }

        function requestEndpoints() {
            vscode.postMessage({ command: 'getEndpoints' });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            console.log('Webview received message:', message.command);
            switch (message.command) {
                case 'endpoints':
                    console.log('Received endpoints:', message.endpoints?.length || 0);
                    endpoints = message.endpoints || [];
                    renderPalette();
                    break;
                case 'updateState':
                    blocks = message.blocks || [];
                    connections = message.connections || [];
                    render();
                    break;
                case 'executionResults':
                    updateStatus(message.results);
                    break;
            }
        });

        function renderPalette() {
            const content = document.getElementById('paletteContent');
            
            console.log('Rendering palette with', endpoints.length, 'endpoints');
            
            if (!endpoints || endpoints.length === 0) {
                content.innerHTML = '<div style="padding: 12px; color: var(--vscode-descriptionForeground);">No endpoints available. Try refreshing.</div>';
                return;
            }
            
            const byCategory = {};
            
            endpoints.forEach(ep => {
                if (!ep || !ep.category) {
                    console.warn('Invalid endpoint:', ep);
                    return;
                }
                if (!byCategory[ep.category]) {
                    byCategory[ep.category] = [];
                }
                byCategory[ep.category].push(ep);
            });

            let html = '';
            const categories = Object.keys(byCategory).sort();
            
            if (categories.length === 0) {
                content.innerHTML = '<div style="padding: 12px; color: var(--vscode-descriptionForeground);">No valid endpoints found.</div>';
                return;
            }
            
            categories.forEach(category => {
                html += \`<div class="palette-category">\${category}</div>\`;
                byCategory[category].forEach(ep => {
                    html += \`
                        <div class="palette-item" draggable="true" data-endpoint-id="\${ep.id}">
                            <div class="palette-item-name">\${ep.name}</div>
                            <div class="palette-item-desc">\${ep.description}</div>
                        </div>
                    \`;
                });
            });

            content.innerHTML = html;

            // Make palette items draggable
            document.querySelectorAll('.palette-item').forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('endpoint-id', item.dataset.endpointId);
                });
            });

            canvas.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            canvas.addEventListener('drop', (e) => {
                e.preventDefault();
                const endpointId = e.dataTransfer.getData('endpoint-id');
                if (endpointId) {
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    vscode.postMessage({
                        command: 'addBlock',
                        endpointId: endpointId,
                        x: x,
                        y: y
                    });
                }
            });
        }

        function render() {
            console.log('[Webview] render() called, connecting state:', connecting);
            // Clear canvas
            const existingBlocks = canvas.querySelectorAll('.block');
            existingBlocks.forEach(b => b.remove());
            svg.innerHTML = '';

            // Render blocks
            blocks.forEach(block => {
                const endpoint = endpoints.find(e => e.id === block.endpointId);
                if (!endpoint) return;

                const blockEl = document.createElement('div');
                blockEl.className = 'block' + (selectedBlock === block.id ? ' selected' : '');
                blockEl.id = block.id;
                blockEl.style.left = block.x + 'px';
                blockEl.style.top = block.y + 'px';
                
                blockEl.innerHTML = \`
                    <button class="delete-button" onclick="deleteBlock('\${block.id}')">×</button>
                    <div class="block-header">\${endpoint.name}</div>
                    <div class="block-description">\${endpoint.description}</div>
                    <div class="block-category">\${endpoint.category}</div>
                    <div class="block-connector output" data-block-id="\${block.id}" data-type="output" title="Click to start connection"></div>
                    <div class="block-connector input" data-block-id="\${block.id}" data-type="input" title="Click to complete connection"></div>
                \`;

                canvas.appendChild(blockEl);

                // Get connector elements after they're in the DOM
                const outputConnector = blockEl.querySelector('.block-connector.output');
                const inputConnector = blockEl.querySelector('.block-connector.input');

                // Output connector - start connection
                if (outputConnector) {
                    outputConnector.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('[Webview] Output connector clicked for block:', block.id);
                        connecting = { blockId: block.id, type: 'output' };
                        outputConnector.classList.add('connecting');
                        updateStatusText('Connecting from ' + endpoint.name + '... Click an input connector to complete.');
                    });
                    
                    outputConnector.addEventListener('mouseenter', () => {
                        if (!connecting) {
                            outputConnector.style.background = 'var(--vscode-focusBorder)';
                        }
                    });
                    
                    outputConnector.addEventListener('mouseleave', () => {
                        if (!connecting || connecting.blockId !== block.id) {
                            outputConnector.style.background = 'var(--vscode-button-background)';
                            outputConnector.classList.remove('connecting');
                        }
                    });
                }

                // Input connector - complete connection
                if (inputConnector) {
                    inputConnector.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('[Webview] Input connector clicked for block:', block.id);
                        console.log('[Webview] Current connecting state:', JSON.stringify(connecting));
                        
                        // Store connecting state in a local variable to prevent race conditions
                        const currentConnecting = connecting;
                        
                        if (currentConnecting && currentConnecting.type === 'output' && currentConnecting.blockId !== block.id) {
                            console.log('[Webview] ✓ Valid connection: Creating connection from', currentConnecting.blockId, 'to', block.id);
                            vscode.postMessage({
                                command: 'connectBlocks',
                                sourceId: currentConnecting.blockId,
                                targetId: block.id
                            });
                            
                            // Reset connecting state and visual feedback
                            const sourceConnector = document.querySelector(\`.block-connector.output[data-block-id="\${currentConnecting.blockId}"]\`);
                            if (sourceConnector) {
                                sourceConnector.style.background = 'var(--vscode-button-background)';
                                sourceConnector.classList.remove('connecting');
                            }
                            connecting = null;
                            updateStatusText('Connection created!');
                        } else if (currentConnecting && currentConnecting.blockId === block.id) {
                            console.log('[Webview] ✗ Cannot connect block to itself');
                            updateStatusText('Cannot connect block to itself. Try a different block.');
                            // Don't reset connecting - let user try a different block
                        } else if (!currentConnecting) {
                            console.log('[Webview] ✗ No connection in progress (connecting is null/undefined)');
                            updateStatusText('Click an output connector first');
                        } else {
                            console.log('[Webview] ✗ Unexpected connecting state:', currentConnecting);
                            console.log('[Webview]   - type:', currentConnecting.type);
                            console.log('[Webview]   - blockId:', currentConnecting.blockId);
                            console.log('[Webview]   - target blockId:', block.id);
                            updateStatusText('Unexpected state. Click an output connector first');
                        }
                    });
                    
                    inputConnector.addEventListener('mouseenter', () => {
                        if (connecting && connecting.type === 'output') {
                            inputConnector.classList.add('can-connect');
                        } else {
                            inputConnector.style.background = 'var(--vscode-focusBorder)';
                        }
                    });
                    
                    inputConnector.addEventListener('mouseleave', () => {
                        if (!connecting || connecting.blockId === block.id) {
                            inputConnector.style.background = 'var(--vscode-button-background)';
                            inputConnector.classList.remove('can-connect');
                        }
                    });
                }

                // Block dragging (only if not clicking connectors)
                blockEl.addEventListener('mousedown', (e) => {
                    // Don't start dragging if clicking connectors or delete button
                    if (e.target.classList.contains('block-connector')) {
                        console.log('[Webview] Ignoring mousedown on connector');
                        return;
                    }
                    if (e.target.classList.contains('delete-button')) {
                        return;
                    }
                    
                    console.log('[Webview] Starting block drag for:', block.id);
                    selectedBlock = block.id;
                    dragging = true;
                    const rect = blockEl.getBoundingClientRect();
                    const canvasRect = canvas.getBoundingClientRect();
                    dragOffset.x = e.clientX - rect.left - canvasRect.left;
                    dragOffset.y = e.clientY - rect.top - canvasRect.top;
                    // Don't call render() here - it will be called on mousemove
                });
            });

            // Render connections
            connections.forEach(conn => {
                const sourceBlock = blocks.find(b => b.id === conn.source);
                const targetBlock = blocks.find(b => b.id === conn.target);
                if (!sourceBlock || !targetBlock) return;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const x1 = sourceBlock.x + 150;
                const y1 = sourceBlock.y + 50;
                const x2 = targetBlock.x;
                const y2 = targetBlock.y + 50;

                const midX = (x1 + x2) / 2;
                path.setAttribute('d', \`M \${x1} \${y1} C \${midX} \${y1}, \${midX} \${y2}, \${x2} \${y2}\`);
                path.setAttribute('class', 'connection-line');
                svg.appendChild(path);
            });

            // Global mouse handlers
            document.addEventListener('mousemove', (e) => {
                if (dragging && selectedBlock) {
                    const canvasRect = canvas.getBoundingClientRect();
                    const block = blocks.find(b => b.id === selectedBlock);
                    if (block) {
                        block.x = e.clientX - canvasRect.left - dragOffset.x;
                        block.y = e.clientY - canvasRect.top - dragOffset.y;
                        vscode.postMessage({
                            command: 'updateBlockPosition',
                            blockId: block.id,
                            x: block.x,
                            y: block.y
                        });
                        render();
                    }
                }
            });

            document.addEventListener('mouseup', (e) => {
                if (dragging) {
                    console.log('[Webview] Mouse up after dragging');
                    dragging = false;
                    if (selectedBlock) {
                        const block = blocks.find(b => b.id === selectedBlock);
                        if (block) {
                            vscode.postMessage({
                                command: 'updateBlockPosition',
                                blockId: block.id,
                                x: block.x,
                                y: block.y
                            });
                        }
                    }
                }
                // Don't clear connecting on mouseup - only clear it when connection is made or canceled
            });

            canvas.addEventListener('click', (e) => {
                if (e.target === canvas || e.target === svg) {
                    console.log('[Webview] Canvas clicked, clearing selection');
                    selectedBlock = null;
                    // Don't clear connecting state when clicking canvas
                    render();
                }
            });
            
            // Allow canceling connection with Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && connecting) {
                    console.log('[Webview] Escape pressed, canceling connection');
                    const sourceConnector = document.querySelector(\`.block-connector.output[data-block-id="\${connecting.blockId}"]\`);
                    if (sourceConnector) {
                        sourceConnector.style.background = 'var(--vscode-button-background)';
                        sourceConnector.classList.remove('connecting');
                    }
                    connecting = null;
                    updateStatusText('Connection canceled');
                }
            });
        }

        function deleteBlock(blockId) {
            vscode.postMessage({ command: 'deleteBlock', blockId: blockId });
        }

        function updateStatus(results) {
            const statusText = document.getElementById('statusText');
            const successCount = results.filter(r => r.success).length;
            statusText.textContent = \`Executed: \${successCount}/\${results.length} succeeded\`;
        }

        function updateStatusText(message) {
            const statusText = document.getElementById('statusText');
            if (statusText) {
                statusText.textContent = message;
                // Clear message after 3 seconds
                setTimeout(() => {
                    if (statusText.textContent === message) {
                        statusText.textContent = 'Ready';
                    }
                }, 3000);
            }
        }
    </script>
</body>
</html>`;
    }
}
