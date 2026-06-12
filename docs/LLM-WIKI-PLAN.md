# LLM Wiki Plan for cif-lsp Project

## Overview

This document outlines the LLM Wiki knowledge base structure for the cif-lsp (CIF Language Server) project, following Andrej Karpathy's LLM-maintained wiki pattern.

## Target Audience

- LLMs working with CIF file format
- Developers maintaining the CIF LSP
- Crystallographers using CIF files
- Tools processing crystallographic data

## Wiki Structure

```
docs/
├── raw/
│   └── assets/          # Source evidence files
│       ├── README-source.md
│       ├── server-ts-source.md
│       ├── parser-ts-source.md
│       ├── lexer-ts-source.md
│       └── dictionary-handler-ts-source.md
├── wiki/
│   ├── entities/        # CIF-specific concepts
│   │   ├── cif-data-block.md
│   │   ├── cif-tag.md
│   │   ├── cif-value.md
│   │   ├── cif-loop.md
│   │   ├── cif-save-frame.md
│   │   └── cif-comment.md
│   ├── concepts/        # Cross-cutting ideas
│   │   ├── cif-file-format.md
│   │   ├── cif-dictionary.md
│   │   └── crystallography-domain.md
│   └── synthesis/       # Integrated documentation
│       ├── cif-validation.md
│       ├── parser-errors.md
│       └── lsp-implementation.md
├── index.md             # Navigation hub
└── log.md               # Change log
```

## Content Coverage

### Domain: Crystallographic Information File (CIF)

1. **File Format** - CIF 1.1 and CIF 2.0 specifications
2. **Syntax** - Tags, values, loops, save frames, data blocks
3. **Validation** - Syntax, structure, and semantic validation
4. **Dictionaries** - IUCr CIF dictionaries and definitions
5. **Crystallography** - Unit cells, space groups, atomic positions

### Implementation: Language Server

1. **Parser** - Lexer and recursive descent parser
2. **LSP** - Completion, hover, diagnostics
3. **Dictionary System** - Loading, parsing, validation
4. **Error Handling** - Error types and diagnostics

## File Creation Checklist

### Raw/Assets (Source Evidence)
- [x] README-source.md
- [x] server-ts-source.md
- [x] parser-ts-source.md
- [x] lexer-ts-source.md
- [x] dictionary-handler-ts-source.md

### Wiki/Entities
- [x] cif-data-block.md
- [x] cif-tag.md
- [x] cif-value.md
- [x] cif-loop.md
- [x] cif-save-frame.md
- [x] cif-comment.md

### Wiki/Concepts
- [x] cif-file-format.md
- [x] cif-dictionary.md
- [x] crystallography-domain.md

### Wiki/Synthesis
- [x] cif-validation.md
- [x] parser-errors.md
- [x] lsp-implementation.md

### Navigation
- [x] index.md
- [x] log.md
- [x] LLM-WIKI-PLAN.md (this file)

## Total Count

- **Target**: 15-25 wiki files
- **Created**: 19 files
- **Raw sources**: 5 files
- **Wiki pages**: 14 files
- **Navigation**: 3 files (including this plan)

## Bilingual Format

Each page uses:
- **Chinese headings** (中文名称)
- **English terms** in definitions
- **Bilingual aliases** where applicable

Example:
```markdown
# CIF Data Block (CIF 数据块)

**别名**: DATA_ block, data block
```

## Related Concepts

Each page includes links to related concepts for navigation:
```markdown
## Related Concepts

- [CIF File Format](../concepts/cif-file-format.md)
- [CIF Tag](../entities/cif-tag.md)
```

## Completion Status

**Status**: Complete

All planned wiki files have been created covering:
1. CIF file format (CIF 1.1 and CIF 2.0)
2. All CIF structural elements (blocks, tags, values, loops, save frames, comments)
3. Crystallography domain knowledge
4. LSP implementation details
5. Validation and error handling
6. Dictionary system

## Git Integration

The wiki files will be committed with:
```
feat: add LLM Wiki knowledge base (raw/ + wiki/ + index.md + log.md)
```

---

*Plan created: 2025-06-12*
*Wiki completed: 2025-06-12*
