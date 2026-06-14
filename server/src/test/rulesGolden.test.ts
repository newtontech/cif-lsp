import * as assert from "assert";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Golden test for the cif.syntax.duplicate_tag rule (issue #15).
 *
 * Drives the compiled `cif-lsp-tool` CLI exactly like the agent-smoke target
 * and OpenQC consumers do, so the assertion path mirrors production. This
 * keeps the test CI-stable (no VSCode display required) and ties the golden
 * JSON, the rule manifest, and the CLI explain/rules endpoints together.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const TOOL = path.join(REPO_ROOT, "server", "out", "cifLspTool.js");
const FIXTURE_DIR = path.join(REPO_ROOT, "server", "test", "fixtures", "rules");
const INVALID_CIF = path.join(FIXTURE_DIR, "duplicate_tag.cif");
const VALID_CIF = path.join(FIXTURE_DIR, "duplicate_tag_valid.cif");
const GOLDEN_JSON = path.join(FIXTURE_DIR, "duplicate_tag.json");
const RULE_ID = "cif.syntax.duplicate_tag";

interface CheckPayload {
  diagnostics: Array<{
    code: string;
    severity: string;
    category: string;
    source: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    message: string;
    blocking: boolean;
    fix_hints: string[];
    manual_ref: string | null;
  }>;
}

interface GoldenOccurrence {
  line_start: number;
  char_start: number;
  line_end: number;
  char_end: number;
  message: string;
}

interface GoldenFile {
  rule_id: string;
  severity: string;
  category: string;
  source: string;
  blocking: boolean;
  manual_ref: string | null;
  fix_hints: string[];
  message_template: string;
  occurrences: GoldenOccurrence[];
}

interface ExplainPayload {
  operation: "explain";
  ok: boolean;
  rule: {
    rule_id: string;
    severity: string;
    category: string;
    source: string;
    fix_hints: string[];
    manual_ref: string | null;
  } | null;
}

interface RulesPayload {
  operation: "rules";
  rules: Array<{
    rule_id: string;
    severity: string;
    category: string;
    source: string;
  }>;
}

function runTool(args: string[]): unknown {
  return JSON.parse(
    execFileSync(process.execPath, [TOOL, ...args], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    }),
  );
}

