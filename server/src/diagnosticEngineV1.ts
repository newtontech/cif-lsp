import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";

export type DiagnosticCategory =
  | "syntax"
  | "schema"
  | "type/value"
  | "cross-file reference"
  | "semantic consistency"
  | "preflight/runtime-risk"
  | "style/deprecation";

export interface RichDiagnostic {
  diagnostic_engine: "1.0";
  code: string;
  severity: "error" | "warning" | "information" | "hint";
  category: DiagnosticCategory;
  confidence: number;
  source: string;
  range: Range;
  software: "cif";
  file_type: string;
  path: string;
  expected: unknown;
  actual: unknown;
  manual_ref: string | null;
  fix_hints: unknown[];
  blocking: boolean;
  message: string;
}

export interface CheckPayload {
  uri: string;
  operation: string;
  ok: boolean;
  version: "1.0";
  software: "cif";
  diagnostic_engine: "1.0";
  diagnostics: RichDiagnostic[];
  summary: {
    count: number;
    blocking: number;
    errors: number;
    warnings: number;
    note?: string;
  };
  capabilities: {
    operations: string[];
    operation: string;
    status: "available" | "unavailable";
    source: string;
    reason?: string;
  };
}

export function diagnosticToRich(
  diagnostic: Diagnostic,
  path: string,
  fileType: string,
): RichDiagnostic {
  const severity = severityLabel(diagnostic.severity);
  return {
    diagnostic_engine: "1.0",
    code: String(diagnostic.code ?? "CIF-DIAGNOSTIC"),
    severity,
    category: inferCategory(diagnostic.code, diagnostic.message, diagnostic.source),
    confidence: 1.0,
    source: diagnostic.source ?? "cif-lsp",
    range: diagnostic.range,
    software: "cif",
    file_type: fileType,
    path,
    expected: null,
    actual: null,
    manual_ref: null,
    fix_hints: [],
    blocking: severity === "error",
    message: diagnostic.message,
  };
}

export function checkPayload(
  uri: string,
  operation: string,
  diagnostics: RichDiagnostic[],
): CheckPayload {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.blocking).length;
  return {
    uri,
    operation,
    ok: blocking === 0,
    version: "1.0",
    software: "cif",
    diagnostic_engine: "1.0",
    diagnostics,
    summary: {
      count: diagnostics.length,
      blocking,
      errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
      warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
    },
    capabilities: {
      operations: [
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
      ],
      operation,
      status: "available",
      source: "cifLspTool",
    },
  };
}

function severityLabel(
  severity: DiagnosticSeverity | undefined,
): "error" | "warning" | "information" | "hint" {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return "error";
    case DiagnosticSeverity.Warning:
      return "warning";
    case DiagnosticSeverity.Hint:
      return "hint";
    case DiagnosticSeverity.Information:
    default:
      return "information";
  }
}

function inferCategory(
  code: string | number | undefined,
  message: string,
  source: string | undefined,
): DiagnosticCategory {
  const text = `${code ?? ""} ${message} ${source ?? ""}`.toLowerCase();
  if (text.includes("parse") || text.includes("lexer") || text.includes("missing")) {
    return "syntax";
  }
  if (text.includes("non-standard") || text.includes("data name") || text.includes("tag")) {
    return "schema";
  }
  if (text.includes("value") || text.includes("type")) {
    return "type/value";
  }
  if (text.includes("deprecated") || text.includes("style")) {
    return "style/deprecation";
  }
  return "semantic consistency";
}
