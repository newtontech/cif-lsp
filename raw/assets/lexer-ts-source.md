# CIF Lexer Implementation

**来源**: /Users/yhm/Desktop/code/cif-lsp/server/src/lexer.ts

## Lexer Overview

The CIF tokenizer (lexer) converts CIF source text into a stream of tokens for the parser.

## CIF Version Detection

```typescript
const isCif2 = sourceCode.startsWith("#\\#CIF_2.0");
```

CIF 2.0 files must start with the magic comment `#\#CIF_2.0`.

## Token Regex Patterns

### Core Tokens

| TokenType | Pattern | Description |
|------------|---------|-------------|
| TAG | `^_[^\s]+` | Data names (underscore prefix) |
| COMMENT | `^#.*` | Comments (hash prefix) |
| DATA | `^DATA_[^\s]+` | Data block headers |
| LOOP | `^LOOP_` | Loop construct start |
| SAVE | `^SAVE_[^\s]+` | Save frame start |
| SAVE_END | `^SAVE_` | Save frame end (no name) |
| GLOBAL | `^GLOBAL_` | Global section header |
| STOP | `^STOP_` | Stop section header |

### Value Tokens

| TokenType | Pattern | Description |
|------------|---------|-------------|
| SINGLE | `^'(?:[^'\n]|'(?!\s|$))*'` | Single-quoted strings |
| DOUBLE | `^"(?:[^"\n]|"(?!\s|$))*"` | Double-quoted strings |
| MULTILINE | `^\n;(\n|.)*?\n;` | Semicolon-delimited text blocks |
| NUMBER | `^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(\(\d+\))?` | Numeric values with optional uncertainty |
| DOT | `^(\.)` | Inapplicable value (.) |
| QUESTION | `^(\?)` | Unknown value (?) |
| UNQUOTED | `^[^\s]+` | Unquoted text values |

### CIF 2.0 Collections

| TokenType | Pattern | Description |
|------------|---------|-------------|
| CIF2_LIST_START | `^\[` | List start |
| CIF2_LIST_END | `^\]` | List end |
| CIF2_TABLE_START | `^`{` | Table start |
| CIF2_TABLE_DELIMITER | `^:` | Table key-value separator |
| CIF2_TABLE_END | `^}` | Table end |
| CIF2_TRIPLE | `^'''(?!''').*'''` | Triple-quoted strings |

## Line Length Validation

CIF 1.0 specification limits lines to 2048 characters.

## Character Validation

CIF 1.0 allows only ASCII characters (codes 32-127, plus tab and newline).
CIF 2.0 allows UTF-8 encoded text.

## Token Length Limits

- TAG: 75 characters max
- DATA: 80 characters max
- SAVE: 80 characters max
