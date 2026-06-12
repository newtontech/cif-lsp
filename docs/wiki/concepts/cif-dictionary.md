# CIF Dictionary (CIF 字典)

**全称**: CIF Definition Dictionary

## Overview

CIF dictionaries are files that define the semantics, validation rules, and documentation for CIF data names. They provide the "schema" for CIF files.

## Dictionary Sources

### Official IUCr Dictionaries

- **Core Dictionaries** (cif_core.dic) - Fundamental crystallographic data items
- **Powder Dictionary** (cif_pow.dic) - Powder diffraction specific
- **MM Dictionary** (cif_mm.dic) - Macromolecular crystallography
- **Reflection Dictionary** (cif_ref.dic) - Reflection data

Available at: [IUCr CIF Dictionaries](https://www.iucr.org/resources/cif/dictionaries)

## Dictionary Structure

Dictionaries use CIF format themselves:

```
SAVE_'.'.'_'item'
_definition.id             '_atom_site_label'
_description.text          'Atom type'
_name.category_id          atom_site
_name.object_id            label
_type.purpose              encode
_type.contents             code
_enumeration_set.state     'C'
_enumeration_set.detail   'C-centered'
SAVE_
```

## Definition Components

### Identification

| Tag | Purpose |
|-----|---------|
| `_definition.id` / `_name` | Primary tag identifier |
| `_alias.definition_id` | Alternative names |
| `_definition.update` | Dictionary version |
| `_definition.class` | Item class (Attribute, Type, etc.) |

### Documentation

| Tag | Purpose |
|-----|---------|
| `_description.text` / `_description` | Human-readable description |
| `_example` | Example usage |
| `_example.detail` | Example explanation |

### Categorization

| Tag | Purpose |
|-----|---------|
| `_name.category_id` | Category name |
| `_name.object_id` | Object name within category |

### Type Specification

| Tag | Purpose | Values |
|-----|---------|--------|
| `_type.purpose` | Purpose | encode, describe, etc. |
| `_type.contents` | Content type | text, code, real, integer, numb, date |
| `_type.source` | Source | assessed, assigned, etc. |
| `_type.container` | Container type | single, list, table |

### Validation

| Tag | Purpose |
|-----|---------|
| `_enumeration.range` | Numeric range (min:max) |
| `_units.code` | Units for numeric values |
| `_enumeration_set.state` | Enumeration state key |
| `_enumeration_set.detail` | Enumeration description |

## Loading Dictionaries

### Via LSP Commands

```
1. CIF: Add Dictionary - Select .dic file
2. CIF: Show Loaded Dictionaries - View active dictionaries
3. CIF: Remove Dictionary - Unload dictionary
```

### Via Command Palette

- `Ctrl+Shift+P` / `Cmd+Shift+P`
- Search "CIF: Add Dictionary"
- Select dictionary file

## Dictionary Processing

### Parsing

```typescript
const tokens = parser(dictionaryContent).tokens;
collectDefinitions(tokens);
```

### Indexing

```typescript
// Store definitions by tag name
tagDefinitions.set('_atom_site_label', definition);

// Create completion items
completionItems.push({
  label: '_atom_site_label',
  kind: CompletionItemKind.Variable,
});
```

### Validation

```typescript
// Check if tag is defined
if (!tagDefinitions.has(tagName.toLowerCase())) {
  // Warning: non-standard data name
}

// Validate value against definition
if (!isValidValue(token)) {
  // Warning: value doesn't match type/range
}
```

## Content Types

| Type | Validation Rule |
|------|-----------------|
| `text` | No specific validation |
| `code` | Typically enumerated values |
| `real` | Must match real number pattern |
| `integer` | Must match integer pattern |
| `numb` | Real or integer |
| `date` | ISO format YYYY-MM-DD (partial allowed) |

## Common Categories

### atom_site

Atomic position and displacement parameters:
- `_atom_site_label`
- `_atom_site_type_symbol`
- `_atom_site_fract_x`, `_atom_site_fract_y`, `_atom_site_fract_z`
- `_atom_site_occupancy`
- `_atom_site_U_iso_or_equiv`

### cell

Unit cell parameters:
- `_cell_length_a`, `_cell_length_b`, `_cell_length_c`
- `_cell_angle_alpha`, `_cell_angle_beta`, `_cell_angle_gamma`
- `_cell_volume`

### space_group

Symmetry information:
- `_space_group_name_H-M`
- `_space_group_name_Hall`
- `_space_group_IT_number`

## Related Concepts

- [CIF Tag](../entities/cif-tag.md)
- [CIF Value](../entities/cif-value.md)
- [CIF Validation](../synthesis/cif-validation.md)
