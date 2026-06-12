# CIF Save Frame (CIF 保存框架)

**别名**: SAVE_ block, save frame

## Definition

A CIF save frame is a nested data structure that groups related data within a data block, commonly used for reflection data and powder diffraction data.

## Syntax

```
SAVE_framename
    _tag1 value1
    _tag2 value2
SAVE_
```

## Structure

1. **Start**: `SAVE_framename` keyword
2. **Contents**: Tag-value pairs and/or loops
3. **End**: `SAVE_` keyword (with no name)

## Naming Rules

- Must start with `SAVE_` or `save_` (case-insensitive)
- Maximum 80 characters
- Case-insensitive names

## Hierarchy

```
DATA_blockname
    ├── _direct_tag value
    ├── SAVE_frame1
    │   ├── _tag value
    │   └── LOOP_ ...
    ├── SAVE_frame2
    └── _another_tag value
```

## Parser Implementation

```typescript
function saveFrame(data: Data): boolean {
  const begin = next(data);
  if (is(begin, TokenType.SAVE)) {
    data.save = begin;
    if (dataItems(data)) {
      while (dataItems(data)) {
        // parse frame contents
      }
      const end = next(data);
      if (is(end, TokenType.SAVE_END)) {
        data.save = null;
        return true;
      } else {
        data.errors.push(
          new ParserError(ParserErrorType.UnclosedSaveFrame, begin)
        );
      }
    }
  }
  return false;
}
```

## Validation Rules

### Unclosed Frame

```
SAVE_myframe
    _tag value
    # ERROR: UnclosedSaveFrame - missing SAVE_
```

### Empty Frame

Empty save frames are allowed but may trigger warnings.

## Token Association

Each token within a save frame gets:
- `save`: Reference to the SAVE_ token
- `block`: Reference to parent DATA_ block

## Common Use Cases

### Powder Diffraction Data

```
data_global
    _audit_creation_method 'Powder diffraction'

SAVE_powder_data
    _pd_proc_info_datetime '2023-01-15'
    loop_
        _pd_meas_angle_2theta
        _pd_meas_counts_total
        10.5  1234
        11.0  1456
        11.5  1678
SAVE_
```

### Reflection Data

```
data_crystal
SAVE_reflection_data
    loop_
        _refln_index_h
        _refln_index_k
        _refln_index_l
        _refln_F_squared
        0  0  1  123.45
        1  0  0  234.56
SAVE_
```

### Multiple Frames

```
data_experiment
SAVE_sample_preparation
    _sample_preparation_description 'Ground in agate mortar'
SAVE_

SAVE_data_collection
    _diffrn_radiation_wavelength 1.5418
SAVE_

SAVE_data_reduction
    _reflns_number_total 1523
SAVE_
```

## Special Cases

### Anonymous Save Frame

```
SAVE_
    _tag value
SAVE_
```

Unnamed save frames are allowed but uncommon.

### Save Frame Without DATA_

Save frames must be inside a DATA_ block.

## Related Concepts

- [CIF Data Block](../entities/cif-data-block.md)
- [CIF Tag](../entities/cif-tag.md)
- [CIF Loop](../entities/cif-loop.md)
