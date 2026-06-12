# CIF Dictionary Handler Implementation

**来源**: /Users/yhm/Desktop/code/cif-lsp/server/src/handlers/cifDictionaryHandler.ts

## Dictionary System Overview

CIF dictionaries provide semantic definitions for data names (tags) used in CIF files.

## Dictionary Data Structure

```typescript
interface CifDefinitionData {
  id: string;                    // Primary tag name
  alias?: string[];              // Alternative tag names
  update?: string;               // Dictionary version
  description?: string;          // Human-readable description
  category?: string;             // Category ID (_name.category_id)
  object?: string;               // Object ID (_name.object_id)
  type?: string;                 // Type purpose (_type.purpose)
  source?: string;                // Type source (_type.source)
  container?: string;             // Container type (_type.container)
  contents?: string;              // Contents type (_type.contents)
  range?: string;                // Numeric range (min:max)
  units?: string;                // Units code (_units.code)
  stateToDetail?: Map<string, string>;  // Enumeration states
}
```

## Tag Definition Extraction

### Dictionary Entry Structure

Dictionary files contain definitions in SAVE_ or DATA_ blocks:

```
SAVE '_' . '_item'
_definition.id             '_atom_site_label'
_description.text          'Atom type'
_name.category_id          atom_site
_name.object_id            label
_type.purpose              encode
_type.contents             code
...
SAVE_
```

### Key Tags Parsed

| Tag | Purpose |
|-----|---------|
| `_definition.id` / `_name` / `_item.name` | Primary identifier |
| `_alias.definition_id` | Alternative names |
| `_definition.update` | Dictionary version |
| `_description.text` / `_description` | Description |
| `_name.category_id` | Category name |
| `_name.object_id` | Object name within category |
| `_type.purpose` | Type purpose |
| `_type.contents` | Content type (real, integer, etc.) |
| `_enumeration.range` | Valid range |
| `_units.code` | Units |
| `_enumeration_set.state` | Enum state key |
| `_enumeration_set.detail` | Enum state description |

## Completion Items

Completion items are generated from all defined tags:

```typescript
completionItems.push({
  label: key,
  kind: CompletionItemKind.Variable,
  data: key,
});
```

## Hover Information

Hover text shows:
1. Hierarchical context (block → save → loop → tag → value)
2. Definition description
3. Metadata table:

| Field | Display |
|-------|---------|
| Alias | Alternative names |
| Category | category.object |
| Object | object name |
| Type | Type purpose |
| Contents | Content type |
| Range | Valid numeric range |
| Units | Units code |
| Update | Dictionary version |
| Source | Type source |
| Enumeration | State → Detail mappings |

## Value Validation

### Type-based Validation

```typescript
function isValid(def: CifDefinitionData, value: string): boolean {
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
  return true;
}
```

### Range Validation

For numeric types with `_enumeration.range`:

```
Format: "min:max"
- Empty min means no lower bound
- Empty max means no upper bound
- Inclusive bounds
```

### Enumeration Validation

Tags with `_enumeration_set.state` and `_enumeration_set.detail`:

```
_enumeration_set.state    'C'
_enumeration_set.detail   'C-centered'
_enumeration_set.state    'F'
_enumeration_set.detail   'F-centered'
```

Value must match one of the defined states.

## Special Values

- `.` (dot): Inapplicable value
- `?` (question): Unknown value

Both are always valid regardless of type constraints.
