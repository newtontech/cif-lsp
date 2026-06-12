# CIF LSP Wiki Change Log (CIF LSP Wiki 更新日志)

## 2025-06-12 - Initial Wiki Creation

### Created

#### Raw Source Materials (raw/assets/)
- `README-source.md` - Project overview and features
- `server-ts-source.md` - LSP server implementation details
- `parser-ts-source.md` - Parser implementation
- `lexer-ts-source.md` - Lexer/tokenizer implementation
- `dictionary-handler-ts-source.md` - Dictionary management system

#### Entity Pages (entities/)
- `cif-data-block.md` - DATA_ block structure and validation
- `cif-tag.md` - Tag/data name syntax and conventions
- `cif-value.md` - Value types (numeric, text, special values)
- `cif-loop.md` - LOOP_ construct for tabular data
- `cif-save-frame.md` - SAVE_ frame structure
- `cif-comment.md` - Comment syntax and usage

#### Concept Pages (concepts/)
- `cif-file-format.md` - Complete CIF 1.1 and 2.0 format specification
- `cif-dictionary.md` - CIF dictionary system and structure
- `crystallography-domain.md` - Crystallography domain knowledge

#### Synthesis Pages (synthesis/)
- `cif-validation.md` - Validation rules at all levels
- `parser-errors.md` - Error type reference
- `lsp-implementation.md` - Language Server architecture

#### Navigation
- `index.md` - Main wiki navigation and quick reference
- `log.md` - This file

### Total Pages

- **Raw source files**: 5
- **Entity pages**: 6
- **Concept pages**: 3
- **Synthesis pages**: 3
- **Navigation**: 2
- **Total**: 19 pages

### Coverage

The wiki covers:
1. CIF file format syntax (CIF 1.1 and 2.0)
2. Language Server implementation
3. Parser and lexer details
4. Dictionary system
5. Validation rules
6. Error handling
7. Crystallography domain concepts
8. Common CIF tags and categories

## Future Enhancements

Potential additions:
- CIF 2.0 specific features detailed page
- Powder diffraction CIF patterns
- Macromolecular CIF (mmCIF) extensions
- Reflection data formats
- Symmetry operation reference
- Space group examples
- Unit cell parameter reference

## 2026-06-13 - Closeout Pass (Issue #25)

### Upstream Coverage Gap Fill
- [x] `raw/assets/upstream-iucr-reference.md` — Concise manifest of IUCr official docs, dictionaries, tutorials, and tools
- [x] `raw/assets/example-quartz-structure.cif` — Complete α-quartz crystal structure (adapted from IUCr teaching examples)

### Cross-Reference Verification
- All entity pages link to related concepts and synthesis pages
- All concept pages link to relevant entities
- index.md updated with new entries

### LSP-Facing Surface Update
- [x] `lsp-capabilities.json` sourceProvenance expanded from 1 to 6 entries (spec, tutorial, manifest)
- [x] `wiki/synthesis/openqc-agent-context.md` enriched with capability table, provenance links, and example input reference

### Tooling
- [x] `scripts/wiki-lint.sh` — Lightweight wiki lint (orphan + broken-link check)

---

*Wiki created for cif-lsp project following Karpathy-style LLM Wiki pattern.*
