# OpenQC Agent Context (OpenQC 智能体上下文)

OpenQC consumes `cif-lsp-tool` and `lsp-capabilities.json` to assemble diagnostics, hover, completion, symbols, examples, next-token guidance, and repair-plan hints for `cif` documents.

## LSP Capability Surface

| Capability | Operation | Source Evidence |
|------------|-----------|-----------------|
| Completion | `complete` | Dictionary-driven; see [CIF Dictionary](../concepts/cif-dictionary.md) |
| Hover | `hover` | Tag definitions + hierarchy context; see [LSP Implementation](./lsp-implementation.md) |
| Diagnostics | `check` | Syntax + semantic; see [CIF Validation](./cif-validation.md), [Parser Errors](./parser-errors.md) |
| Symbols | `symbols` | DATA_ blocks, SAVE_ frames; see [CIF Data Block](../entities/cif-data-block.md) |
| Fix Preview | `fix` | Repair suggestions from parser error recovery |

## Source Provenance

The LSP draws domain knowledge from these upstream sources (recorded in `lsp-capabilities.json` → `sourceProvenance`):

- **CIF 1.1 spec**: https://www.iucr.org/resources/cif/standard/cif-1-1
- **CIF 2.0 spec**: https://www.iucr.org/resources/cif/standard/cif-2-0
- **IUCr dictionaries**: https://www.iucr.org/resources/cif/dictionaries
- **IUCr writing guide**: https://www.iucr.org/resources/cif/wguide
- **Upstream manifest**: [raw/assets/upstream-iucr-reference.md](../../raw/assets/upstream-iucr-reference.md)

## Diagnostic Engine

Diagnostics follow `DiagnosticEnvelope/v1` (see `diagnostics/diagnostic-engine-v1.schema.json`). Blocking policy is `warning-only` by default — diagnostics are surfaced but do not block agent submission.

## Example Input

A complete, valid CIF example is provided at [raw/assets/example-quartz-structure.cif](../../raw/assets/example-quartz-structure.cif) (α-quartz SiO₂ crystal structure from IUCr teaching examples).
