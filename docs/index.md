# CIF LSP Wiki (CIF 语言服务器知识库)

## Overview

This wiki contains comprehensive documentation for the CIF (Crystallographic Information File) Language Server implementation. It covers the CIF file format, language server implementation, and crystallography domain knowledge.

## Navigation

### Raw Source Materials ([raw/](raw/))

Source code extracts and original documentation:
- [README Source](raw/assets/README-source.md) - Project overview
- [Server Implementation](raw/assets/server-ts-source.md) - LSP server code
- [Parser Implementation](raw/assets/parser-ts-source.md) - CIF parser code
- [Lexer Implementation](raw/assets/lexer-ts-source.md) - Tokenizer code
- [Dictionary Handler](raw/assets/dictionary-handler-ts-source.md) - Dictionary processing

### Entity Pages ([entities/](entities/))

Specific CIF file format elements:
- [CIF Data Block](entities/cif-data-block.md) - DATA_ blocks
- [CIF Tag](entities/cif-tag.md) - Data names and tags
- [CIF Value](entities/cif-value.md) - Value types and validation
- [CIF Loop](entities/cif-loop.md) - LOOP_ constructs
- [CIF Save Frame](entities/cif-save-frame.md) - SAVE_ frames
- [CIF Comment](entities/cif-comment.md) - Comments and documentation

### Concept Pages ([concepts/](concepts/))

Cross-cutting ideas and domain knowledge:
- [CIF File Format](concepts/cif-file-format.md) - Complete format specification
- [CIF Dictionary](concepts/cif-dictionary.md) - Dictionary system and validation
- [Crystallography Domain](concepts/crystallography-domain.md) - Crystallography background

### Synthesis Pages ([synthesis/](synthesis/))

Integrated implementation documentation:
- [CIF Validation](synthesis/cif-validation.md) - Validation rules and diagnostics
- [Parser Errors](synthesis/parser-errors.md) - Error types and handling
- [LSP Implementation](synthesis/lsp-implementation.md) - Language Server architecture

## Quick Reference

### CIF Syntax Summary

```
# CIF 1.1 file
DATA_blockname
    _tag_name value
    _another_tag value
    LOOP_
        _tag1 _tag2 _tag3
        value1 value2 value3
        value4 value5 value6
    SAVE_framename
        _frame_tag value
    SAVE_

# CIF 2.0 file
#\#CIF_2.0
DATA_blockname
    _list_value [1, 2, 3]
    _table_value {key: value}
```

### Common Tags

| Category | Example Tags |
|----------|--------------|
| Cell | `_cell_length_a`, `_cell_angle_alpha` |
| Atom Site | `_atom_site_label`, `_atom_site_fract_x` |
| Space Group | `_space_group_name_H-M` |
| Chemical | `_chemical_formula_sum` |

### Validation Rules

1. **Syntax**: Valid tag/value syntax, proper loop structure
2. **Structure**: Unique data blocks, no duplicate tags
3. **Semantic**: Tags defined in dictionaries, valid types/ranges

## Development

### Project Structure

```
cif-lsp/
├── client/           # VS Code extension
├── server/
│   └── src/
│       ├── parser/   # Lexer, parser, validation
│       ├── handlers/ # Dictionary management
│       └── server.ts # LSP implementation
├── syntaxes/         # TextMate grammar
└── docs/            # This wiki
```

### Key Components

1. **Lexer** (`lexer.ts`) - Tokenizes CIF source
2. **Parser** (`parser.ts`) - Builds token tree
3. **Validator** (`validateCifDocument.ts`) - Generates diagnostics
4. **Dictionary Handler** (`cifDictionaryHandler.ts`) - Manages dictionaries
5. **Server** (`server.ts`) - LSP implementation

## Resources

- [IUCr CIF Dictionaries](https://www.iucr.org/resources/cif/dictionaries)
- [CIF 1.1 Specification](https://www.iucr.org/resources/cif/standard/cif-1-1)
- [CIF 2.0 Specification](https://www.iucr.org/resources/cif/standard/cif-2-0)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=thisperiodictable.cif)

## Changelog

See [log.md](log.md) for wiki update history.
