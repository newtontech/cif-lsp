# CIF Parser Errors (CIF 解析错误)

## Overview

CIF parser produces structured errors for various syntax and structural issues in CIF files.

## Error Types

### EmptyFile

**Severity**: Warning

Triggered when the CIF file contains no parseable tokens.

```
# Example: Empty file or only comments
# File has no DATA_ blocks
```

### EmptyDataBlock

**Severity**: Error

A DATA_ block contains no data items.

```
data_empty_block
    # ERROR: EmptyDataBlock - no data items
```

### MissingDataBlock

**Severity**: Error

File does not start with a DATA_ block.

```
_invalid_start  # ERROR: MissingDataBlock
```

### DataIdentifierMissing

**Severity**: Error

DATA_ or SAVE_ keyword without identifier.

```
DATA_  # ERROR: DataIdentifierMissing
```

### DuplicateData

**Severity**: Error

Multiple DATA_ blocks with the same name (case-insensitive).

```
data_sample
    _tag value
data_sample  # ERROR: DuplicateData
    _tag value
```

### DuplicateTag

**Severity**: Error

Same tag appears twice in same scope (block or save frame).

```
data_example
    _cell_length_a 10.5
    _cell_length_a 12.3  # ERROR: DuplicateTag
```

### InvalidLoop

**Severity**: Error

Malformed LOOP_ construct.

### ValueMissing

**Severity**: Error

Tag without corresponding value.

```
data_example
    _cell_length_a  # ERROR: ValueMissing
```

### UnexpectedValue

**Severity**: Error

Value appears outside of tag-value or loop context.

```
data_example
    unexpected_value  # ERROR: UnexpectedValue
```

### LoopValueMismatch

**Severity**: Error

Number of values in loop is not a multiple of number of tags.

```
loop_
    _tag1 _tag2
value1 value2 value3  # ERROR: LoopValueMismatch - 3 values, 2 tags
```

### LoopValuesMissing

**Severity**: Error

LOOP_ header has no values.

```
loop_
    _tag1 _tag2
    # ERROR: LoopValuesMissing
```

### UnclosedSaveFrame

**Severity**: Error

SAVE_ frame without closing SAVE_.

```
SAVE_frame
    _tag value
    # ERROR: UnclosedSaveFrame - missing SAVE_
```

### FatalError

**Severity**: Error

General parsing failure.

### LineTooLong

**Severity**: Warning

Line exceeds 2048 characters.

```
# Line with 2049+ characters
# ERROR: LineTooLong
```

### NonAsciiCharacter

**Severity**: Error (CIF 1.0)

Non-ASCII character in CIF 1.0 file.

```
data_example
    _tag 'value with é'  # ERROR: NonAsciiCharacter (CIF 1.0)
```

Note: Use CIF 2.0 for UTF-8 support.

### ValueTooLong

**Severity**: Error

Token exceeds maximum length.

| Token Type | Max Length |
|------------|------------|
| TAG | 75 |
| DATA | 80 |
| SAVE | 80 |

## Error Formatting

```typescript
function formatParserError(error: ParserError): string {
  return (
    ParserErrorType[error.type]
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase() +
    " " +
    (error.token?.text ?? "") +
    " " +
    (error.message ?? "")
  ).trim();
}
```

**Example Output**:
```
"value missing _cell_length_a"
"loop value mismatch"
"unclosed save frame SAVE_myframe"
```

## Error Recovery

The parser continues after errors to report multiple issues:

```typescript
function parseInternal(sourceCode: string): ParserResult {
  try {
    return parseWithErrors(sourceCode);
  } catch (err) {
    return {
      tokens: [],
      errors: [new ParserError(ParserErrorType.FatalError, undefined, String(err))],
    };
  }
}
```

## Related Concepts

- [CIF Validation](./cif-validation.md)
- [CIF Parser](../concepts/cif-file-format.md)
- [CIF Token](../entities/cif-tag.md)
