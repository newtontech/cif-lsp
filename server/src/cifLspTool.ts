#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { cifKeys, cifKeysSet, hoverText, isValidValue } from "./handlers/cifDictionaryHandler";
import { formatParserError } from "./parser/parserErrors";
import { parser } from "./parser/parser";
import { isValue, Token, TokenType } from "./parser/token";
import { CheckPayload, RichDiagnostic, checkPayload, diagnosticToRich } from "./diagnosticEngineV1";

const OPERATIONS = new Set(["check", "context", "complete", "hover", "symbols", "fix"]);

function main(argv: string[]): number {
  const operation = argv[0];
  const input = argv[1];
  if (operation === "--help" || operation === "-h") {
    console.log("usage: cif-lsp-tool <check|context|complete|hover|symbols|fix> <path> --format json [--line N --character N]");
    return 0;
  }
  if (!operation || !input || !OPERATIONS.has(operation)) {
    console.error(
      "usage: cif-lsp-tool <check|context|complete|hover|symbols|fix> <path> --format json [--line N --character N]",
    );
    return 2;
  }
  const options = parseOptions(argv.slice(2));
  const fileType = path.extname(input).replace(/^\./, "") || "cif";
  const diagnostics = collectDiagnostics(input).map((diagnostic) =>
    diagnosticToRich(diagnostic, input, fileType),
  );
  const payload = buildOperationPayload(input, operation, diagnostics, options.line, options.character);
  console.log(JSON.stringify(payload, null, 2));
  return 0;
}

function parseOptions(argv: string[]): { line: number; character: number } {
  const options = { line: 0, character: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--line" && argv[index + 1]) {
      options.line = Math.max(Number.parseInt(argv[index + 1], 10) || 0, 0);
      index += 1;
    } else if (argv[index] === "--character" && argv[index + 1]) {
      options.character = Math.max(Number.parseInt(argv[index + 1], 10) || 0, 0);
      index += 1;
    }
  }
  return options;
}

