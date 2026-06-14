#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import {
  cifKeys,
  cifKeysSet,
  hoverText,
  isValidValue,
} from "./handlers/cifDictionaryHandler";
import { formatParserError } from "./parser/parserErrors";
import { parser } from "./parser/parser";
import { isValue, Token, TokenType } from "./parser/token";
import {
  CheckPayload,
  RichDiagnostic,
  checkPayload,
  diagnosticToRich,
} from "./diagnosticEngineV1";
import {
  getRuleById,
  getRuleForErrorType,
  ruleManifest,
} from "./rules/cifRules";
import { formatCif } from "./format/cifFormatter";

const OPERATIONS = new Set([
  "check",
  "context",
  "complete",
  "hover",
  "symbols",
  "fix",
  "format",
  "explain",
  "rules",
  "capabilities",
  "logs",
  "preflight",
]);

function main(argv: string[]): number {
  const operation = argv[0];
  const input = argv[1];
  if (operation === "--help" || operation === "-h") {
    console.log(
      "usage: cif-lsp-tool <check|context|complete|hover|symbols|fix|format> <path> --format json [--line N --character N] [--write]",
    );
    console.log(
      "       cif-lsp-tool format <path> [--write]    # safe, idempotent formatter",
    );
    console.log(
      "       cif-lsp-tool explain <rule_id>          # describe a single diagnostic rule",
    );
    console.log(
      "       cif-lsp-tool rules                      # list exported diagnostic rules",
    );
    console.log(
      "       cif-lsp-tool capabilities               # export LSP/OpenQC capability manifest",
    );
    console.log(
      "       cif-lsp-tool logs <path>                # runtime log parser capability",
    );
    console.log(
      "       cif-lsp-tool preflight <path>           # universal generated-input preflight checks",
    );
    return 0;
  }
  if (!operation || !OPERATIONS.has(operation)) {
    console.error(
      "usage: cif-lsp-tool <check|context|complete|hover|symbols|fix|format> <path> --format json [--line N --character N] [--write]",
    );
    return 2;
  }
  if (operation === "rules") {
    console.log(JSON.stringify(rulesPayload(), null, 2));
    return 0;
  }
  if (operation === "explain") {
    const ruleId = input ?? "";
    console.log(JSON.stringify(explainPayload(ruleId), null, 2));
    return 0;
  }
  if (operation === "capabilities") {
    console.log(JSON.stringify(capabilitiesPayload(), null, 2));
    return 0;
  }
  if (operation === "logs") {
    if (!input) {
      console.error("usage: cif-lsp-tool logs <path> --format json");
      return 2;
    }
    console.log(JSON.stringify(logsPayload(input), null, 2));
    return 0;
  }
  if (!input) {
    console.error(
      "usage: cif-lsp-tool <check|context|complete|hover|symbols|fix|format> <path> --format json [--line N --character N] [--write]",
    );
    return 2;
  }
  const options = parseOptions(argv.slice(2));
  const fileType = path.extname(input).replace(/^\./, "") || "cif";

  if (operation === "format") {
    const payload = formatPayload(input, options.write === true);
    if (options.write === true && payload.summary.written === true) {
      // File rewritten; the JSON payload still reports the diff summary.
    }
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  const diagnostics = collectDiagnostics(input)
    .map((diagnostic) => diagnosticToRich(diagnostic, input, fileType))
    .map(attachRuleMetadata);

  if (operation === "preflight") {
    console.log(JSON.stringify(preflightPayload(input, diagnostics), null, 2));
    return 0;
  }

  const payload = buildOperationPayload(
    input,
    operation,
    diagnostics,
    options.line,
    options.character,
  );
  console.log(JSON.stringify(payload, null, 2));
  return 0;
}

function parseOptions(argv: string[]): {
  line: number;
  character: number;
  write: boolean;
} {
  const options = { line: 0, character: 0, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--line" && argv[index + 1]) {
      options.line = Math.max(Number.parseInt(argv[index + 1], 10) || 0, 0);
      index += 1;
    } else if (argv[index] === "--character" && argv[index + 1]) {
      options.character = Math.max(
        Number.parseInt(argv[index + 1], 10) || 0,
        0,
      );
      index += 1;
    } else if (argv[index] === "--write") {
      options.write = true;
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
  const payload = checkPayload(uri, operation, diagnostics) as CheckPayload &
    Record<string, unknown>;
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
      diagnostics_at_position: diagnosticsAtPosition(
        diagnostics,
        line,
        character,
      ),
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
    payload.items = dedupeItems(
      [...dictionaryItems, ...tokenItems],
      "label",
    ).slice(0, 250);
    markAvailability(
      payload,
      operation,
      Array.isArray(payload.items) && payload.items.length > 0,
    );
    return payload;
  }
  if (operation === "hover") {
    const selected = tokenAt(parsed.tokens, line, character);
    let contents = selected ? hoverText(selected) : "";
    if (
      !contents &&
      selected?.type === TokenType.TAG &&
      cifKeysSet().has(selected.text.toLowerCase())
    ) {
      contents = `${selected.text} is a recognized CIF data name.`;
    }
    if (!contents) {
      const diagnostic = diagnosticsAtPosition(diagnostics, line, character)[0];
      contents = diagnostic ? `${diagnostic.code}: ${diagnostic.message}` : "";
    }
    payload.context = lineContext(text, line, character);
    payload.contents = contents || null;
    markAvailability(
      payload,
      operation,
      Boolean(contents),
      "No hover documentation found for this position.",
    );
    return payload;
  }
  if (operation === "symbols") {
    payload.items = parsed.tokens
      .filter(
        (token) =>
          token.type === TokenType.DATA ||
          token.type === TokenType.SAVE ||
          token.type === TokenType.LOOP ||
          token.type === TokenType.TAG,
      )
      .map(symbolFromToken);
    markAvailability(
      payload,
      operation,
      Array.isArray(payload.items) && payload.items.length > 0,
    );
    return payload;
  }
  if (operation === "fix") {
    payload.actions = (
      diagnosticsAtPosition(diagnostics, line, character).length
        ? diagnosticsAtPosition(diagnostics, line, character)
        : diagnostics
    ).map((diagnostic, index) => buildCodeAction(diagnostic, index, text));
    markAvailability(
      payload,
      operation,
      Array.isArray(payload.actions) && payload.actions.length > 0,
      "No safe quick-fix hints are available for current diagnostics.",
    );
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
  const diagnostics: Diagnostic[] = parsed.errors.map((parserError) => {
    const rule = getRuleForErrorType(parserError.type);
    if (rule) {
      return {
        severity: rule.severity,
        range: parserError.token?.range ?? fallbackRange(),
        message: rule.message(parserError.token),
        source: rule.source,
        code: rule.rule_id,
      };
    }
    return {
      severity: DiagnosticSeverity.Warning,
      range: parserError.token?.range ?? fallbackRange(),
      message:
        formatParserError(parserError) +
        (parserError.token?.text ? ` ${parserError.token.text}` : ""),
      source: "cif-lsp",
      code: "CIF-PARSE",
    };
  });

  const keys = cifKeysSet();
  for (const token of parsed.tokens) {
    if (
      token.type === TokenType.TAG &&
      token.text &&
      !keys.has(token.text.toLowerCase())
    ) {
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

function wordAt(
  lineText: string,
  character: number,
): { text: string; start: number; end: number } {
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

function tokenAt(
  tokens: Token[],
  line: number,
  character: number,
): Token | undefined {
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

function diagnosticsAtPosition(
  diagnostics: RichDiagnostic[],
  line: number,
  character: number,
): RichDiagnostic[] {
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

function dedupeItems<T extends Record<string, unknown>>(
  items: T[],
  key: keyof T,
): T[] {
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

/**
 * Canonical list of operations exposed by the agent CLI. The same list is
 * surfaced by every payload's `capabilities.operations` so OpenQC and other
 * consumers can rely on a single source of truth.
 */
const CAPABILITY_OPERATIONS: readonly string[] = [
  "check",
  "context",
  "complete",
  "hover",
  "symbols",
  "fix",
  "format",
  "explain",
  "rules",
  "capabilities",
  "logs",
  "preflight",
];

function markAvailability(
  payload: CheckPayload & Record<string, unknown>,
  operation: string,
  available: boolean,
  reason = "No data available for this operation.",
) {
  payload.capabilities = {
    operations: [...CAPABILITY_OPERATIONS],
    operation,
    status: available ? "available" : "unavailable",
    source: "cifLspTool",
    ...(available ? {} : { reason }),
  };
  if (!available) {
    payload.summary.note = reason;
  }
}

interface RuleManifestPayload {
  uri: null;
  operation: "rules";
  ok: boolean;
  version: "1.0";
  software: "cif";
  diagnostic_engine: "1.0";
  manifest_source: "rules/diagnostics.yaml";
  rules: ReturnType<typeof ruleManifest>;
  summary: {
    count: number;
    errors: number;
    warnings: number;
    note?: string;
  };
  capabilities: {
    operations: string[];
    operation: "rules";
    status: "available" | "unavailable";
    source: string;
    reason?: string;
  };
}

function rulesPayload(): RuleManifestPayload {
  const rules = ruleManifest();
  return {
    uri: null,
    operation: "rules",
    ok: true,
    version: "1.0",
    software: "cif",
    diagnostic_engine: "1.0",
    manifest_source: "rules/diagnostics.yaml",
    rules,
    summary: {
      count: rules.length,
      errors: rules.filter((rule) => rule.severity === "error").length,
      warnings: rules.filter((rule) => rule.severity === "warning").length,
    },
    capabilities: {
      operations: [...CAPABILITY_OPERATIONS],
      operation: "rules",
      status: rules.length > 0 ? "available" : "unavailable",
      source: "cifLspTool",
    },
  };
}

interface ExplainPayload {
  uri: null;
  operation: "explain";
  ok: boolean;
  version: "1.0";
  software: "cif";
  diagnostic_engine: "1.0";
  rule: ReturnType<typeof ruleManifest>[number] | null;
  requested_rule_id: string;
  summary: {
    found: boolean;
    note?: string;
  };
  capabilities: {
    operations: string[];
    operation: "explain";
    status: "available" | "unavailable";
    source: string;
    reason?: string;
  };
}

function explainPayload(ruleId: string): ExplainPayload {
  const rule = getRuleById(ruleId);
  const manifest = rule
    ? (ruleManifest().find((entry) => entry.rule_id === ruleId) ?? null)
    : null;
  const found = manifest !== null;
  const note = found
    ? undefined
    : `No rule registered with rule_id '${ruleId}'.`;
  return {
    uri: null,
    operation: "explain",
    ok: found,
    version: "1.0",
    software: "cif",
    diagnostic_engine: "1.0",
    rule: manifest,
    requested_rule_id: ruleId,
    summary: { found, ...(note ? { note } : {}) },
    capabilities: {
      operations: [...CAPABILITY_OPERATIONS],
      operation: "explain",
      status: found ? "available" : "unavailable",
      source: "cifLspTool",
      ...(found ? {} : { reason: note ?? "Rule not found." }),
    },
  };
}

function fallbackRange(): Range {
  return {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 1 },
  };
}

/**
 * Fold rule-managed metadata (fix hints, manual reference) onto rich
 * diagnostics whose code is a registered rule_id. Returns a new object so the
 * caller's diagnostics are never mutated in place.
 */
function attachRuleMetadata(diagnostic: RichDiagnostic): RichDiagnostic {
  const rule = getRuleById(diagnostic.code);
  if (!rule) {
    return diagnostic;
  }
  return {
    ...diagnostic,
    category: rule.category,
    fix_hints: [...rule.fix_hints],
    manual_ref: rule.manual_ref,
  };
}

/**
 * The canonical cell-parameter tag list. Mirrors the validator's
 * CELL_PARAMETER_TAGS so the code action can deterministically insert the
 * missing declarations as placeholder (`?`) values.
 */
const CELL_PARAMETER_TAGS_CANONICAL: readonly string[] = [
  "_cell_length_a",
  "_cell_length_b",
  "_cell_length_c",
  "_cell_angle_alpha",
  "_cell_angle_beta",
  "_cell_angle_gamma",
];

interface CodeAction {
  title: string;
  kind: string;
  diagnostic_code: string;
  diagnostic_range: Range;
  confidence: number;
  blocking: boolean;
  safe_to_auto_apply: boolean;
  edit: {
    edits: Array<{
      range: Range;
      new_text: string;
    }>;
  } | null;
  data: Record<string, unknown>;
}

/**
 * Builds a code action for a single diagnostic. The action is marked
 * `safe_to_auto_apply: true` only when the repair is deterministic and cannot
 * destroy user data:
 * - `cif.cell.missing_parameters` inserts the missing `_cell_*` tags with
 *   CIF's missing-data marker (`?`) so the user can fill them in.
 *
 * Every other diagnostic currently surfaces a review-only quick-fix that
 * points the user at the relevant rule, fix hints, and manual reference
 * without rewriting the file.
 */
function buildCodeAction(
  diagnostic: RichDiagnostic,
  index: number,
  sourceText: string,
): CodeAction {
  if (diagnostic.code === "cif.cell.missing_parameters") {
    const edit = buildMissingCellParametersEdit(diagnostic, sourceText);
    if (edit !== null) {
      return {
        title: `Insert missing unit-cell parameter tags for ${diagnostic.code}`,
        kind: "quickfix",
        diagnostic_code: diagnostic.code,
        diagnostic_range: diagnostic.range,
        confidence: diagnostic.confidence,
        blocking: diagnostic.blocking,
        safe_to_auto_apply: true,
        edit,
        data: { index, source: diagnostic.source },
      };
    }
  }
  return {
    title: `Review ${diagnostic.code}: ${diagnostic.message}`,
    kind: "quickfix",
    diagnostic_code: diagnostic.code,
    diagnostic_range: diagnostic.range,
    confidence: diagnostic.confidence,
    blocking: diagnostic.blocking,
    safe_to_auto_apply: false,
    edit: null,
    data: { index, source: diagnostic.source },
  };
}

/**
 * Computes a deterministic text edit for `cif.cell.missing_parameters`.
 *
 * The edit inserts every missing `_cell_*` tag (canonical CIF core name
 * shape) immediately after the data-block header, each set to the CIF
 * missing-data marker `?`. The edit range is zero-width and anchored at the
 * end of the block header line so applying it never overwrites existing
 * content.
 */
function buildMissingCellParametersEdit(
  diagnostic: RichDiagnostic,
  sourceText: string,
): { edits: Array<{ range: Range; new_text: string }> } | null {
  const blockLine = diagnostic.range.start.line;
  const lines = sourceText.split(/\r?\n/);
  if (blockLine >= lines.length) {
    return null;
  }
  const present = new Set(
    lines
      .map((line) => /^(_cell_\S+)[ \t]/.exec(line.trim()))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => m[1].toLowerCase()),
  );
  const missing = CELL_PARAMETER_TAGS_CANONICAL.filter(
    (tag) => !present.has(tag.toLowerCase()),
  );
  if (missing.length === 0) {
    return null;
  }
  const insertion = missing.map((tag) => `${tag} ?`).join("\n") + "\n";
  return {
    edits: [
      {
        range: {
          start: { line: blockLine + 1, character: 0 },
          end: { line: blockLine + 1, character: 0 },
        },
        new_text: insertion,
      },
    ],
  };
}

interface FormatPayload {
  uri: string;
  operation: "format";
  ok: boolean;
  version: "1.0";
  software: "cif";
  diagnostic_engine: "1.0";
  changed: boolean;
  idempotent: boolean;
  formatted_preview: string;
  summary: {
    lines: number;
    written: boolean;
    trailing_whitespace_trimmed: number;
    blank_runs_collapsed: number;
    tag_runs_aligned: number;
    line_endings_normalized: boolean;
    trailing_newline_added: boolean;
  };
  capabilities: {
    operations: string[];
    operation: "format";
    status: "available" | "unavailable";
    source: string;
  };
}

/**
 * Formats a CIF file with the safe, idempotent formatter. When `write` is
 * true the formatted text is written back to `input`; otherwise the JSON
 * payload includes a `formatted_preview` field for caller inspection.
 */
function formatPayload(input: string, write: boolean): FormatPayload {
  const uri = pathToFileURL(path.resolve(input)).toString();
  let source = "";
  try {
    source = fs.readFileSync(input, "utf8");
  } catch {
    return {
      uri,
      operation: "format",
      ok: false,
      version: "1.0",
      software: "cif",
      diagnostic_engine: "1.0",
      changed: false,
      idempotent: true,
      formatted_preview: "",
      summary: {
        lines: 0,
        written: false,
        trailing_whitespace_trimmed: 0,
        blank_runs_collapsed: 0,
        tag_runs_aligned: 0,
        line_endings_normalized: false,
        trailing_newline_added: false,
      },
      capabilities: {
        operations: [...CAPABILITY_OPERATIONS],
        operation: "format",
        status: "unavailable",
        source: "cifLspTool",
      },
    };
  }
  const result = formatCif(source);
  const secondPass = formatCif(result.formatted);
  const idempotent = !secondPass.changed;
  let written = false;
  if (write && result.changed) {
    fs.writeFileSync(input, result.formatted, "utf8");
    written = true;
  }
  return {
    uri,
    operation: "format",
    ok: true,
    version: "1.0",
    software: "cif",
    diagnostic_engine: "1.0",
    changed: result.changed,
    idempotent,
    formatted_preview: write ? "" : result.formatted,
    summary: {
      lines: result.summary.lines,
      written,
      trailing_whitespace_trimmed: result.summary.trailing_whitespace_trimmed,
      blank_runs_collapsed: result.summary.blank_runs_collapsed,
      tag_runs_aligned: result.summary.tag_runs_aligned,
      line_endings_normalized: result.summary.line_endings_normalized,
      trailing_newline_added: result.summary.trailing_newline_added,
    },
    capabilities: {
      operations: [...CAPABILITY_OPERATIONS],
      operation: "format",
      status: "available",
      source: "cifLspTool",
    },
  };
}

interface CapabilitiesPayload {
  uri: null;
  operation: "capabilities";
  ok: boolean;
  version: "1.0";
  software: "cif";
  diagnostic_engine: "1.0";
  capabilities: {
    schema: string;
    manifest_path: string;
    operations: readonly string[];
    diagnostic_engine_version: "1.0";
    envelope: "DiagnosticEnvelope/v1";
    agent_cli: {
      command: string;
      json_format: boolean;
      fail_on_blocking: boolean;
    };
    capability_flags: {
      completion: boolean;
      diagnostics: boolean;
      hover: boolean;
      symbols: boolean;
      code_actions: boolean;
      format: boolean;
      rules_manifest: boolean;
      runtime_log_parser: boolean;
      preflight: boolean;
    };
    operation: "capabilities";
    status: "available";
    source: string;
  };
}

/**
 * Static LSP/OpenQC capability manifest surfaced through the agent CLI. The
 * flags mirror `lsp-capabilities.json` so consumers that prefer the JSON
 * envelope can read either source.
 */
function capabilitiesPayload(): CapabilitiesPayload {
  return {
    uri: null,
    operation: "capabilities",
    ok: true,
    version: "1.0",
    software: "cif",
    diagnostic_engine: "1.0",
    capabilities: {
      schema: "OpenQCLspCapabilities",
      manifest_path: "lsp-capabilities.json",
      operations: CAPABILITY_OPERATIONS,
      diagnostic_engine_version: "1.0",
      envelope: "DiagnosticEnvelope/v1",
      agent_cli: {
        command: "cif-lsp-tool",
        json_format: true,
        fail_on_blocking: true,
      },
      capability_flags: {
        completion: true,
        diagnostics: true,
        hover: true,
        symbols: true,
        code_actions: true,
        format: true,
        rules_manifest: true,
        runtime_log_parser: false,
        preflight: true,
      },
      operation: "capabilities",
      status: "available",
      source: "cifLspTool",
    },
  };
}

interface LogsPayload {
  uri: string;
  operation: "logs";
  ok: boolean;
  version: "1.0";
  software: "cif";
  diagnostic_engine: "1.0";
  capability: {
    id: "runtime-log-parser";
    status: "unavailable";
    reason: string;
    source_of_truth: string;
  };
  entries: never[];
  summary: {
    count: number;
    note: string;
  };
  capabilities: {
    operations: readonly string[];
    operation: "logs";
    status: "unavailable";
    source: string;
    reason: string;
  };
}

/**
 * Runtime log parser capability envelope. CIF is a static-data format with
 * no runtime log semantics, so the capability reports a stable
 * `unavailable` status with a human-readable reason rather than silently
 * omitting the operation. This satisfies the OpenQC contract: "OpenQC
 * either launches the LSP for this capability or reports the backend
 * unavailable clearly."
 */
function logsPayload(input: string): LogsPayload {
  const uri = pathToFileURL(path.resolve(input)).toString();
  const reason =
    "CIF is a static-data format and does not produce runtime logs; the runtime-log-parser capability is intentionally not implemented for cif-lsp.";
  return {
    uri,
    operation: "logs",
    ok: true,
    version: "1.0",
    software: "cif",
    diagnostic_engine: "1.0",
    capability: {
      id: "runtime-log-parser",
      status: "unavailable",
      reason,
      source_of_truth:
        "issue #22 [Capability] cif-lsp: Runtime log parser",
    },
    entries: [],
    summary: { count: 0, note: reason },
    capabilities: {
      operations: CAPABILITY_OPERATIONS,
      operation: "logs",
      status: "unavailable",
      source: "cifLspTool",
      reason,
    },
  };
}

interface PreflightPayload {
  uri: string;
  operation: "preflight";
  ok: boolean;
  version: "1.0";
  software: "cif";
  diagnostic_engine: "1.0";
  envelope: "DiagnosticEnvelope/v1";
  diagnostics: RichDiagnostic[];
  artifact_graph: {
    artifacts: Array<{
      role: string;
      path: string;
      file_type: string;
      version_assumption: string;
    }>;
    edges: Array<{
      from: string;
      to: string;
      relationship: string;
    }>;
  };
  version_assumptions: Array<{
    artifact: string;
    assumption: string;
    source: string;
  }>;
  regression_fixtures: {
    valid: string[];
    invalid: string[];
    source: string;
  };
  summary: {
    count: number;
    blocking: number;
    errors: number;
    warnings: number;
    artifacts: number;
    note?: string;
  };
  capabilities: {
    operations: readonly string[];
    operation: "preflight";
    status: "available";
    source: string;
  };
}

/**
 * Universal generated-input preflight envelope.
 *
 * Re-uses the existing diagnostic pipeline (rules engine, schema checks) so
 * cif-lsp participates in the same generic generated-input preflight model
 * as the rest of the newtontech scientific LSP fleet. Adds three generic
 * cross-cutting sections that the parent router (`bohrium_skills`) consumes:
 * - `artifact_graph`: a generic artifact-role model describing the file
 *   under inspection.
 * - `version_assumptions`: explicit version metadata so agents can decide
 *   whether the runtime/image version is known.
 * - `regression_fixtures`: paths to the rule fixtures so fleet-wide
 *   regression evidence is machine-readable.
 */
function preflightPayload(
  input: string,
  diagnostics: RichDiagnostic[],
): PreflightPayload {
  const uri = pathToFileURL(path.resolve(input)).toString();
  const fileType = path.extname(input).replace(/^\./, "") || "cif";
  let source = "";
  try {
    source = fs.readFileSync(input, "utf8");
  } catch {
    source = "";
  }
  const isCif2 = source.startsWith("#\\#CIF_2.0");
  const blocking = diagnostics.filter((d) => d.blocking).length;
  return {
    uri,
    operation: "preflight",
    ok: blocking === 0,
    version: "1.0",
    software: "cif",
    diagnostic_engine: "1.0",
    envelope: "DiagnosticEnvelope/v1",
    diagnostics,
    artifact_graph: {
      artifacts: [
        {
          role: "primary-input",
          path: input,
          file_type: fileType,
          version_assumption: isCif2 ? "CIF-2.0" : "CIF-1.1",
        },
      ],
      edges: [],
    },
    version_assumptions: [
      {
        artifact: input,
        assumption: isCif2 ? "CIF-2.0" : "CIF-1.1",
        source: isCif2
          ? "file header marker `#\\\\#CIF_2.0`"
          : "default; no CIF 2.0 header detected",
      },
    ],
    regression_fixtures: {
      valid: [
        "server/test/fixtures/rules/duplicate_tag_valid.cif",
        "server/test/fixtures/rules/unclosed_loop_valid.cif",
        "server/test/fixtures/rules/loop_arity_mismatch_valid.cif",
        "server/test/fixtures/rules/invalid_uncertainty_valid.cif",
        "server/test/fixtures/rules/malformed_data_block_valid.cif",
        "server/test/fixtures/rules/missing_cell_parameters_valid.cif",
        "server/test/fixtures/rules/atom_site_symmetry_mismatch_valid.cif",
      ],
      invalid: [
        "server/test/fixtures/rules/duplicate_tag.cif",
        "server/test/fixtures/rules/unclosed_loop.cif",
        "server/test/fixtures/rules/loop_arity_mismatch.cif",
        "server/test/fixtures/rules/invalid_uncertainty.cif",
        "server/test/fixtures/rules/malformed_data_block.cif",
        "server/test/fixtures/rules/missing_cell_parameters.cif",
        "server/test/fixtures/rules/atom_site_symmetry_mismatch.cif",
      ],
      source: "server/test/fixtures/rules",
    },
    summary: {
      count: diagnostics.length,
      blocking,
      errors: diagnostics.filter((d) => d.severity === "error").length,
      warnings: diagnostics.filter((d) => d.severity === "warning").length,
      artifacts: 1,
    },
    capabilities: {
      operations: CAPABILITY_OPERATIONS,
      operation: "preflight",
      status: "available",
      source: "cifLspTool",
    },
  };
}

process.exitCode = main(process.argv.slice(2));
