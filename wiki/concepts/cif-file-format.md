# CIF File Format (CIF 文件格式)

**全称**: Crystallographic Information File

## Overview

CIF is a standard text file format for representing crystallographic information, maintained by the International Union of Crystallography (IUCr).

## Versions

### CIF 1.1 (Star)

- ASCII-only text (codes 32-127, plus tab/newline)
- Lines limited to 80 characters (commonly extended to 2048)
- Quoted strings (single/double)
- Semicolon text blocks
- No native list/table structures

### CIF 2.0

- UTF-8 encoding support
- Triple-quoted strings (`'''...'''`)
- Native lists (`[...]`)
- Native tables/objects (`{...}`)
- Must start with magic header: `#\#CIF_2.0`

## File Structure

```
# Optional comments
#\#CIF_2.0              # CIF 2.0 only
DATA_blockname
    _tag1 value1
    _tag2 value2
    LOOP_
        _tag3 _tag4
        value3_1 value4_1
        value3_2 value4_2
    SAVE_framename
        _tag5 value5
    SAVE_

DATA_another_block
    ...
```

## Key Features

### 1. Hierarchical Organization

- **Data blocks** (top level)
- **Save frames** (nested within blocks)
- **Loops** (tabular data)
- **Tag-value pairs** (single items)

### 2. Case Insensitivity

All keywords and names are case-insensitive:
- `DATA_` = `data_` = `Data_`
- `LOOP_` = `loop_` = `Loop_`
- `_tag` = `_TAG` = `_Tag`

### 3. Whitespace Rules

- Tags and keywords must be followed by whitespace
- Whitespace separates values
- Newlines are significant in text blocks

### 4. Special Values

- `.` (dot) - Inapplicable value
- `?` (question) - Unknown value

## File Extension

- `.cif` - Standard CIF files
- `.dic` - CIF dictionary files

## Validation Levels

### Syntax Validation

- Correct tag/value syntax
- Proper loop structure
- Valid quote usage
- No duplicate tags in scope

### Dictionary Validation

- Tag names defined in dictionaries
- Values match type constraints
- Values within defined ranges
- Enumeration values valid

## Examples

### Minimal CIF File

```
data_example
    _chemical_name 'Water'
    _chemical_formula_sum 'H2 O'
```

### Complete Crystal Structure

```
data_compound
    _audit_creation_method 'Single crystal X-ray diffraction'
    _chemical_formula_sum 'C6 H12 O6'
    _space_group_name_H-M 'P 1'
    _cell_length_a 10.542(3)
    _cell_length_b 12.345(5)
    _cell_length_c 8.765(4)

    loop_
        _atom_site_label
        _atom_site_type_symbol
        _atom_site_fract_x
        _atom_site_fract_y
        _atom_site_fract_z
        _atom_site_occupancy
    C1  C  0.1234  0.5678  0.9012  1.0
    O1  O  0.2345  0.6789  0.0123  1.0
```

## Related Resources

- [IUCr CIF Dictionaries](https://www.iucr.org/resources/cif/dictionaries)
- [CIF 1.1 Specification](https://www.iucr.org/resources/cif/standard/cif-1-1)
- [CIF 2.0 Specification](https://www.iucr.org/resources/cif/standard/cif-2-0)

## Related Concepts

- [CIF Data Block](../entities/cif-data-block.md)
- [CIF Tag](../entities/cif-tag.md)
- [CIF Value](../entities/cif-value.md)
- [CIF Loop](../entities/cif-loop.md)
- [CIF Dictionary](./cif-dictionary.md)
