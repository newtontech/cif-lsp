# CIF Parser Implementation

**来源**: /Users/yhm/Desktop/code/cif-lsp/server/src/parser/parser.ts

## Parser Overview

The CIF parser implements a recursive descent parser for CIF 1.1 and CIF 2.0 formats.

## Token Types

```typescript
export enum TokenType {
  TAG,              // _data_name
  COMMENT,          # comment
  DATA,             // DATA_blockname
  LOOP,             // LOOP_
  SAVE_END,         // SAVE_
  SAVE,             // SAVE_framename
  GLOBAL,           // GLOBAL_
  STOP,             // STOP_
  CIF2_TRIPLE,      // '''triple-quoted'''
  SINGLE,           // 'single-quoted'
  DOUBLE,           // "double-quoted"
  MULTILINE,        // ;multiline text;
  NUMBER,           // 1.234(56)
  DOT,              // . (inapplicable value)
  QUESTION,         // ? (unknown value)
  CIF2_LIST_START,  // [
  CIF2_LIST_END,    // ]
  CIF2_TABLE_START, // {
  CIF2_TABLE_DELIMITER, // :
  CIF2_TABLE_END,   // }
  UNQUOTED,         // unquoted text
  WHITESPACE,
  NEWLINE,
}
```

## Parsing Structure

### Data Block

```typescript
dataBlock(data):
  block = DATA_blockname
  while dataItems() or saveFrame():
    // parse contents
  if empty: error(EmptyDataBlock)
```

### Save Frame

```typescript
saveFrame(data):
  begin = SAVE_framename
  while dataItems():
    // parse frame contents
  end = SAVE_
  if missing: error(UnclosedSaveFrame)
```

### Tag-Value Pair

```typescript
tagAndValue(data):
  tag = TAG
  value = VALUE | LIST | TABLE
  value.tag = tag  // associate value with its tag
```

### Loop Construct

```typescript
loop(data):
  LOOP_
  tags[] = collect all TAGs
  values[] = collect all VALUEs
  if (values.length % tags.length != 0):
    error(LoopValueMismatch)
```

## Token Relationships

Each token maintains parent references:
- `block`: The DATA_ block containing this token
- `loop`: The LOOP_ construct containing this token
- `save`: The SAVE_ frame containing this token
- `tag`: The TAG associated with this value token

## Error Types

- EmptyFile
- EmptyDataBlock
- MissingDataBlock
- ValueMissing
- UnexpectedValue
- LoopValueMismatch
- LoopValuesMissing
- UnclosedSaveFrame
- FatalError
