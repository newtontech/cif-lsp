# CIF Data Block (CIF 数据块)

**别名**: DATA_ block, data block

## Definition

A DATA_ block is the top-level container in a CIF file, representing a single crystallographic dataset.

## Syntax

```
DATA_blockname
    _tag_name value
    _another_tag value
```

## Naming Rules

- Must start with `DATA_` or `data_` (case-insensitive)
- Block names are case-insensitive
- Maximum 80 characters
- ASCII characters only in CIF 1.0
- UTF-8 allowed in CIF 2.0

## Hierarchy

```
CIF File
├── DATA_block1
│   ├── tag-value pairs
│   ├── LOOP_ constructs
│   └── SAVE_ frames
├── DATA_block2
└── ...
```

## Common Block Names

- `data_global` - Global parameters
- `data_I` - First dataset
- `data_` + compound formula - e.g., `data_H2O`

## Validation Rules

1. **Duplicate Detection**: Block names must be unique (case-insensitive)
2. **Empty Block**: Warning if block contains no data
3. **Missing Block**: Error if file has no DATA_ block

## Parser Implementation

```typescript
function dataBlock(data: Data): boolean {
  const block = next(data);
  if (is(block, TokenType.DATA)) {
    let emptyDataBlock = true;
    data.block = block;
    while (dataItems(data) || saveFrame(data)) {
      emptyDataBlock = false;
    }
    if (emptyDataBlock) {
      data.errors.push(new ParserError(ParserErrorType.EmptyDataBlock, block));
    }
    data.block = null;
    return true;
  }
  // ...
}
```

## Examples

### Simple Data Block

```
data_example
    _chemical_formula_sum 'C6 H12 O6'
    _cell_length_a    10.5
    _cell_length_b    12.3
```

### Multiple Blocks

```
data_global
    _audit_creation_method 'Synthetic'

data_compound_1
    _chemical_name 'Glucose'

data_compound_2
    _chemical_name 'Fructose'
```

## Related Concepts

- [CIF File Format](../concepts/cif-file-format.md)
- [CIF Tag](../entities/cif-tag.md)
- [CIF Save Frame](../entities/cif-save-frame.md)
- [CIF Loop](../entities/cif-loop.md)
