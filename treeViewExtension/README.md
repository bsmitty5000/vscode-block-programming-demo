# Tree View Block Editor

A VS Code extension that provides a block editor using the TreeView API instead of webviews.

## Features

- **Tree-based block representation** - Blocks shown as tree items with connections as parent-child relationships
- **Visual execution order** - Blocks are organized in execution order
- **Connection management** - Connect and disconnect blocks via context menus
- **Sequence execution** - Execute all blocks in the correct order

## How to Use

1. **Add Blocks**: Right-click on an endpoint under "Available Blocks" → "Add Block"
2. **Connect Blocks**: Right-click on a block → "Connect To..." → Select target block
3. **Disconnect Blocks**: Right-click on a block → "Disconnect" → Select block to disconnect
4. **Remove Blocks**: Right-click on a block → "Remove Block"
5. **Execute Sequence**: Click the play button in the tree view title bar
6. **Clear All**: Click the clear button in the tree view title bar

## Tree Structure

```
Block Editor
├── Block Sequence
│   ├── Block 1 (root block)
│   │   └── Block 2 (connected from Block 1)
│   │       └── Block 3 (connected from Block 2)
│   └── Block 4 (another root block)
└── Available Blocks
    ├── Text Processing
    │   ├── Text to Uppercase
    │   └── Text to Lowercase
    └── Math Operations
        ├── Add Numbers
        └── Multiply Numbers
```

## Differences from Webview Version

- **Hierarchical view** - Connections shown as parent-child relationships
- **No visual canvas** - Blocks are in a tree structure
- **Context menu driven** - All actions via right-click menus
- **Simpler UI** - Uses native VS Code tree view

## Building

```bash
cd treeViewExtension
npm install
npm run compile
```

## Running

Press F5 in VS Code to launch the extension in a new window.
