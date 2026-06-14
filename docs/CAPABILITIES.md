# cif-lsp Capabilities

This document describes the agent-facing capabilities exposed by `cif-lsp`.
The canonical manifest is `lsp-capabilities.json` at the repository root; the
agent CLI mirrors the same data through `cif-lsp-tool capabilities`.

## Agent CLI Surface

The shared entry point is `cif-lsp-tool` (installed as
`./server/out/cifLspTool.js`). Every operation emits JSON that conforms to
the shared `DiagnosticEnvelope/v1` schema.

| Operation      | Purpose                                                        | Issue   |
|----------------|----------------------------------------------------------------|---------|
| `check`        | Run all diagnostics on a CIF file.                             | #13     |
| `context`      | Report the line, token, and diagnostic context at a position.  | #13     |
| `complete`     | Return completion items from loaded dictionaries and the file. | #12     |
| `hover`        | Return hover documentation for the tag at a position.          | #7      |
| `symbols`      | List data blocks, save frames, loops, and tags as symbols.     | #12     |
| `fix`          | Surface code actions for current diagnostics.                  | #21     |
| `format`       | Safe, idempotent formatter (dry-run unless `--write`).         | #3, #5  |
| `explain`      | Describe a single diagnostic rule by `rule_id`.                | #11     |
| `rules`        | Export the diagnostic rule manifest.                           | #11     |
| `capabilities` | Export the OpenQCLspCapabilities envelope.                     | #11     |
| `logs`         | Runtime log parser capability (unavailable for CIF).           | #22     |
| `preflight`    | Universal generated-input preflight envelope.                  | #28     |

## Capability Flags

`cif-lsp-tool capabilities` reports the following flags:

- `completion: true` — dictionary-driven completion through `complete`.
- `diagnostics: true` — full diagnostics pipeline through `check`.
- `hover: true` — dictionary-aware hover through `hover`.
- `symbols: true` — document symbols through `symbols`.
- `code_actions: true` — quick-fix actions through `fix`, including a
  safe-to-apply insertion for `cif.cell.missing_parameters`.
- `format: true` — safe, idempotent formatter through `format`.
- `rules_manifest: true` — rule manifest export through `rules` and `explain`.
- `runtime_log_parser: false` — CIF is a static-data format; the `logs`
  capability reports `status: "unavailable"` with a stable reason.
- `preflight: true` — `DiagnosticEnvelope/v1` artifact graph, version
  assumptions, and fleet regression fixtures.

## Diagnostic Envelope

Every operation that emits diagnostics uses the shared
`DiagnosticEnvelope/v1` shape. The schema lives at
`diagnostics/diagnostic-engine-v1.schema.json` and requires:

- `code`, `severity`, `category`, `confidence`, `source`
- `range.start`/`range.end` with `line`/`character`
- `software`, `file_type`, `path`
- `fix_hints`, `manual_ref`, `blocking`

Rule-managed diagnostics additionally carry `fix_hints` and `manual_ref`
from `rules/diagnostics.yaml` so downstream agents can present targeted
repair guidance.

## Formatter Contract

`cif-lsp-tool format <path> [--write]` runs the safe CIF formatter. The
formatter:

- normalizes `\r\n` line endings to `\n`,
- trims trailing whitespace from each line (without touching multiline `;...;`
  bodies),
- collapses long blank-line runs,
- aligns consecutive single-line `_tag value` pairs to a common column,
- guarantees exactly one trailing newline.

The formatter is idempotent: re-running it on its own output reports
`changed: false`. The `idempotent: true` flag is always present in the
payload and is asserted by the test suite.
