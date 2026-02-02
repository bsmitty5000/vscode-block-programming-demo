# TreeView Block Editor - Usage Guide

## Overview

This is a TreeView-based implementation of the block editor. Instead of a visual canvas with drag-and-drop, blocks are organized in a tree structure where connections are shown as parent-child relationships.

## Key Differences from Webview Version

| Feature | Webview Version | TreeView Version |
|---------|----------------|-------------------|
| **UI** | Visual canvas with drag-and-drop | Tree structure in sidebar |
| **Connections** | Visual lines between blocks | Parent-child relationships |
| **Adding Blocks** | Drag from palette | Right-click endpoint → "Add Block" |
| **Connecting** | Click connectors | Right-click block → "Connect To..." |
| **Layout** | Free-form positioning | Hierarchical tree structure |

## How to Use

### 1. Adding Blocks

1. Expand "Available Blocks" in the tree
2. Expand a category (e.g., "Math Operations")
3. Right-click on an endpoint (e.g., "Add Numbers")
4. Select "Add Block"
5. Block appears under "Block Sequence"

### 2. Connecting Blocks

1. Right-click on a block under "Block Sequence"
2. Select "Connect To..."
3. Choose the target block from the list
4. The target block becomes a child of the source block

**Example:**
```
Block Sequence
├── Add Numbers (source)
│   └── Multiply Numbers (target - connected from Add Numbers)
```

### 3. Disconnecting Blocks

1. Right-click on a block that has connections
2. Select "Disconnect"
3. Choose which child block to disconnect
4. Connection is removed

### 4. Removing Blocks

1. Right-click on a block
2. Select "Remove Block"
3. Block and all its connections are removed

### 5. Executing Sequence

1. Click the ▶ (Play) button in the tree view title bar
2. Blocks execute in order (respecting connections)
3. Progress shown in notification
4. Results displayed when complete

### 6. Clearing All Blocks

1. Click the Clear button in the tree view title bar
2. Confirm the action
3. All blocks and connections are removed

## Tree Structure Explained

### Block Sequence Section

Shows blocks in execution order:
- **Root blocks** = Blocks with no incoming connections (execute first)
- **Child blocks** = Blocks connected from parent blocks (execute after parent)
- **Expanded nodes** = Blocks that have connections (show children)
- **Collapsed nodes** = Blocks with no connections

### Available Blocks Section

Shows all discovered endpoints organized by category:
- **Categories** = Folders containing related endpoints
- **Endpoints** = Available block types you can add

## Execution Order

Blocks execute in topological order:
1. All root blocks (no dependencies) execute first
2. Then blocks that depend on completed blocks
3. And so on...

**Example:**
```
Block A (root) → executes first
├── Block B → executes after A
│   └── Block C → executes after B
└── Block D → executes after A (parallel with B)
```

## Context Menu Commands

### On Endpoints (Available Blocks)
- **Add Block** - Add this endpoint as a block to the sequence

### On Blocks (Block Sequence)
- **Remove Block** - Remove this block and all its connections
- **Connect To...** - Connect this block to another block
- **Disconnect** - Remove a connection from this block

### Title Bar (Top of Tree View)
- **Refresh** - Refresh endpoint discovery
- **▶ Play** - Execute the block sequence
- **Clear** - Clear all blocks

## Advantages of TreeView Version

1. **Native VS Code UI** - Uses standard tree view, feels integrated
2. **Clear hierarchy** - Easy to see execution flow
3. **Keyboard navigation** - Can navigate with arrow keys
4. **No webview overhead** - Lighter weight, faster
5. **Accessible** - Works with screen readers

## Limitations

1. **No visual canvas** - Can't see spatial relationships
2. **Linear connections** - Only shows one connection path (parent-child)
3. **No drag-and-drop** - All actions via context menus
4. **Less visual** - Not as intuitive as canvas-based editor

## When to Use Which Version

**Use Webview Version when:**
- You want visual/spatial representation
- You prefer drag-and-drop interaction
- You want to see all connections visually
- You're building complex workflows

**Use TreeView Version when:**
- You prefer native VS Code UI
- You want keyboard navigation
- You want lighter weight extension
- You prefer hierarchical view of execution flow

## Building and Running

```bash
cd treeViewExtension
npm install
npm run compile
```

Then in VS Code:
1. Press F5
2. Select "Run TreeView Extension" from the debug dropdown
3. New Extension Development Host window opens
4. Look for "Block Editor" in the sidebar

## Troubleshooting

**Tree view not showing:**
- Check that extension activated (check Output panel)
- Look for "Block Editor" in Explorer sidebar
- Try refreshing endpoints

**Blocks not appearing:**
- Make sure backend server is running
- Check status bar for connection status
- Try refreshing endpoints

**Can't connect blocks:**
- Make sure you have at least 2 blocks
- Check that target block isn't already connected from source
- Verify blocks are under "Block Sequence" section
