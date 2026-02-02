# Block Editor Client-Side Code Guide

## Overview

This document explains the client-side TypeScript/JavaScript code for the Block Editor. It's written for C# developers familiar with GUI frameworks like Avalonia and ReactiveUI.

## Architecture Overview

The Block Editor uses a **webview** (an embedded browser) to render the visual interface. Think of it like:
- **Webview** = A `WebView2` control in WPF/Avalonia that displays HTML/CSS/JavaScript
- **Extension (TypeScript)** = Your C# code-behind that manages the webview
- **Message Passing** = Like `Messenger` in ReactiveUI or events between components

```
┌─────────────────────────────────────┐
│  VS Code Extension (TypeScript)     │
│  - Manages blocks state             │
│  - Handles API calls                │
│  - Sends messages to webview        │
└──────────────┬──────────────────────┘
               │ postMessage / onMessage
               │ (like events/messaging)
               ▼
┌─────────────────────────────────────┐
│  Webview (HTML/CSS/JavaScript)      │
│  - Renders UI                       │
│  - Handles user interactions        │
│  - Sends messages back to extension │
└─────────────────────────────────────┘
```

## Key Concepts for C# Developers

### 1. TypeScript vs JavaScript
- **TypeScript** = C# (has types, compiles to JavaScript)
- **JavaScript** = Dynamic language (like C# with `dynamic`, but more flexible)
- The webview code is embedded as a **string template** in TypeScript, so it's written as JavaScript

### 2. DOM Manipulation
In C#/Avalonia, you have:
```csharp
var button = new Button { Content = "Click Me" };
container.Children.Add(button);
button.Click += (s, e) => { /* handler */ };
```

In JavaScript, it's similar:
```javascript
var button = document.createElement('button');
button.textContent = 'Click Me';
container.appendChild(button);
button.addEventListener('click', (e) => { /* handler */ });
```

### 3. Async/Await
Same concept as C#:
```csharp
// C#
async Task DoSomething() {
    var result = await api.CallAsync();
}
```

```javascript
// JavaScript
async function doSomething() {
    const result = await api.call();
}
```

### 4. Objects and JSON
JavaScript objects are like C# anonymous objects or dictionaries:
```csharp
// C#
var block = new { id = "123", x = 100, y = 200 };
```

```javascript
// JavaScript
const block = { id: "123", x: 100, y: 200 };
```

## Code Structure

### Main Files

1. **`blockEditor.ts`** - The main class (like a ViewModel in ReactiveUI)
   - Manages block state
   - Handles communication with webview
   - Contains the HTML/CSS/JS as a string template

2. **`extension.ts`** - Entry point (like `App.xaml.cs`)
   - Initializes the extension
   - Registers commands
   - Creates the BlockEditor instance

## BlockEditor Class Breakdown

### Class Structure (C# Analogy)

```typescript
export class BlockEditor {
    // Like private fields in a C# class
    private static currentPanel: BlockEditor | undefined;  // Singleton pattern
    private readonly _panel: vscode.WebviewPanel;         // The webview container
    private _blocks: BlockNode[];                          // Like ObservableCollection<Block>
    private _connections: BlockConnection[];               // Like ObservableCollection<Connection>
}
```

### State Management

The state is stored in arrays (like `List<T>` in C#):

```typescript
private _blocks: BlockNode[] = [];        // All blocks on canvas
private _connections: BlockConnection[] = [];  // All connections between blocks
```

**C# Equivalent:**
```csharp
private ObservableCollection<BlockNode> _blocks = new();
private ObservableCollection<BlockConnection> _connections = new();
```

### Message Passing System

The extension and webview communicate via messages (like `IMessenger` in ReactiveUI):

**Extension → Webview:**
```typescript
this._panel.webview.postMessage({
    command: 'updateState',
    blocks: this._blocks,
    connections: this._connections
});
```

**Webview → Extension:**
```javascript
vscode.postMessage({
    command: 'addBlock',
    endpointId: 'sample_math_add',
    x: 100,
    y: 200
});
```

**C# Analogy:**
```csharp
// Extension sends to Webview
Messenger.Send(new UpdateStateMessage { Blocks = _blocks });

// Webview sends to Extension
Messenger.Send(new AddBlockMessage { EndpointId = "sample_math_add", X = 100, Y = 200 });
```

## Webview Code (The HTML/CSS/JavaScript)

The webview code is embedded as a **template string** in the `_getHtmlForWebview()` method. Think of it like XAML embedded as a string.

### HTML Structure

```html
<div class="toolbar">
    <button id="playButton">▶ Play</button>
    <button id="clearButton">Clear</button>
</div>
<div class="canvas" id="canvas">
    <!-- Blocks are dynamically added here -->
</div>
<div class="palette" id="palette">
    <!-- Available blocks for dragging -->
</div>
```

**Avalonia Analogy:**
```xml
<StackPanel>
    <Button x:Name="PlayButton" Content="▶ Play" />
    <Canvas x:Name="Canvas" />
    <ListBox x:Name="Palette" />
</StackPanel>
```

### JavaScript State Variables

At the top of the script, we declare state (like fields in a ViewModel):

```javascript
let blocks = [];           // Current blocks on canvas
let connections = [];      // Current connections
let endpoints = [];        // Available block types
let selectedBlock = null;  // Currently selected block
let dragging = false;      // Is user dragging a block?
let connecting = null;     // Current connection in progress
```

**C# ViewModel Analogy:**
```csharp
public ObservableCollection<Block> Blocks { get; } = new();
public ObservableCollection<Connection> Connections { get; } = new();
public Block SelectedBlock { get; set; }
public bool IsDragging { get; set; }
public ConnectionState Connecting { get; set; }
```

### Initialization Flow

```javascript
window.addEventListener('DOMContentLoaded', () => {
    // Like OnLoaded in Avalonia
    canvas = document.getElementById('canvas');
    setupEventListeners();
    requestEndpoints();
});
```

**C# Analogy:**
```csharp
public override void OnLoaded() {
    Canvas = this.FindControl<Canvas>("Canvas");
    SetupEventListeners();
    RequestEndpoints();
}
```

## Key Operations Explained

### 1. Adding a Block

**Flow:**
1. User drags from palette → drops on canvas
2. Webview sends `addBlock` message
3. Extension receives message → creates block → updates state
4. Extension sends updated state back to webview
5. Webview re-renders

**Code Flow:**

```javascript
// Webview: User drops block
canvas.addEventListener('drop', (e) => {
    const endpointId = e.dataTransfer.getData('endpoint-id');
    vscode.postMessage({
        command: 'addBlock',
        endpointId: endpointId,
        x: e.clientX,
        y: e.clientY
    });
});
```

```typescript
// Extension: Receives message
case 'addBlock':
    this._addBlock(message.endpointId, message.x, message.y);
    return;

private _addBlock(endpointId: string, x: number, y: number) {
    const block: BlockNode = {
        id: `block_${Date.now()}_${Math.random()}`,
        endpointId: endpointId,
        x: x,
        y: y,
        parameters: {}
    };
    this._blocks.push(block);
    this._update();  // Sends state back to webview
}
```

**C# Analogy:**
```csharp
// View sends command
Messenger.Send(new AddBlockCommand { EndpointId = id, X = x, Y = y });

// ViewModel handles
public void Handle(AddBlockCommand cmd) {
    var block = new BlockNode {
        Id = Guid.NewGuid().ToString(),
        EndpointId = cmd.EndpointId,
        X = cmd.X,
        Y = cmd.Y
    };
    Blocks.Add(block);
    UpdateView();  // Notify view to refresh
}
```

### 2. Rendering Blocks

The `render()` function is like `OnRender` in Avalonia - it draws all blocks:

```javascript
function render() {
    // Clear existing blocks (like Children.Clear())
    const existingBlocks = canvas.querySelectorAll('.block');
    existingBlocks.forEach(b => b.remove());
    
    // Create DOM elements for each block
    blocks.forEach(block => {
        const blockEl = document.createElement('div');
        blockEl.className = 'block';
        blockEl.style.left = block.x + 'px';
        blockEl.style.top = block.y + 'px';
        blockEl.innerHTML = `
            <div class="block-header">${endpoint.name}</div>
            <div class="block-connector output"></div>
            <div class="block-connector input"></div>
        `;
        canvas.appendChild(blockEl);
    });
}
```

**C# Avalonia Analogy:**
```csharp
public override void Render(DrawingContext context) {
    Canvas.Children.Clear();
    
    foreach (var block in Blocks) {
        var blockControl = new BlockControl {
            [Canvas.LeftProperty] = block.X,
            [Canvas.TopProperty] = block.Y
        };
        Canvas.Children.Add(blockControl);
    }
}
```

### 3. Block Dragging

**Flow:**
1. User clicks block → `mousedown` event
2. Set `dragging = true`, store offset
3. User moves mouse → `mousemove` event
4. Update block position, send to extension
5. User releases → `mouseup` event
6. Final position update

```javascript
// Start dragging
blockEl.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('block-connector')) return;  // Don't drag if clicking connector
    selectedBlock = block.id;
    dragging = true;
    dragOffset.x = e.clientX - blockEl.offsetLeft;
    dragOffset.y = e.clientY - blockEl.offsetTop;
});

// While dragging
document.addEventListener('mousemove', (e) => {
    if (dragging && selectedBlock) {
        const block = blocks.find(b => b.id === selectedBlock);
        block.x = e.clientX - dragOffset.x;
        block.y = e.clientY - dragOffset.y;
        
        // Throttle: only send updates for significant moves
        if (Math.abs(block.x - lastX) > 10) {
            vscode.postMessage({
                command: 'updateBlockPosition',
                blockId: block.id,
                x: block.x,
                y: block.y
            });
        }
        render();  // Update visual position immediately
    }
});

// End dragging
document.addEventListener('mouseup', () => {
    if (dragging) {
        dragging = false;
        // Send final position
        vscode.postMessage({
            command: 'updateBlockPosition',
            blockId: selectedBlock,
            x: block.x,
            y: block.y
        });
    }
});
```

**C# Avalonia Analogy:**
```csharp
private void OnBlockPointerPressed(object sender, PointerPressedEventArgs e) {
    if (e.Source is BlockConnector) return;
    _selectedBlock = (Block)sender;
    _isDragging = true;
    _dragOffset = e.GetPosition(_selectedBlock);
    _selectedBlock.Capture(e.Pointer);
}

private void OnPointerMoved(object sender, PointerEventArgs e) {
    if (_isDragging && _selectedBlock != null) {
        var position = e.GetPosition(Canvas);
        _selectedBlock.X = position.X - _dragOffset.X;
        _selectedBlock.Y = position.Y - _dragOffset.Y;
        // Update ViewModel
        ViewModel.UpdateBlockPosition(_selectedBlock.Id, _selectedBlock.X, _selectedBlock.Y);
    }
}
```

### 4. Block Connections

**Flow:**
1. Click output connector → Set `connecting = { blockId, type: 'output' }`
2. Click input connector → Check if `connecting` is set
3. If valid, send `connectBlocks` message
4. Extension creates connection
5. Webview renders connection line

```javascript
// Output connector clicked
outputConnector.addEventListener('click', (e) => {
    e.stopPropagation();  // Don't trigger block drag
    connecting = { blockId: block.id, type: 'output' };
    outputConnector.classList.add('connecting');  // Visual feedback
});

// Input connector clicked
inputConnector.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (connecting && connecting.type === 'output' && connecting.blockId !== block.id) {
        // Valid connection
        vscode.postMessage({
            command: 'connectBlocks',
            sourceId: connecting.blockId,
            targetId: block.id
        });
        connecting = null;  // Clear connection state
    }
});
```

**C# Analogy:**
```csharp
private void OnOutputConnectorClicked(object sender, RoutedEventArgs e) {
    _connectingState = new ConnectionState {
        SourceBlockId = ((Block)sender).Id,
        Type = ConnectionType.Output
    };
    // Update UI to show connecting state
}

private void OnInputConnectorClicked(object sender, RoutedEventArgs e) {
    if (_connectingState != null && _connectingState.Type == ConnectionType.Output) {
        var targetBlock = ((Block)sender).Id;
        ViewModel.ConnectBlocks(_connectingState.SourceBlockId, targetBlock);
        _connectingState = null;
    }
}
```

### 5. Rendering Connections

Connections are drawn as SVG paths (like `Path` in Avalonia):

```javascript
connections.forEach(conn => {
    const sourceBlock = blocks.find(b => b.id === conn.source);
    const targetBlock = blocks.find(b => b.id === conn.target);
    
    // Calculate positions
    const x1 = sourceBlock.x + 150;  // Right side of source
    const y1 = sourceBlock.y + 50;   // Middle of source
    const x2 = targetBlock.x;        // Left side of target
    const y2 = targetBlock.y + 50;   // Middle of target
    
    // Create curved path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const midX = (x1 + x2) / 2;
    path.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
    svg.appendChild(path);
});
```

**C# Avalonia Analogy:**
```csharp
foreach (var conn in Connections) {
    var sourceBlock = Blocks.First(b => b.Id == conn.SourceId);
    var targetBlock = Blocks.First(b => b.Id == conn.TargetId);
    
    var path = new Path {
        Data = new PathGeometry {
            Figures = new PathFigures {
                new PathFigure {
                    StartPoint = new Point(sourceBlock.X + 150, sourceBlock.Y + 50),
                    Segments = new PathSegments {
                        new BezierSegment {
                            Point1 = new Point(midX, sourceBlock.Y + 50),
                            Point2 = new Point(midX, targetBlock.Y + 50),
                            Point3 = new Point(targetBlock.X, targetBlock.Y + 50)
                        }
                    }
                }
            }
        }
    };
    Canvas.Children.Add(path);
}
```

## Message Flow Diagram

```
User Action → Webview Event → postMessage → Extension Handler → State Update → postMessage → Webview Update
```

**Example: Adding a Block**

```
1. User drags block from palette
   ↓
2. canvas 'drop' event fires
   ↓
3. vscode.postMessage({ command: 'addBlock', ... })
   ↓
4. Extension receives in onDidReceiveMessage
   ↓
5. this._addBlock() creates block object
   ↓
6. this._update() sends state back
   ↓
7. Webview receives 'updateState' message
   ↓
8. render() function updates DOM
```

## State Synchronization

The extension is the **source of truth** for state. The webview is a **view** that reflects that state.

**Extension State:**
```typescript
private _blocks: BlockNode[] = [];
private _connections: BlockConnection[] = [];
```

**Webview State:**
```javascript
let blocks = [];      // Copy of extension state
let connections = []; // Copy of extension state
```

When webview needs to change state, it sends a message. Extension updates its state, then sends it back.

**C# MVVM Analogy:**
- Extension = ViewModel (source of truth)
- Webview = View (displays ViewModel state)
- Messages = Commands (view requests changes)

## CSS Styling

CSS is like styles in Avalonia, but more direct:

```css
.block {
    position: absolute;        /* Like [Canvas.Left] in Avalonia */
    background: var(--vscode-input-background);  /* Uses VS Code theme colors */
    border: 2px solid var(--vscode-input-border);
    border-radius: 6px;        /* Like CornerRadius */
    padding: 12px;             /* Like Padding */
}
```

**Avalonia Analogy:**
```xml
<Style Selector="Block">
    <Setter Property="Canvas.Left" Value="{Binding X}" />
    <Setter Property="Canvas.Top" Value="{Binding Y}" />
    <Setter Property="Background" Value="{DynamicResource InputBackground}" />
    <Setter Property="BorderBrush" Value="{DynamicResource InputBorder}" />
    <Setter Property="CornerRadius" Value="6" />
    <Setter Property="Padding" Value="12" />
</Style>
```

## Common Patterns

### 1. Finding Elements (like FindControl)

```javascript
// JavaScript
const button = document.getElementById('playButton');
const canvas = document.querySelector('.canvas');
```

```csharp
// C# Avalonia
var button = this.FindControl<Button>("PlayButton");
var canvas = this.FindControl<Canvas>("Canvas");
```

### 2. Event Handlers

```javascript
// JavaScript
button.addEventListener('click', (e) => {
    console.log('Clicked');
});
```

```csharp
// C# Avalonia
button.Click += (s, e) => {
    System.Diagnostics.Debug.WriteLine("Clicked");
};
```

### 3. Array Operations

```javascript
// JavaScript
blocks.forEach(block => { /* ... */ });
const found = blocks.find(b => b.id === blockId);
const filtered = blocks.filter(b => b.category === 'Math');
```

```csharp
// C#
blocks.ForEach(block => { /* ... */ });
var found = blocks.FirstOrDefault(b => b.Id == blockId);
var filtered = blocks.Where(b => b.Category == "Math").ToList();
```

### 4. Conditional Rendering

```javascript
// JavaScript
if (blocks.length === 0) {
    content.innerHTML = '<div>No blocks</div>';
} else {
    blocks.forEach(block => { /* render */ });
}
```

```csharp
// C# Avalonia
if (Blocks.Count == 0) {
    Content = new TextBlock { Text = "No blocks" };
} else {
    Content = new ItemsControl { ItemsSource = Blocks };
}
```

## Adding New Features

### Example: Add a "Delete Connection" Feature

**Step 1: Add UI Element (in HTML template)**
```javascript
// In render() function, when rendering connections:
path.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Delete this connection?')) {
        vscode.postMessage({
            command: 'disconnectBlocks',
            connectionId: conn.id
        });
    }
});
```

**Step 2: Handle Message in Extension**
```typescript
// Already exists, but you could add validation:
case 'disconnectBlocks':
    this._disconnectBlocks(message.connectionId);
    return;
```

**Step 3: Update Visual Feedback**
```javascript
// Make connection lines clickable
path.style.cursor = 'pointer';
path.setAttribute('stroke-width', '3');  // Make thicker for easier clicking
```

### Example: Add Block Parameters Editor

**Step 1: Add UI in Block HTML**
```javascript
blockEl.innerHTML = `
    <div class="block-header">${endpoint.name}</div>
    <div class="block-parameters">
        <input type="number" data-param="a" value="${block.parameters?.a || 0}" />
        <input type="number" data-param="b" value="${block.parameters?.b || 0}" />
    </div>
`;
```

**Step 2: Handle Parameter Changes**
```javascript
blockEl.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
        const paramName = e.target.dataset.param;
        const paramValue = parseFloat(e.target.value);
        
        vscode.postMessage({
            command: 'updateBlockParameters',
            blockId: block.id,
            parameters: {
                ...block.parameters,
                [paramName]: paramValue
            }
        });
    });
});
```

**Step 3: Extension Already Handles This**
```typescript
case 'updateBlockParameters':
    this._updateBlockParameters(message.blockId, message.parameters);
    return;
```

## Debugging Tips

### 1. Console Logging

```javascript
console.log('Variable value:', variable);
console.log('Array:', array);
console.log('Object:', JSON.stringify(obj, null, 2));
```

**C# Equivalent:**
```csharp
System.Diagnostics.Debug.WriteLine($"Variable value: {variable}");
System.Diagnostics.Debug.WriteLine($"Array: {string.Join(", ", array)}");
System.Diagnostics.Debug.WriteLine($"Object: {JsonSerializer.Serialize(obj, new JsonSerializerOptions { WriteIndented = true })}");
```

### 2. Breakpoints

In VS Code, you can set breakpoints in the TypeScript code. For webview JavaScript, use browser DevTools (F12 in the webview).

### 3. Inspect Webview

Right-click in the webview → "Inspect" to open DevTools (like browser DevTools).

## Performance Considerations

### 1. Throttling Updates

```javascript
// Don't send position updates on every pixel
if (Math.abs(newX - lastX) > 10) {
    sendUpdate();
}
```

### 2. Batch DOM Updates

```javascript
// Bad: Updates DOM multiple times
blocks.forEach(block => {
    canvas.appendChild(createBlock(block));
});

// Good: Create fragment, append once
const fragment = document.createDocumentFragment();
blocks.forEach(block => {
    fragment.appendChild(createBlock(block));
});
canvas.appendChild(fragment);
```

### 3. Avoid Regenerating HTML

The `_update()` method has a `regenerateHtml` parameter:
- `true` = Full HTML regeneration (slow, for add/remove)
- `false` = Just state update (fast, for position changes)

## Key Takeaways

1. **Extension = ViewModel** - Holds state, handles logic
2. **Webview = View** - Displays UI, sends user actions
3. **Messages = Commands** - Communication between view and viewmodel
4. **DOM = Visual Tree** - Like Avalonia's visual tree
5. **Events = Event Handlers** - Similar to C# events
6. **Arrays = Collections** - Like `List<T>` or `ObservableCollection<T>`

## Next Steps

1. **Read the code** - Start with `render()` function to see how blocks are drawn
2. **Trace a user action** - Follow a click from event → message → handler → update
3. **Experiment** - Try adding a simple feature like changing block colors
4. **Use DevTools** - Inspect the webview to see the actual DOM structure
5. **Check console** - All the `console.log` statements will help you understand flow

## Common Gotchas

1. **`this` context** - In event handlers, `this` might not be what you expect. Use arrow functions: `() => {}` instead of `function() {}`
2. **Async timing** - Messages are async, so state might change between send and receive
3. **DOM updates** - Changes to arrays don't automatically update DOM - you must call `render()`
4. **Event propagation** - Use `e.stopPropagation()` to prevent events bubbling up
5. **String templates** - Backticks `` ` `` allow `${variable}` interpolation (like `$"text {variable}"` in C#)

## Resources

- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [DOM API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model)

---

**Remember:** The webview code is just JavaScript running in a browser. If you can write C# GUI code, you can write JavaScript GUI code - the concepts are the same, just different syntax!