function buildOperationPayload(
  input: string,
  operation: string,
  diagnostics: RichDiagnostic[],
  line: number,
  character: number,
): CheckPayload & Record<string, unknown> {
  const uri = pathToFileURL(path.resolve(input)).toString();
  const payload = checkPayload(uri, operation, diagnostics) as CheckPayload & Record<string, unknown>;
  const text = readText(input);
  const parsed = parser(text);
  const position = { line, character };
  payload.position = position;

  if (operation === "check") {
    return payload;
  }
  if (operation === "context") {
    payload.context = {
      ...lineContext(text, line, character),
      path: input,
      file_type: path.extname(input).replace(/^\./, "") || "cif",
      diagnostics_at_position: diagnosticsAtPosition(diagnostics, line, character),
    };
    return payload;
  }
  if (operation === "complete") {
    const dictionaryItems = cifKeys().map((item) => ({
      label: item.label,
      detail: item.detail ?? item.documentation ?? "CIF dictionary data name",
      kind: item.kind,
      source: "cif-dictionary",
    }));
    const tokenItems = parsed.tokens
      .filter((token) => token.type === TokenType.TAG)
      .map((token) => ({
        label: token.text,
        detail: "Data name already present in this CIF",
        kind: 6,
        source: "document",
      }));
    payload.items = dedupeItems([...dictionaryItems, ...tokenItems], "label").slice(0, 250);
    markAvailability(payload, operation, Array.isArray(payload.items) && payload.items.length > 0);
    return payload;
  }
  if (operation === "hover") {
    const selected = tokenAt(parsed.tokens, line, character);
    let contents = selected ? hoverText(selected) : "";
    if (!contents && selected?.type === TokenType.TAG && cifKeysSet().has(selected.text.toLowerCase())) {
      contents = `${selected.text} is a recognized CIF data name.`;
    }
    if (!contents) {
      const diagnostic = diagnosticsAtPosition(diagnostics, line, character)[0];
      contents = diagnostic ? `${diagnostic.code}: ${diagnostic.message}` : "";
    }
    payload.context = lineContext(text, line, character);
    payload.contents = contents || null;
    markAvailability(payload, operation, Boolean(contents), "No hover documentation found for this position.");
    return payload;
  }
  if (operation === "symbols") {
    payload.items = parsed.tokens
      .filter((token) => token.type === TokenType.DATA || token.type === TokenType.SAVE || token.type === TokenType.LOOP || token.type === TokenType.TAG)
      .map(symbolFromToken);
    markAvailability(payload, operation, Array.isArray(payload.items) && payload.items.length > 0);
    return payload;
  }
  if (operation === "fix") {
    payload.actions = (diagnosticsAtPosition(diagnostics, line, character).length
      ? diagnosticsAtPosition(diagnostics, line, character)
      : diagnostics
    ).map((diagnostic, index) => ({
      title: `Review ${diagnostic.code}: ${diagnostic.message}`,
      kind: "quickfix",
      diagnostic_code: diagnostic.code,
      diagnostic_range: diagnostic.range,
      confidence: diagnostic.confidence,
      blocking: diagnostic.blocking,
      safe_to_auto_apply: false,
      edit: null,
      data: { index, source: diagnostic.source },
    }));
    markAvailability(payload, operation, Array.isArray(payload.actions) && payload.actions.length > 0, "No safe quick-fix hints are available for current diagnostics.");
    return payload;
  }
  return payload;
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

function readText(input: string): string {
  try {
    return fs.readFileSync(input, "utf8");
  } catch {
    return "";
  }
}

function lineContext(text: string, line: number, character: number) {
  const lines = text.split(/\r?\n/);
  const lineIndex = Math.min(Math.max(line, 0), Math.max(lines.length - 1, 0));
  const lineText = lines[lineIndex] ?? "";
  const clampedCharacter = Math.min(Math.max(character, 0), lineText.length);
  const match = wordAt(lineText, clampedCharacter);
  return {
    line_text: lineText,
    token: match.text,
    word_range: {
      start: { line: lineIndex, character: match.start },
      end: { line: lineIndex, character: match.end },
    },
    before: lines.slice(Math.max(0, lineIndex - 3), lineIndex),
    after: lines.slice(lineIndex + 1, lineIndex + 4),
  };
}

function wordAt(lineText: string, character: number): { text: string; start: number; end: number } {
  const wordPattern = /[A-Za-z_][A-Za-z0-9_.-]*/g;
  for (const match of lineText.matchAll(wordPattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start <= character && character <= end) {
      return { text: match[0], start, end };
    }
  }
  return { text: "", start: character, end: character };
}

function tokenAt(tokens: Token[], line: number, character: number): Token | undefined {
  return tokens.find((token) => {
    const { start, end } = token.range;
    return (
      start.line <= line &&
      line <= end.line &&
      (line !== start.line || character >= start.character) &&
      (line !== end.line || character <= end.character)
    );
  });
}

function diagnosticsAtPosition(diagnostics: RichDiagnostic[], line: number, character: number): RichDiagnostic[] {
  return diagnostics.filter((diagnostic) => {
    const { start, end } = diagnostic.range;
    return (
      start.line <= line &&
      line <= end.line &&
      (line !== start.line || character >= start.character) &&
      (line !== end.line || character <= end.character)
    );
  });
}

function symbolFromToken(token: Token) {
  return {
    name: token.text,
    kind: TokenType[token.type].toLowerCase(),
    range: token.range,
    selectionRange: token.range,
  };
}

function dedupeItems<T extends Record<string, unknown>>(items: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  const result: T[] = [];
  for (const item of items) {
    const value = item[key];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(item);
  }
  return result;
}

function markAvailability(
  payload: CheckPayload & Record<string, unknown>,
  operation: string,
  available: boolean,
  reason = "No data available for this operation.",
) {
  payload.capabilities = {
    operations: ["check", "context", "complete", "hover", "symbols", "fix"],
    operation,
    status: available ? "available" : "unavailable",
    source: "cifLspTool",
    ...(available ? {} : { reason }),
  };
  if (!available) {
    payload.summary.note = reason;
  }
}

function fallbackRange(): Range {
  return {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 1 },
  };
}

process.exitCode = main(process.argv.slice(2));
