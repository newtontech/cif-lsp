# CIF Tag / Data Name (CIF 标签 / 数据名称)

**别名**: Data name, tag, CIF tag, underscore name

## Definition

A CIF tag (or data name) is a metadata identifier that labels a specific piece of crystallographic information.

## Syntax

```
_category_name.object_name
```

- Must start with underscore `_`
- Followed by category name
- Period separator `.` (optional in some contexts)
- Object name
- Maximum 75 characters

## Naming Convention

### Standard Format

```
_category.object
```

**Examples**:
- `_atom_site.label`
- `_cell.length_a`
- `_chemical_formula.sum`

### Components

1. **Category** (_category): Groups related data
   - `atom_site` - Atomic coordinates
   - `cell` - Unit cell parameters
   - `symmetry` - Symmetry operations

2. **Object** (object): Specific item within category
   - `label`, `type`, `x`, `y`, `z` for atom_site
   - `length_a`, `angle_alpha` for cell

## Token Type

```typescript
TAG = /^_[^\s]+(?=($|\s))/
```

## Case Sensitivity

- CIF tags are **case-insensitive**
- `_cell_length_a` = `_CELL_LENGTH_A` = `_Cell_Length_A`

## Validation

1. **Dictionary Lookup**: Tags validated against loaded CIF dictionaries
2. **Non-Standard Warning**: Unknown tags show warning (configurable)
3. **Duplicate Detection**: Same tag cannot appear twice in same block/frame

## Special Characters

- Underscore `_` - Required prefix
- Period `.` - Category/object separator
- No spaces allowed in tag name

## Common Tag Categories

| Category | Purpose | Example Tags |
|----------|---------|--------------|
| `audit` | Audit metadata | `_audit_creation_method` |
| `chemical` | Chemical info | `_chemical_formula_sum` |
| `cell` | Unit cell | `_cell_length_a` |
| `space_group` | Symmetry | `_space_group_name_H-M` |
| `atom_site` | Atomic data | `_atom_site_label`, `_atom_site_fract_x` |
| `symmetry` | Operations | `_symmetry_equiv_pos_as_xyz` |

## Parser Implementation

```typescript
function tagAndValue(data: Data): boolean {
  const tag = next(data);
  if (is(tag, TokenType.TAG)) {
    const value = next(data);
    if (isValue(value)) {
      value.tag = tag;  // Associate value with its tag
      return true;
    }
  }
  // ...
}
```

## Examples

### Simple Tag-Value

```
_atom_site_label 'C1'
_cell_length_a 10.5
```

### In Loop

```
loop_
    _atom_site_label
    _atom_site_type_symbol
    _atom_site_fract_x
    _atom_site_fract_y
    _atom_site_fract_z
C1  C  0.123  0.456  0.789
```

## Related Concepts

- [CIF Value](../entities/cif-value.md)
- [CIF Loop](../entities/cif-loop.md)
- [CIF Dictionary](../concepts/cif-dictionary.md)
- [CIF Validation](../synthesis/cif-validation.md)