describe("cif.syntax.duplicate_tag rule (issue #15)", function () {
  this.timeout(20000);

  it("emits exactly the rule's diagnostics on the invalid fixture", function () {
    const payload = runTool([
      "check",
      INVALID_CIF,
      "--format",
      "json",
    ]) as CheckPayload;
    const ruleDiagnostics = payload.diagnostics.filter(
      (diagnostic) => diagnostic.code === RULE_ID,
    );

    const golden = JSON.parse(
      fs.readFileSync(GOLDEN_JSON, "utf8"),
    ) as GoldenFile;

    assert.strictEqual(
      ruleDiagnostics.length,
      golden.occurrences.length,
      "expected the golden number of duplicate_tag diagnostics",
    );

    // Stable rule-level metadata.
    ruleDiagnostics.forEach((diagnostic) => {
      assert.strictEqual(diagnostic.severity, golden.severity);
      assert.strictEqual(diagnostic.category, golden.category);
      assert.strictEqual(diagnostic.source, golden.source);
      assert.strictEqual(diagnostic.blocking, golden.blocking);
      assert.deepStrictEqual(diagnostic.fix_hints, golden.fix_hints);
      assert.strictEqual(diagnostic.manual_ref, golden.manual_ref);
    });

    // Stable per-occurrence range + message, in source order.
    ruleDiagnostics.forEach((diagnostic, index) => {
      const expected = golden.occurrences[index];
      const { range } = diagnostic;
      assert.deepStrictEqual(range.start, {
        line: expected.line_start,
        character: expected.char_start,
      });
      assert.deepStrictEqual(range.end, {
        line: expected.line_end,
        character: expected.char_end,
      });
      assert.strictEqual(diagnostic.message, expected.message);
    });
  });

  it("does not fire on a fixture where every tag is unique", function () {
    const payload = runTool([
      "check",
      VALID_CIF,
      "--format",
      "json",
    ]) as CheckPayload;
    const ruleDiagnostics = payload.diagnostics.filter(
      (diagnostic) => diagnostic.code === RULE_ID,
    );
    assert.deepStrictEqual(ruleDiagnostics, []);
  });

  it("exposes the rule via the explain operation", function () {
    const payload = runTool([
      "explain",
      RULE_ID,
      "--format",
      "json",
    ]) as ExplainPayload;
    assert.strictEqual(payload.operation, "explain");
    assert.strictEqual(payload.ok, true);
    assert.ok(payload.rule, "explain payload must include the rule descriptor");
    assert.strictEqual(payload.rule!.rule_id, RULE_ID);
    assert.strictEqual(payload.rule!.severity, "error");
    assert.strictEqual(payload.rule!.category, "syntax");
    assert.ok(payload.rule!.fix_hints.length >= 1);
    assert.ok(payload.rule!.manual_ref);
  });

  it("lists the rule via the rules operation", function () {
    const payload = runTool(["rules", "--format", "json"]) as RulesPayload;
    assert.strictEqual(payload.operation, "rules");
    const entry = payload.rules.find((rule) => rule.rule_id === RULE_ID);
    assert.ok(entry, "rules export must include cif.syntax.duplicate_tag");
    assert.strictEqual(entry!.severity, "error");
    assert.strictEqual(entry!.category, "syntax");
  });

  it("keeps the rule manifest in sync with the TypeScript registry", function () {
    const payload = runTool(["rules", "--format", "json"]) as RulesPayload;
    const entry = payload.rules.find((rule) => rule.rule_id === RULE_ID);
    const manifestPath = path.join(REPO_ROOT, "rules", "diagnostics.yaml");
    const manifest = fs.readFileSync(manifestPath, "utf8");
    assert.ok(
      manifest.includes(`rule_id: ${RULE_ID}`),
      "manifest must declare the rule",
    );
    assert.ok(entry, "rules export and manifest must agree");
  });
});

const UNCLOSED_LOOP_RULE_ID = "cif.loop.unclosed_loop";
const UNCLOSED_LOOP_INVALID = path.join(FIXTURE_DIR, "unclosed_loop.cif");
const UNCLOSED_LOOP_VALID = path.join(FIXTURE_DIR, "unclosed_loop_valid.cif");
const UNCLOSED_LOOP_GOLDEN = path.join(FIXTURE_DIR, "unclosed_loop.json");

