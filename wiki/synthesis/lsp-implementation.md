# CIF LSP Implementation (CIF 语言服务器实现)

## Overview

The CIF Language Server implements the Language Server Protocol (LSP) to provide IDE features for CIF files.

## Architecture

```
VS Code Extension (client)
         ↕ (LSP messages)
Language Server (server/src/server.ts)
    ├── Parser (parser/)
    ├── Handlers (handlers/)
    └── Validation (validateCifDocument.ts)
```

## Server Capabilities

```typescript
{
  capabilities: {
    completionProvider: {
      resolveProvider: true,
    },
    hoverProvider: true,
  },
}
```

### Supported Features

1. **Completion** - Suggest CIF data names
2. **Hover** - Show tag definitions and context
3. **Diagnostics** - Validate CIF syntax and semantics

## Document Lifecycle

### Initialization

```typescript
connection.onInitialize((params) => {
  warnOnNonStandardNames =
    params.initializationOptions?.warnOnNonStandardDataNames ?? true;
  return { capabilities };
});
```

### Content Change

```typescript
documents.onDidChangeContent((change) => {
  const textDocument = change.document;
  const tokensAndErrors = parser(textDocument.getText());
  trees[textDocument.uri] = tokensAndErrors.tokens;
  validateCifDocument(
    change.document,
    tokensAndErrors,
    connection,
    warnOnNonStandardNames,
  );
});
```

### Document Close

```typescript
documents.onDidClose((change) => {
  const uri = change.document.uri;
  delete trees[uri];
  connection.sendDiagnostics({ uri, diagnostics: [] });
});
```

## Token Tree Storage

```typescript
const trees: { [uri: string]: Token[] } = {};
```

Each token maintains parent references:
- `block`: DATA_ block containing the token
- `loop`: LOOP_ construct containing the token
- `save`: SAVE_ frame containing the token
- `tag`: TAG associated with this value

## Completion Provider

```typescript
connection.onCompletion((): CompletionItem[] => {
  return cifKeys();  // Returns all defined tags
});
```

**Features**:
- All tags from loaded dictionaries
- Case-insensitive search
- Sorted alphabetically

## Hover Provider

```typescript
connection.onHover((params): Hover => {
  const uri = params.textDocument.uri;
  const position = params.position;
  const tokens = trees[uri];

  const selected = tokens.find(t =>
    isBeforeOrSame(t.range.start, position) &&
    isBeforeOrSame(position, t.range.end)
  );

  if (selected) {
    return {
      contents: buildHoverContext(selected) + hoverText(selected)
    };
  }
});
```

**Hover Content**:
1. Hierarchical context (block → save → loop → tag → value)
2. Tag definition from dictionary
3. Metadata table (type, range, units, etc.)

## Configuration

### Client Settings

```typescript
connection.onDidChangeConfiguration((change) => {
  const settings = change.settings.cif || {};
  warnOnNonStandardNames = settings.warnOnNonStandardDataNames ?? true;

  // Re-validate all documents
  documents.all().forEach((document) => {
    const tokensAndErrors = parser(document.getText());
    trees[document.uri] = tokensAndErrors.tokens;
    validateCifDocument(document, tokensAndErrors, connection, warnOnNonStandardNames);
  });
});
```

### Settings Schema

```json
{
  "cif.warnOnNonStandardDataNames": {
    "type": "boolean",
    "default": true,
    "description": "Show warnings for non-standard data names in CIF files."
  }
}
```

## Dictionary Management

### Add Dictionary

```typescript
connection.onNotification("cif/addCifDictionary", (params) => {
  dictionaries.set(params.path, params.content);
  const tokens = parser(params.content).tokens;
  collectDefinitions(tokens);
  completionItems.sort((a, b) => a.label.localeCompare(b.label));
});
```

### Remove Dictionary

```typescript
connection.onNotification("cif/removeCifferDictionary", (params) => {
  dictionaries.delete(params.path);
  rebuildDefinitionIndexes();
});
```

## Diagnostic Flow

```
Document Change
    ↓
Lexer → Tokens
    ↓
Parser → Token Tree + Errors
    ↓
Validation → Diagnostics
    ↓
Send to Client
```

## Error Handling

### Parser Errors

```typescript
function showParserErrors(diagnostics: Diagnostic[], errors: ParserError[]) {
  errors.forEach((parserError) => {
    diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      range: parserError.token?.range ?? fallbackRange(),
      message: formatParserError(parserError) + " " + parserError.token?.text,
      source: "cif",
    });
  });
}
```

### Validation Errors

```typescript
tokensAndErrors.tokens
  .filter((token) => token.type === TokenType.TAG)
  .forEach((token) => checkUnknownTags(keys, token, diagnostics));

tokensAndErrors.tokens
  .filter((token) => isValue(token))
  .forEach((token) => validateByType(token, diagnostics));
```

## Related Concepts

- [CIF Validation](./cif-validation.md)
- [CIF Dictionary](../concepts/cif-dictionary.md)
- [CIF Parser](../concepts/cif-file-format.md)
