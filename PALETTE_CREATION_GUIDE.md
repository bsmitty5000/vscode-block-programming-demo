# How the Palette is Created

This guide explains step-by-step how the palette (the sidebar showing available blocks) is created and populated.

## Overview

The palette is a sidebar on the right side of the block editor that shows all available block types organized by category. Users can drag blocks from the palette onto the canvas.

## Step-by-Step Flow

### 1. Initial HTML Structure

The palette HTML is created in the `_getHtmlForWebview()` method as part of the main HTML template:

```html
<div class="palette" id="palette">
    <div class="palette-header">Available Blocks</div>
    <div id="paletteContent">Loading...</div>
</div>
```

**C# Analogy:**
```csharp
<StackPanel x:Name="Palette">
    <TextBlock Text="Available Blocks" FontWeight="Bold" />
    <ItemsControl x:Name="PaletteContent">
        <TextBlock Text="Loading..." />
    </ItemsControl>
</StackPanel>
```

### 2. Extension Fetches Endpoints

When the Block Editor opens, the extension fetches available endpoints from the discovery service:

```typescript
// In BlockEditor class
private async _refreshAndSendEndpoints() {
    // Refresh discovery to get latest endpoints
    await this._discoveryService.refresh();
    this._sendEndpoints();
}

private _sendEndpoints() {
    const endpoints = this._discoveryService.getAllEndpoints();
    
    // Send to webview via message
    this._panel.webview.postMessage({
        command: 'endpoints',
        endpoints: endpoints  // Array of EndpointMetadata objects
    });
}
```

**C# Analogy:**
```csharp
// ViewModel
public async Task RefreshEndpoints() {
    await _discoveryService.RefreshAsync();
    var endpoints = _discoveryService.GetAllEndpoints();
    
    // Send to view
    Messenger.Send(new EndpointsUpdatedMessage { Endpoints = endpoints });
}
```

### 3. Webview Receives Endpoints

The webview JavaScript listens for the 'endpoints' message:

```javascript
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'endpoints':
            endpoints = message.endpoints || [];  // Store in global variable
            renderPalette();  // Render the palette with new endpoints
            break;
    }
});
```

**C# Analogy:**
```csharp
// View
Messenger.Register<EndpointsUpdatedMessage>(this, msg => {
    Endpoints = msg.Endpoints;
    RenderPalette();
});
```

### 4. Organizing by Category

The `renderPalette()` function groups endpoints by category:

```javascript
function renderPalette() {
    const content = document.getElementById('paletteContent');
    
    // Group endpoints by category
    const byCategory = {};
    
    endpoints.forEach(ep => {
        if (!ep || !ep.category) {
            return;  // Skip invalid endpoints
        }
        
        // Create category array if it doesn't exist
        if (!byCategory[ep.category]) {
            byCategory[ep.category] = [];
        }
        
        // Add endpoint to its category
        byCategory[ep.category].push(ep);
    });
}
```

**C# Analogy:**
```csharp
var byCategory = new Dictionary<string, List<Endpoint>>();

foreach (var ep in Endpoints) {
    if (ep?.Category == null) continue;
    
    if (!byCategory.ContainsKey(ep.Category)) {
        byCategory[ep.Category] = new List<Endpoint>();
    }
    
    byCategory[ep.Category].Add(ep);
}
```

**Example Result:**
```javascript
byCategory = {
    "Text Processing": [
        { id: "sample_text_uppercase", name: "Text to Uppercase", ... },
        { id: "sample_text_lowercase", name: "Text to Lowercase", ... }
    ],
    "Math Operations": [
        { id: "sample_math_add", name: "Add Numbers", ... },
        { id: "sample_math_multiply", name: "Multiply Numbers", ... }
    ],
    "Utilities": [
        { id: "sample_util_delay", name: "Delay", ... }
    ]
}
```

### 5. Generating HTML

The function generates HTML for each category and its items:

```javascript
let html = '';
const categories = Object.keys(byCategory).sort();  // Sort categories alphabetically

categories.forEach(category => {
    // Category header
    html += `<div class="palette-category">${category}</div>`;
    
    // Items in this category
    byCategory[category].forEach(ep => {
        html += `
            <div class="palette-item" draggable="true" data-endpoint-id="${ep.id}">
                <div class="palette-item-name">${ep.name}</div>
                <div class="palette-item-desc">${ep.description}</div>
            </div>
        `;
    });
});

// Insert HTML into the DOM
content.innerHTML = html;
```