describe("cif.loop.unclosed_loop rule (issue #16)", function () {
  this.timeout(20000);

  it("emits exactly the rule's diagnostics on the invalid fixture", function () {
    const payload = runTool([
      "check",
      UNCLOSED_LOOP_INVALID,
      "--format",
      "json",
    ]) as CheckPayload;
    const ruleDiagnostics = payload.diagnostics.filter(
      (diagnostic) => diagnostic.code === UNCLOSED_LOOP_RULE_ID,
    );

    const golden = JSON.parse(
      fs.readFileSync(UNCLOSED_LOOP_GOLDEN, "utf8"),
    ) as GoldenFile;

    assert.strictEqual(
      ruleDiagnostics.length,
      golden.occurrences.length,
      "expected the golden number of unclosed_loop diagnostics",
    );

    // Stable rule-level metadata.
    ruleDiagnostics.forEach((diagnostic) => {
      assert.strictEqual(diagnostic.severity, golden.severity);
      assert.strictEqual(diagnostic.category, golden.category);
      assert.strictEqual(diagnostic.source, golden.source);
      assert.strictEqual(diagnostic.blocking, golden.blocking);
      assert.deepStrictEqual(diagnostic.fix_hints, golden.fix_hints);
      assert.strictEqual(diagnostic.manual_ref, golden.manual_ref);
    });

    // Stable per-occurrence range + message, in source order.
    ruleDiagnostics.forEach((diagnostic, index) => {
      const expected = golden.occurrences[index];
      const { range } = diagnostic;
      assert.deepStrictEqual(range.start, {
        line: expected.line_start,
        character: expected.char_start,
      });
      assert.deepStrictEqual(range.end, {
        line: expected.line_end,
        character: expected.char_end,
      });
      assert.strictEqual(diagnostic.message, expected.message);
    });
  });

  it("does not fire on a fixture with a well-formed loop", function () {
    const payload = runTool([
      "check",
      UNCLOSED_LOOP_VALID,
      "--format",
      "json",
    ]) as CheckPayload;
    const ruleDiagnostics = payload.diagnostics.filter(
      (diagnostic) => diagnostic.code === UNCLOSED_LOOP_RULE_ID,
    );
    assert.deepStrictEqual(ruleDiagnostics, []);
  });

  it("exposes the rule via the explain operation", function () {
    const payload = runTool([
      "explain",
      UNCLOSED_LOOP_RULE_ID,
      "--format",
      "json",
    ]) as ExplainPayload;
    assert.strictEqual(payload.operation, "explain");
    assert.strictEqual(payload.ok, true);
    assert.ok(payload.rule, "explain payload must include the rule descriptor");
    assert.strictEqual(payload.rule!.rule_id, UNCLOSED_LOOP_RULE_ID);
    assert.strictEqual(payload.rule!.severity, "error");
    assert.strictEqual(payload.rule!.category, "syntax");
    assert.ok(payload.rule!.fix_hints.length >= 1);
    assert.ok(payload.rule!.manual_ref);
  });

  it("lists the rule via the rules operation", function () {
    const payload = runTool(["rules", "--format", "json"]) as RulesPayload;
    assert.strictEqual(payload.operation, "rules");
    const entry = payload.rules.find(
      (rule) => rule.rule_id === UNCLOSED_LOOP_RULE_ID,
    );
    assert.ok(entry, "rules export must include cif.loop.unclosed_loop");
    assert.strictEqual(entry!.severity, "error");
    assert.strictEqual(entry!.category, "syntax");
  });

  it("keeps the rule manifest in sync with the TypeScript registry", function () {
    const payload = runTool(["rules", "--format", "json"]) as RulesPayload;
    const entry = payload.rules.find(
      (rule) => rule.rule_id === UNCLOSED_LOOP_RULE_ID,
    );
    const manifestPath = path.join(REPO_ROOT, "rules", "diagnostics.yaml");
    const manifest = fs.readFileSync(manifestPath, "utf8");
    assert.ok(
      manifest.includes(`rule_id: ${UNCLOSED_LOOP_RULE_ID}`),
      "manifest must declare the rule",
    );
    assert.ok(entry, "rules export and manifest must agree");
  });
});

const ARITY_MISMATCH_RULE_ID = "cif.loop.arity_mismatch";
const ARITY_MISMATCH_INVALID = path.join(
  FIXTURE_DIR,
  "loop_arity_mismatch.cif",
);
const ARITY_MISMATCH_VALID = path.join(
  FIXTURE_DIR,
  "loop_arity_mismatch_valid.cif",
);
const ARITY_MISMATCH_GOLDEN = path.join(FIXTURE_DIR, "loop_arity_mismatch.json");

