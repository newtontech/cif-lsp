# CIF Language Server - Server Implementation

**来源**: /Users/yhm/Desktop/code/cif-lsp/server/src/server.ts

## Server Architecture

The CIF Language Server implements the LSP (Language Server Protocol) to provide:
- Completion support for CIF data names
- Hover information for CIF tags and values
- Document validation with diagnostics

## Key Components

### Connection Setup

```typescript
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const trees: { [uri: string]: Token[] } = {};
```

### Configuration Handling

```typescript
let warnOnNonStandardNames = true;

connection.onDidChangeConfiguration((change) => {
  const settings = change.settings.cif || {};
  warnOnNonStandardNames = settings.warnOnNonStandardDataNames ?? true;
  // Re-validate all documents on config change
});
```

### Document Lifecycle

1. **onDidChangeContent**: Parse document, build token tree, validate
2. **onDidClose**: Clear diagnostics and cached tree
3. **onCompletion**: Return available CIF data names
4. **onHover**: Show context and definition for hovered token

### Token Storage

Each document maintains a token tree in `trees[uri]` containing:
- Block references (DATA_ blocks)
- Loop references (LOOP_ constructs)
- Save frame references (SAVE_ frames)
- Tag associations (for values)

### Hover Text Construction

```typescript
const result = "```cif" +
  [selected.block, selected.save, selected.loop, selected.tag, selected]
    .filter((token) => token)
    .map((token, index) => ...)
    .join("") +
  "\n" + hoverText(selected);
```

Shows hierarchical context from block → save → loop → tag → value.

## Dictionary Notifications

- `cif/addCifDictionary`: Load new CIF dictionary
- `cif/removeCifDictionary`: Unload dictionary and rebuild indexes