**C# Analogy:**
```csharp
var html = new StringBuilder();
var categories = byCategory.Keys.OrderBy(k => k);

foreach (var category in categories) {
    html.AppendLine($"<div class=\"palette-category\">{category}</div>");
    
    foreach (var ep in byCategory[category]) {
        html.AppendLine($@"
            <div class=""palette-item"" draggable=""true"" data-endpoint-id=""{ep.Id}"">
                <div class=""palette-item-name"">{ep.Name}</div>
                <div class=""palette-item-desc"">{ep.Description}</div>
            </div>
        ");
    }
}

PaletteContent.InnerHTML = html.ToString();
```

**Generated HTML Example:**
```html
<div class="palette-category">Math Operations</div>
<div class="palette-item" draggable="true" data-endpoint-id="sample_math_add">
    <div class="palette-item-name">Add Numbers</div>
    <div class="palette-item-desc">Adds two numbers together</div>
</div>
<div class="palette-item" draggable="true" data-endpoint-id="sample_math_multiply">
    <div class="palette-item-name">Multiply Numbers</div>
    <div class="palette-item-desc">Multiplies two numbers together</div>
</div>
```

### 6. Making Items Draggable

After creating the HTML, the code sets up drag-and-drop:

```javascript
// Find all palette items
document.querySelectorAll('.palette-item').forEach(item => {
    // Set up drag start event
    item.addEventListener('dragstart', (e) => {
        // Store the endpoint ID in the drag data
        e.dataTransfer.setData('endpoint-id', item.dataset.endpointId);
    });
});
```

**C# Analogy:**
```csharp
foreach (var item in PaletteContent.Children.OfType<PaletteItem>()) {
    item.DragStarted += (s, e) => {
        e.Data.Set("EndpointId", item.EndpointId);
    };
}
```

### 7. Canvas Drop Handler

The canvas listens for drop events:

```javascript
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();  // Allow drop
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    
    // Get the endpoint ID from drag data
    const endpointId = e.dataTransfer.getData('endpoint-id');
    
    if (endpointId) {
        // Calculate drop position relative to canvas
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Send message to extension to create block
        vscode.postMessage({
            command: 'addBlock',
            endpointId: endpointId,
            x: x,
            y: y
        });
    }
});
```

**C# Analogy:**
```csharp
Canvas.DragOver += (s, e) => {
    e.Handled = true;  // Allow drop
};

Canvas.Drop += (s, e) => {
    if (e.Data.Get("EndpointId") is string endpointId) {
        var position = e.GetPosition(Canvas);
        
        ViewModel.AddBlock(endpointId, position.X, position.Y);
    }
};
```

## CSS Styling

The palette is styled with CSS:

```css
.palette {
    position: absolute;
    top: 0;
    right: 0;
    width: 250px;
    height: 100%;
    background: var(--vscode-sideBar-background);
    border-left: 1px solid var(--vscode-panel-border);
    overflow-y: auto;  /* Scrollable if content is long */
    padding: 12px;
    z-index: 10;  /* Above canvas */
}

.palette-item {
    padding: 8px;
    margin-bottom: 8px;
    background: var(--vscode-list-hoverBackground);
    border-radius: 4px;
    cursor: grab;  /* Shows grab cursor */
    border: 1px solid transparent;
}

.palette-item:hover {
    border-color: var(--vscode-focusBorder);
}

.palette-item:active {
    cursor: grabbing;  /* Shows grabbing cursor while dragging */
}

.palette-category {
    margin-top: 16px;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    text-transform: uppercase;
}
```

**C# Avalonia Analogy:**
```xml
<StackPanel Classes="palette"
            HorizontalAlignment="Right"
            Width="250"
            Background="{DynamicResource SideBarBackground}"
            BorderBrush="{DynamicResource PanelBorder}"
            BorderThickness="1,0,0,0">
    <ScrollViewer VerticalScrollBarVisibility="Auto">
        <!-- Items -->
    </ScrollViewer>
</StackPanel>
```

## Complete Flow Diagram

