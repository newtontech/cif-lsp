# CIF Loop Construct (CIF 循环结构)

**别名**: LOOP_ block, looped list, table

## Definition

A CIF LOOP_ construct is a tabular data structure that allows efficient storage of repeated, related data items (like atomic coordinates).

## Syntax

```
LOOP_
    _tag1
    _tag2
    _tag3
    value1_1  value2_1  value3_1
    value1_2  value2_2  value3_2
    value1_3  value2_3  value3_3
```

## Structure

1. **Header**: `LOOP_` keyword
2. **Tag Row**: One or more tag names
3. **Data Rows**: Values corresponding to tags

## Processing Rules

### Value Assignment

Values are assigned to tags by position:

```
Row 1: tag1=value1_1, tag2=value2_1, tag3=value3_1
Row 2: tag1=value1_2, tag2=value2_2, tag3=value3_2
...
```

### Value Count

```
total_values must be (number_of_tags × number_of_rows)
```

If `value_count % tag_count != 0`: **LoopValueMismatch error**

## Parser Implementation

```typescript
function loop(data: Data): boolean {
  let token = next(data);
  const tags: Token[] = [];
  if (is(token, TokenType.LOOP)) {
    const loop = token;
    data.loop = token;
    token = next(data);

    // Collect all tags
    while (is(token, TokenType.TAG)) {
      tags.push(token);
      token = next(data);
    }

    // Associate values with tags
    if (isValue(token)) {
      let index = 0;
      token.tag = tags[index++];
      while (isValue(token)) {
        if (tags.length <= index) {
          index = 0;  // Wrap around to first tag
        }
        token.tag = tags[index++];
        token = next(data);
      }
    }
  }
}
```

## Validation Rules

### Missing Values

```
LOOP_
    _tag1
    _tag2
value1
    # ERROR: LoopValuesMissing - incomplete row
```

### Mismatched Count

```
LOOP_
    _tag1  _tag2
value1  value2  value3
    # ERROR: LoopValueMismatch - 3 values for 2 tags
```

## Token Association

Each value token in a loop gets:
- `loop`: Reference to the LOOP_ token
- `tag`: Reference to its corresponding tag token

## Common Use Cases

### Atomic Coordinates

```
loop_
    _atom_site_label
    _atom_site_type_symbol
    _atom_site_fract_x
    _atom_site_fract_y
    _atom_site_fract_z
    _atom_site_occupancy
    _atom_site_U_iso_or_equiv
C1  C  0.1234  0.5678  0.9012  1.0  0.023
C2  C  0.2345  0.6789  0.0123  1.0  0.025
O1  O  0.3456  0.7890  0.1234  1.0  0.030
```

### Symmetry Operations

```
loop_
    _space_group_symop_operation_xyz
    _space_group_symop_id
'x, y, z'  1
'-x, -y, -z'  2
'-x+1/2, y, -z+1/2'  3
```

### Cell Parameters

```
loop_
    _cell_angle_alpha
    _cell_angle_beta
    _cell_angle_gamma
    _cell_length_a
    _cell_length_b
    _cell_length_c
90.0  90.0  90.0  10.5  12.3  8.7
```

## Empty Loop

A loop with only tags (no values) is valid but uncommon:

```
LOOP_
    _tag1
    _tag2
```

## Nested Loops

Loops cannot be nested directly. Use separate loops or save frames for hierarchical data.

## Related Concepts

- [CIF Tag](../entities/cif-tag.md)
- [CIF Value](../entities/cif-value.md)
- [CIF Data Block](../entities/cif-data-block.md)
- [CIF Save Frame](../entities/cif-save-frame.md)