describe("cif.loop.arity_mismatch rule (issue #17)", function () {
  this.timeout(20000);

  it("emits exactly the rule's diagnostics on the invalid fixture", function () {
    const payload = runTool([
      "check",
      ARITY_MISMATCH_INVALID,
      "--format",
      "json",
    ]) as CheckPayload;
    const ruleDiagnostics = payload.diagnostics.filter(
      (diagnostic) => diagnostic.code === ARITY_MISMATCH_RULE_ID,
    );

    const golden = JSON.parse(
      fs.readFileSync(ARITY_MISMATCH_GOLDEN, "utf8"),
    ) as GoldenFile;

    assert.strictEqual(
      ruleDiagnostics.length,
      golden.occurrences.length,
      "expected the golden number of arity_mismatch diagnostics",
    );

    // Stable rule-level metadata.
    ruleDiagnostics.forEach((diagnostic) => {
      assert.strictEqual(diagnostic.severity, golden.severity);
      assert.strictEqual(diagnostic.category, golden.category);
      assert.strictEqual(diagnostic.source, golden.source);
      assert.strictEqual(diagnostic.blocking, golden.blocking);
      assert.deepStrictEqual(diagnostic.fix_hints, golden.fix_hints);
      assert.strictEqual(diagnostic.manual_ref, golden.manual_ref);
    });

    // Stable per-occurrence range + message, in source order.
    ruleDiagnostics.forEach((diagnostic, index) => {
      const expected = golden.occurrences[index];
      const { range } = diagnostic;
      assert.deepStrictEqual(range.start, {
        line: expected.line_start,
        character: expected.char_start,
      });
      assert.deepStrictEqual(range.end, {
        line: expected.line_end,
        character: expected.char_end,
      });
      assert.strictEqual(diagnostic.message, expected.message);
    });
  });

  it("does not fire on a fixture with consistent loop arity", function () {
    const payload = runTool([
      "check",
      ARITY_MISMATCH_VALID,
      "--format",
      "json",
    ]) as CheckPayload;
    const ruleDiagnostics = payload.diagnostics.filter(
      (diagnostic) => diagnostic.code === ARITY_MISMATCH_RULE_ID,
    );
    assert.deepStrictEqual(ruleDiagnostics, []);
  });

  it("exposes the rule via the explain operation", function () {
    const payload = runTool([
      "explain",
      ARITY_MISMATCH_RULE_ID,
      "--format",
      "json",
    ]) as ExplainPayload;
    assert.strictEqual(payload.operation, "explain");
    assert.strictEqual(payload.ok, true);
    assert.ok(payload.rule, "explain payload must include the rule descriptor");
    assert.strictEqual(payload.rule!.rule_id, ARITY_MISMATCH_RULE_ID);
    assert.strictEqual(payload.rule!.severity, "error");
    assert.strictEqual(payload.rule!.category, "syntax");
    assert.ok(payload.rule!.fix_hints.length >= 1);
    assert.ok(payload.rule!.manual_ref);
  });

  it("lists the rule via the rules operation", function () {
    const payload = runTool(["rules", "--format", "json"]) as RulesPayload;
    assert.strictEqual(payload.operation, "rules");
    const entry = payload.rules.find(
      (rule) => rule.rule_id === ARITY_MISMATCH_RULE_ID,
    );
    assert.ok(entry, "rules export must include cif.loop.arity_mismatch");
    assert.strictEqual(entry!.severity, "error");
    assert.strictEqual(entry!.category, "syntax");
  });

  it("keeps the rule manifest in sync with the TypeScript registry", function () {
    const payload = runTool(["rules", "--format", "json"]) as RulesPayload;
    const entry = payload.rules.find(
      (rule) => rule.rule_id === ARITY_MISMATCH_RULE_ID,
    );
    const manifestPath = path.join(REPO_ROOT, "rules", "diagnostics.yaml");
    const manifest = fs.readFileSync(manifestPath, "utf8");
    assert.ok(
      manifest.includes(`rule_id: ${ARITY_MISMATCH_RULE_ID}`),
      "manifest must declare the rule",
    );
    assert.ok(entry, "rules export and manifest must agree");
  });
});

const INVALID_UNCERTAINTY_RULE_ID = "cif.value.invalid_uncertainty";
const INVALID_UNCERTAINTY_INVALID = path.join(
  FIXTURE_DIR,
  "invalid_uncertainty.cif",
);
const INVALID_UNCERTAINTY_VALID = path.join(
  FIXTURE_DIR,
  "invalid_uncertainty_valid.cif",
);
const INVALID_UNCERTAINTY_GOLDEN = path.join(
  FIXTURE_DIR,
  "invalid_uncertainty.json",
);

