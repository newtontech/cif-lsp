# CIF Comment (CIF 注释)

**别名**: Hash comment, line comment

## Definition

A CIF comment is non-structural text that provides documentation within a CIF file, ignored by parsers.

## Syntax

```
# This is a comment
```

- Starts with hash `#` character
- Continues to end of line
- Can appear anywhere (after whitespace or at start of line)

## Lexer Pattern

```typescript
COMMENT = /^#.*(?=($|\n))/
```

## Processing

Comments are filtered out during parsing:

```typescript
const data: Data = {
  tokens: lexerResult.tokens.filter(
    (t) => t.type !== TokenType.COMMENT && t.type < TokenType.WHITESPACE
  ),
  // ...
};
```

## Use Cases

### File Header Comments

```
# Crystallographic Information File
# Created on: 2023-01-15
# Software: Olex2
data_sample
    _chemical_name 'Example compound'
```

### Section Documentation

```
# Unit cell parameters
_cell_length_a 10.5
_cell_length_b 12.3
_cell_length_c 8.7
```

### Data Exclusion (Commenting Out)

```
# _deprecated_tag old_value
_new_tag new_value
```

### Magic Version Header (CIF 2.0)

```
#\#CIF_2.0
data_example
    ...
```

Note: The CIF 2.0 header uses `#` but is parsed as a special marker, not a comment.

## Positioning

### Valid Positions

```
# At start of line
data_block
    _tag value  # Inline comments are NOT standard
    # After tag-value pair
```

### Inline Comments

Inline comments (after data) are **not part of the CIF 1.1 standard**:

```
_tag value  # This may cause parsing issues
```

Recommended: Put comments on separate lines.

## Special Comment Patterns

### Block Comments

```
# Multiple
# comment
# lines
data_block
    ...
```

### Data Dictionary Comments

```
# _category.name  atom_site
# _category.key   _atom_site_label
# _definition.id  _atom_site_label
```

## Validation

Comments are not validated for content or length.

## Related Concepts

- [CIF File Format](../concepts/cif-file-format.md)
- [CIF Data Block](../entities/cif-data-block.md)
