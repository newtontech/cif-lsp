# newtontech/cif-lsp

This repository is a public fork of `hmkainul/vscode-cif`, preserving the MIT
licensed CIF VS Code extension and TypeScript language server.

## Public Interface

The existing server lives under `server/` and already provides CIF parsing,
diagnostics, completion, and hover support through `vscode-languageserver`.

Roadmap issues track a standalone `cif-lsp --stdio` package, a `cif-lint`
wrapper with the shared newtontech diagnostic JSON shape, mocked checkCIF
validation, formatter coverage, and OpenQC integration.
