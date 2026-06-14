import { DiagnosticSeverity } from "vscode-languageserver";
import { ParserErrorType } from "../parser/parserErrors";
import { Token } from "../parser/token";
import { DiagnosticCategory } from "../diagnosticEngineV1";

/**
 * Stable OpenQC/LSP diagnostic rule descriptors.
 *
 * Each rule maps a parser-internal {@link ParserErrorType} to the public,
 * stable rule_id surfaced through `cif-lsp-tool check --format json` and the
 * exported rule manifest. Keeping the rule_id and severity here means the
 * CLI, the explain endpoint, and the manifest all read from one source of
 * truth.
 */
export interface CifRule {
  rule_id: string;
  error_type: ParserErrorType;
  severity_label: "error" | "warning" | "information" | "hint";
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  source: string;
  message: (token: Token | undefined) => string;
  fix_hints: string[];
  manual_ref: string | null;
}

const DUPLICATE_TAG_HINTS: string[] = [
  "Rename or remove one of the duplicate _tag definitions in this data block.",
  "If the values differ, choose the intended value and delete the redundant tag.",
];

const duplicateTagMessage = (token: Token | undefined): string => {
  const name = token?.text ?? "";
  return name
    ? `Duplicate data name '${name}' in the same data block.`
    : "Duplicate data name in the same data block.";
};

const UNCLOSED_LOOP_HINTS: string[] = [
  "Add at least one data name (_tag) on the line(s) following loop_.",
  "Remove the stray loop_ keyword if no tabular data is intended.",
];

const unclosedLoopMessage = (token: Token | undefined): string => {
  const keyword = token?.text ?? "loop_";
  return `'${keyword}' is not followed by any data name.`;
};

const ARITY_MISMATCH_HINTS: string[] = [
  "Ensure every value row supplies exactly one value per declared _tag.",
  "Add or remove values so the total value count is a multiple of the tag count.",
];

const arityMismatchMessage = (token: Token | undefined): string => {
  const keyword = token?.text ?? "loop_";
  return `'${keyword}' value rows do not match the number of declared data names.`;
};

const rules: readonly CifRule[] = [
  {
    rule_id: "cif.syntax.duplicate_tag",
    error_type: ParserErrorType.DuplicateTag,
    severity_label: "error",
    severity: DiagnosticSeverity.Error,
    category: "syntax",
    source: "cif-lsp",
    message: duplicateTagMessage,
    fix_hints: DUPLICATE_TAG_HINTS,
    manual_ref: "https://www.iucr.org/resources/cif/spec/version1.1/cifsyntax",
  },
  {
    rule_id: "cif.loop.unclosed_loop",
    error_type: ParserErrorType.UnclosedLoop,
    severity_label: "error",
    severity: DiagnosticSeverity.Error,
    category: "syntax",
    source: "cif-lsp",
    message: unclosedLoopMessage,
    fix_hints: UNCLOSED_LOOP_HINTS,
    manual_ref: "https://www.iucr.org/resources/cif/spec/version1.1/cifsyntax",
  },
  {
    rule_id: "cif.loop.arity_mismatch",
    error_type: ParserErrorType.LoopValueMismatch,
    severity_label: "error",
    severity: DiagnosticSeverity.Error,
    category: "syntax",
    source: "cif-lsp",
    message: arityMismatchMessage,
    fix_hints: ARITY_MISMATCH_HINTS,
    manual_ref: "https://www.iucr.org/resources/cif/spec/version1.1/cifsyntax",
  },
];

const rulesByErrorType: ReadonlyMap<ParserErrorType, CifRule> = new Map(
  rules.map((rule) => [rule.error_type, rule]),
);

const rulesByRuleId: ReadonlyMap<string, CifRule> = new Map(
  rules.map((rule) => [rule.rule_id, rule]),
);

export function getRuleForErrorType(
  errorType: ParserErrorType,
): CifRule | undefined {
  return rulesByErrorType.get(errorType);
}

export function getRuleById(ruleId: string): CifRule | undefined {
  return rulesByRuleId.get(ruleId);
}

export interface RuleManifestEntry {
  rule_id: string;
  severity: CifRule["severity_label"];
  category: DiagnosticCategory;
  source: string;
  fix_hints: string[];
  manual_ref: string | null;
}

export function ruleManifest(): RuleManifestEntry[] {
  return rules.map((rule) => ({
    rule_id: rule.rule_id,
    severity: rule.severity_label,
    category: rule.category,
    source: rule.source,
    fix_hints: [...rule.fix_hints],
    manual_ref: rule.manual_ref,
  }));
}
