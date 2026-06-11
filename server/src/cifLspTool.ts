#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { cifKeysSet, isValidValue } from "./handlers/cifDictionaryHandler";
import { formatParserError } from "./parser/parserErrors";
import { parser } from "./parser/parser";
import { isValue, TokenType } from "./parser/token";
import { checkPayload, diagnosticToRich } from "./diagnosticEngineV1";

function main(argv: string[]): number {
  const operation = argv[0];
  const input = argv[1];
  if (!operation || !input) {
    console.error("usage: cif-lsp-tool <check|context|complete|hover|symbols|fix> <path> --format json");
    return 2;
  }
  if (operation === "check") {
    const diagnostics = collectDiagnostics(input).map((diagnostic) =>
      diagnosticToRich(diagnostic, input, path.extname(input).replace(/^\./, "") || "cif"),
    );
    console.log(
      JSON.stringify(checkPayload(pathToFileURL(path.resolve(input)).toString(), "check", diagnostics), null, 2),
    );
    return 0;
  }
  const payload = checkPayload(pathToFileURL(path.resolve(input)).toString(), operation, []);
  payload.summary.note = `${operation} is reserved by the Diagnostic Engine v1 CLI contract`;
  console.log(JSON.stringify(payload, null, 2));
  return 0;
}

function collectDiagnostics(input: string): Diagnostic[] {
  let text = "";
  try {
    text = fs.readFileSync(input, "utf8");
  } catch (error) {
    return [
      {
        severity: DiagnosticSeverity.Error,
        range: fallbackRange(),
        message: `Could not read CIF file: ${String(error)}`,
        source: "cif-lsp",
        code: "CIF-IO",
      },
    ];
  }
  const parsed = parser(text);
  const diagnostics: Diagnostic[] = parsed.errors.map((parserError) => ({
    severity: DiagnosticSeverity.Warning,
    range: parserError.token?.range ?? fallbackRange(),
    message: formatParserError(parserError) + (parserError.token?.text ? ` ${parserError.token.text}` : ""),
    source: "cif-lsp",
    code: "CIF-PARSE",
  }));

  const keys = cifKeysSet();
  for (const token of parsed.tokens) {
    if (token.type === TokenType.TAG && token.text && !keys.has(token.text.toLowerCase())) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: token.range,
        message: `'${token.text}' is a non-standard data name.`,
        source: "cif-lsp",
        code: "CIF-SCHEMA",
      });
    }
    if (isValue(token) && !isValidValue(token)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: token.range,
        message: `Value "${token.text}" is not valid for ${token.tag?.text}`,
        source: "cif-lsp",
        code: "CIF-VALUE",
      });
    }
  }
  return diagnostics;
}

function fallbackRange(): Range {
  return {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 1 },
  };
}

process.exitCode = main(process.argv.slice(2));
