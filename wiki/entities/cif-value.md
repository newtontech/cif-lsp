# CIF Value (CIF 值)

**别名**: Data value, field value

## Definition

A CIF value is the data associated with a CIF tag, representing a specific piece of crystallographic information.

## Value Types

### 1. Numeric Values

#### Simple Numbers

```
_cell_length_a 10.5
_temperature 273.15
```

#### Scientific Notation

```
_wavelength 1.5418E-10
_cell_volume 5.432e+02
```

#### Numbers with Uncertainty (esd)

```
_cell_length_a 10.542(3)
_atom_site_fract_x 0.1234(15)
```

Format: `value(esd)` where esd is estimated standard deviation in last digits.

### 2. Text Values

#### Single-Quoted

```
_chemical_name 'Glucose'
_atom_type_symbol 'C'
```

Rules:
- Single quotes `'` only at start and end
- No unescaped quotes inside
- Whitespace after closing quote required

#### Double-Quoted

```
_description "A sample description"
```

Rules:
- Double quotes `"` only at start and end
- No unescaped quotes inside
- Whitespace after closing quote required

#### Unquoted

```
_space_group_name_H-M  P 1 21/c 1
_symmetry_equiv_pos_as_xyz  'x, y, z'
```

Rules:
- No whitespace or special characters
- Must not start with quote or number
- Case-sensitive

#### Multiline Text Blocks

```
_text
;
This is a multiline text block.
It can contain multiple lines.
;
```

Rules:
- Start with line containing only semicolon `;`
- End with line containing only semicolon `;`
- Can contain any characters including newlines

### 3. Special Values

#### Inapplicable Value (dot)

```
_cell_length_a .
```

The dot `.` indicates the value is not applicable for this item.

#### Unknown Value (question)

```
_atom_site_occupancy ?
```

The question mark `?` indicates the value is unknown or missing.

### 4. CIF 2.0 Collections

#### Lists

```
_atom_site_aniso_U[1] [0.023, 0.015, 0.018]
```

Square brackets denote list values.

#### Tables

```
_some_key {key1: value1, key2: value2}
```

Curly braces denote table/dictionary values.

## Validation Rules

### Type-Based Validation

| Type | Validation Rule |
|------|-----------------|
| `real` / `float` | Valid real number with optional esd |
| `integer` / `int` | Integer with optional esd |
| `numb` | Either real or integer |
| `date` | ISO format YYYY-MM-DD (partial dates allowed) |

### Range Validation

For tags with defined ranges:

```
_enumeration.range: 0:1
```

Values must be within the specified inclusive range.

### Enumeration Validation

For tags with defined enumerations:

```
_enumeration_set.state  'C'
_enumeration_set.detail  'C-centered'
```

Value must match one of the defined states.

## Parser Implementation

```typescript
export function isValue(token: Token): boolean {
  return (
    token && TokenType.SINGLE <= token.type && token.type <= TokenType.UNQUOTED
  );
}

export function parseCifNumber(value: string): number {
  return Number(value.replace(/\([0-9]+\)$/, ""));  // Remove esd
}
```

## Examples

### Complete CIF Entry

```
data_example
    _cell_length_a      10.542(3)
    _cell_length_b      12.345
    _cell_angle_alpha   90.0
    _chemical_formula_sum 'C6 H12 O6'
    _space_group_name_H-M 'P 1'
    _temperature         .
```

### Loop with Multiple Values

```
loop_
    _atom_site_label
    _atom_site_fract_x
    _atom_site_fract_y
    _atom_site_fract_z
C1  0.1234  0.5678  0.9012
C2  0.2345  0.6789  0.0123
```

## Related Concepts

- [CIF Tag](../entities/cif-tag.md)
- [CIF Loop](../entities/cif-loop.md)
- [CIF Dictionary](../concepts/cif-dictionary.md)
- [CIF Validation](../synthesis/cif-validation.md)
