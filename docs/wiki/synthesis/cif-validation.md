# CIF Validation Rules (CIF 验证规则)

## Overview

CIF validation occurs at multiple levels: syntax validation, structural validation, and semantic (dictionary-based) validation.

## Validation Levels

### 1. Lexical Validation

#### Character Validation (CIF 1.0)

```typescript
function isCif1CharAllowed(code: number): boolean {
  return code === 9 || code === 10 || (code >= 32 && code <= 127);
}
```

- **Rule**: Only ASCII characters (32-127) plus tab (9) and newline (10)
- **Error**: `NonAsciiCharacter` with code point

#### Line Length

```typescript
const maxLineLength = 2048;
```

- **Rule**: Lines must not exceed 2048 characters
- **Error**: `LineTooLong` warning

#### Token Length

| Token Type | Max Length | Error |
|------------|------------|-------|
| TAG | 75 chars | `ValueTooLong` |
| DATA | 80 chars | `ValueTooLong` |
| SAVE | 80 chars | `ValueTooLong` |

### 2. Syntax Validation

#### Empty File

```typescript
if (data.tokens.length === 0) {
  data.errors.push(new ParserError(ParserErrorType.EmptyFile));
}
```

#### Missing Data Block

```typescript
if (!is(block, TokenType.DATA)) {
  data.errors.push(new ParserError(ParserErrorType.MissingDataBlock, block));
}
```

#### Empty Data Block

```typescript
if (emptyDataBlock) {
  data.errors.push(new ParserError(ParserErrorType.EmptyDataBlock, block));
}
```

#### Value Missing

```typescript
if (value === null) {
  data.errors.push(new ParserError(ParserErrorType.ValueMissing, tag));
}
```

#### Loop Validation

```
1. LoopValuesMissing - No values after tag header
2. LoopValueMismatch - value_count % tag_count != 0
```

#### Unclosed Save Frame

```typescript
if (!is(end, TokenType.SAVE_END)) {
  data.errors.push(new ParserError(ParserErrorType.UnclosedSaveFrame, begin));
}
```

### 3. Structural Validation

#### Duplicate Data Blocks

```typescript
const name = token.text.toLowerCase();
const existing = seen.get(name);
if (existing) {
  data.errors.push(new ParserError(ParserErrorType.DuplicateData, existing));
  data.errors.push(new ParserError(ParserErrorType.DuplicateData, token));
}
```

- **Rule**: Data block names must be unique (case-insensitive)
- **Error**: `DuplicateData`

#### Duplicate Tags

```typescript
const blockName = token.save?.text || token.block?.text;
const tagName = token.text;
const existing = tagMap.get(tagName);
if (existing) {
  data.errors.push(new ParserError(ParserErrorType.DuplicateTag, existing));
  data.errors.push(new ParserError(ParserErrorType.DuplicateTag, token));
}
```

- **Rule**: Tags must be unique within block/frame scope
- **Error**: `DuplicateTag`

### 4. Semantic Validation

#### Non-Standard Data Names

```typescript
if (!keys.has(token.text.toLowerCase())) {
  diagnostics.push({
    severity: DiagnosticSeverity.Warning,
    message: `'${token.text}' is a non-standard data name.`,
  });
}
```

- **Rule**: Tags must be defined in loaded dictionaries
- **Configurable**: Can be disabled via `cif.warnOnNonStandardDataNames`
- **Error**: Warning (not blocking)

#### Type Validation

```typescript
switch (def.contents?.toLowerCase()) {
  case "real":
  case "float":
    return isCifReal(value);
  case "integer":
  case "int":
    return isCifInteger(value);
  case "numb":
    return isCifReal(value) || isCifInteger(value);
  case "date":
    return isCifDate(value);
}
```

**Type Patterns**:

| Type | Pattern |
|------|---------|
| Real | `^[+-]?\d+(\.\d*)?([eE][+-]?\d+)?(\(\d+\))?$` |
| Integer | `^[+-]?\d+(\(\d+\))?$` |
| Date | `^\d{4}(?:-\d{2})?(?:-\d{2})?$` |

#### Range Validation

```typescript
const [minRaw, maxRaw] = def.range.split(":");
if (minRaw !== "") {
  const min = parseCifNumber(minRaw);
  if (numericValue < min) return false;
}
if (maxRaw !== "") {
  const max = parseCifNumber(maxRaw);
  if (numericValue > max) return false;
}
```

- **Format**: `"min:max"`
- **Empty min/max**: No bound
- **Inclusive**: Bounds are inclusive

#### Enumeration Validation

```typescript
if (def.stateToDetail) {
  return def.stateToDetail.has(value);
}
```

- **Rule**: Value must match one of the defined enumeration states

## Special Values

### Inapplicable Value (`.`)

Always valid regardless of type constraints.

### Unknown Value (`?`)

Always valid regardless of type constraints.

## Diagnostic Severities

| Severity | Use Case | Examples |
|----------|----------|-----------|
| Error | Blocking syntax errors | Missing value, unclosed frame |
| Warning | Non-standard but parseable | Non-standard tag, type mismatch |
| Information | Configuration notices | Non-standard warning enabled |

## Validation Configuration

```typescript
// In settings.json
{
  "cif.warnOnNonStandardDataNames": true  // default
}
```

## Related Concepts

- [CIF Dictionary](../concepts/cif-dictionary.md)
- [CIF Tag](../entities/cif-tag.md)
- [CIF Value](../entities/cif-value.md)
- [Parser Errors](./parser-errors.md)