describe("cif.value.invalid_uncertainty rule (issue #18)", function () {
  this.timeout(20000);

  it("emits exactly the rule's diagnostics on the invalid fixture", function () {
    const payload = runTool([
      "check",
      INVALID_UNCERTAINTY_INVALID,
      "--format",
      "json",
    ]) as CheckPayload;
    const ruleDiagnostics = payload.diagnostics.filter(
      (diagnostic) => diagnostic.code === INVALID_UNCERTAINTY_RULE_ID,
    );

    const golden = JSON.parse(
      fs.readFileSync(INVALID_UNCERTAINTY_GOLDEN, "utf8"),
    ) as GoldenFile;

    assert.strictEqual(
      ruleDiagnostics.length,
      golden.occurrences.length,
      "expected the golden number of invalid_uncertainty diagnostics",
    );

    // Stable rule-level metadata.
    ruleDiagnostics.forEach((diagnostic) => {
      assert.strictEqual(diagnostic.severity, golden.severity);
      assert.strictEqual(diagnostic.category, golden.category);
      assert.strictEqual(diagnostic.source, golden.source);
      assert.strictEqual(diagnostic.blocking, golden.blocking);
      assert.deepStrictEqual(diagnostic.fix_hints, golden.fix_hints);
      assert.strictEqual(diagnostic.manual_ref, golden.manual_ref);
    });

    // Stable per-occurrence range + message, in source order.
    ruleDiagnostics.forEach((diagnostic, index) => {
      const expected = golden.occurrences[index];
      const { range } = diagnostic;
      assert.deepStrictEqual(range.start, {
        line: expected.line_start,
        character: expected.char_start,
      });
      assert.deepStrictEqual(range.end, {
        line: expected.line_end,
        character: expected.char_end,
      });
      assert.strictEqual(diagnostic.message, expected.message);
    });
  });

  it("does not fire on a fixture with well-formed uncertainties", function () {
    const payload = runTool([
      "check",
      INVALID_UNCERTAINTY_VALID,
      "--format",
      "json",
    ]) as CheckPayload;
    const ruleDiagnostics = payload.diagnostics.filter(
      (diagnostic) => diagnostic.code === INVALID_UNCERTAINTY_RULE_ID,
    );
    assert.deepStrictEqual(ruleDiagnostics, []);
  });

  it("exposes the rule via the explain operation", function () {
    const payload = runTool([
      "explain",
      INVALID_UNCERTAINTY_RULE_ID,
      "--format",
      "json",
    ]) as ExplainPayload;
    assert.strictEqual(payload.operation, "explain");
    assert.strictEqual(payload.ok, true);
    assert.ok(payload.rule, "explain payload must include the rule descriptor");
    assert.strictEqual(payload.rule!.rule_id, INVALID_UNCERTAINTY_RULE_ID);
    assert.strictEqual(payload.rule!.severity, "warning");
    assert.strictEqual(payload.rule!.category, "type/value");
    assert.ok(payload.rule!.fix_hints.length >= 1);
    assert.ok(payload.rule!.manual_ref);
  });

  it("lists the rule via the rules operation", function () {
    const payload = runTool(["rules", "--format", "json"]) as RulesPayload;
    assert.strictEqual(payload.operation, "rules");
    const entry = payload.rules.find(
      (rule) => rule.rule_id === INVALID_UNCERTAINTY_RULE_ID,
    );
    assert.ok(entry, "rules export must include cif.value.invalid_uncertainty");
    assert.strictEqual(entry!.severity, "warning");
    assert.strictEqual(entry!.category, "type/value");
  });

  it("keeps the rule manifest in sync with the TypeScript registry", function () {
    const payload = runTool(["rules", "--format", "json"]) as RulesPayload;
    const entry = payload.rules.find(
      (rule) => rule.rule_id === INVALID_UNCERTAINTY_RULE_ID,
    );
    const manifestPath = path.join(REPO_ROOT, "rules", "diagnostics.yaml");
    const manifest = fs.readFileSync(manifestPath, "utf8");
    assert.ok(
      manifest.includes(`rule_id: ${INVALID_UNCERTAINTY_RULE_ID}`),
      "manifest must declare the rule",
    );
    assert.ok(entry, "rules export and manifest must agree");
  });
});