```
1. Block Editor Opens
   ↓
2. Extension calls _refreshAndSendEndpoints()
   ↓
3. DiscoveryService.getAllEndpoints() returns array
   ↓
4. Extension sends postMessage({ command: 'endpoints', endpoints: [...] })
   ↓
5. Webview receives message in 'message' event listener
   ↓
6. endpoints variable is updated
   ↓
7. renderPalette() is called
   ↓
8. Endpoints grouped by category
   ↓
9. HTML generated for each category/item
   ↓
10. HTML inserted into paletteContent div
   ↓
11. Drag event listeners attached to each item
   ↓
12. User can now drag items from palette to canvas
```

## Data Structure

### EndpointMetadata (from extension)

```typescript
interface EndpointMetadata {
    id: string;              // Unique identifier
    name: string;           // Display name
    description: string;    // Tooltip/description
    category: string;       // Category for grouping
    parameters: Record<string, any>;  // Block parameters
    discovered_at: string;  // Timestamp
}
```

**C# Equivalent:**
```csharp
public class EndpointMetadata {
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Category { get; set; }
    public Dictionary<string, object> Parameters { get; set; }
    public DateTime DiscoveredAt { get; set; }
}
```

## Customizing the Palette

### Adding Icons to Palette Items

```javascript
// In renderPalette(), modify the HTML generation:
byCategory[category].forEach(ep => {
    const icon = getIconForCategory(ep.category);  // Your icon mapping function
    html += `
        <div class="palette-item" draggable="true" data-endpoint-id="${ep.id}">
            <span class="palette-icon">${icon}</span>
            <div class="palette-item-name">${ep.name}</div>
            <div class="palette-item-desc">${ep.description}</div>
        </div>
    `;
});
```

### Adding Search/Filter

```javascript
function renderPalette(searchTerm = '') {
    const content = document.getElementById('paletteContent');
    const byCategory = {};
    
    // Filter endpoints by search term
    const filteredEndpoints = endpoints.filter(ep => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return ep.name.toLowerCase().includes(search) ||
               ep.description.toLowerCase().includes(search) ||
               ep.category.toLowerCase().includes(search);
    });
    
    // Group filtered endpoints
    filteredEndpoints.forEach(ep => {
        // ... rest of grouping logic
    });
    
    // ... rest of rendering
}
```

### Adding Categories Collapse/Expand

```javascript
categories.forEach(category => {
    html += `
        <div class="palette-category" onclick="toggleCategory('${category}')">
            ${category}
            <span class="category-toggle">▼</span>
        </div>
        <div class="category-items" id="category-${category}">
            ${itemsHtml}
        </div>
    `;
});

function toggleCategory(category) {
    const items = document.getElementById(`category-${category}`);
    items.style.display = items.style.display === 'none' ? 'block' : 'none';
}
```

## Key Points

1. **Palette is dynamically generated** - Not hardcoded, built from discovered endpoints
2. **Organized by category** - Endpoints are grouped for easier browsing
3. **Drag-and-drop enabled** - Each item is draggable with HTML5 drag API
4. **Styled with VS Code themes** - Uses `var(--vscode-*)` CSS variables
5. **Scrollable** - `overflow-y: auto` allows scrolling if many items
6. **Responsive to updates** - When endpoints change, `renderPalette()` can be called again

## Debugging

To see what's happening:

1. **Check console logs:**
   ```javascript
   console.log('Rendering palette with', endpoints.length, 'endpoints');
   ```

2. **Inspect the DOM:**
   - Right-click palette → Inspect
   - See the generated HTML structure

3. **Check endpoint data:**
   ```javascript
   console.log('Endpoints:', JSON.stringify(endpoints, null, 2));
   ```

4. **Verify categories:**
   ```javascript
   console.log('Categories:', Object.keys(byCategory));
   ```

## Common Issues

### Palette is Empty

- Check if `endpoints` array is populated
- Verify `renderPalette()` is being called
- Check console for errors

### Items Not Draggable

- Verify `draggable="true"` attribute is set
- Check that `dragstart` event listener is attached
- Ensure `data-endpoint-id` attribute is present

### Categories Not Showing

- Verify endpoints have `category` property
- Check for null/undefined categories being filtered out
- Ensure `byCategory` object is being populated

---

The palette is essentially a **dynamic list** that's generated from the available endpoints, organized by category, and made interactive through drag-and-drop. It's similar to a `ListBox` or `ItemsControl` in Avalonia, but built with HTML/CSS/JavaScript.
