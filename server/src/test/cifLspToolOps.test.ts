import * as assert from "assert";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Golden tests for the agent-facing CLI operations that close out the
 * remaining LSP/OpenQC capability issues:
 * - #11 capabilities (Agent JSON)
 * - #5/#3 format (safe formatter + idempotence)
 * - #21 fix (code actions, including the safe-to-apply missing-cell edit)
 * - #22 logs (runtime log parser, reported as unavailable)
 * - #28 preflight (universal generated-input preflight)
 *
 * Each test drives the compiled `cif-lsp-tool` CLI exactly like the
 * agent-smoke target so the assertion path mirrors production.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const TOOL = path.join(REPO_ROOT, "server", "out", "cifLspTool.js");

interface OperationPayload {
  operation: string;
  ok: boolean;
  capabilities?: {
    operations: string[];
    operation: string;
    status: "available" | "unavailable";
    reason?: string;
  };
}

interface FormatPayload extends OperationPayload {
  operation: "format";
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
}

interface CapabilitiesPayload {
  operation: "capabilities";
  ok: boolean;
  capabilities: {
    schema: string;
    operations: string[];
    envelope: string;
    capability_flags: Record<string, boolean>;
    operation: "capabilities";
    status: "available" | "unavailable";
  };
}

interface LogsPayload extends OperationPayload {
  operation: "logs";
  capability: {
    id: string;
    status: "available" | "unavailable";
    reason: string;
  };
  entries: unknown[];
}

interface PreflightPayload extends OperationPayload {
  operation: "preflight";
  envelope: string;
  artifact_graph: {
    artifacts: Array<{
      role: string;
      path: string;
      file_type: string;
      version_assumption: string;
    }>;
  };
  version_assumptions: Array<{ artifact: string; assumption: string }>;
  regression_fixtures: { valid: string[]; invalid: string[] };
}

interface FixPayload extends OperationPayload {
  operation: "fix";
  actions: Array<{
    title: string;
    kind: string;
    diagnostic_code: string;
    safe_to_auto_apply: boolean;
    edit: { edits: Array<{ new_text: string }> } | null;
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

function writeTempCif(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cif-lsp-tool-ops-"));
  const file = path.join(dir, "input.cif");
  fs.writeFileSync(file, content, "utf8");
  return file;
}

describe("cif-lsp-tool capabilities operation (issue #11)", function () {
  this.timeout(20000);

  it("emits a stable OpenQCLspCapabilities envelope", function () {
    const payload = runTool(["capabilities"]) as CapabilitiesPayload;
    assert.strictEqual(payload.operation, "capabilities");
    assert.strictEqual(payload.ok, true);
    assert.strictEqual(payload.capabilities.schema, "OpenQCLspCapabilities");
    assert.strictEqual(payload.capabilities.envelope, "DiagnosticEnvelope/v1");
    assert.strictEqual(payload.capabilities.status, "available");
    for (const op of [
      "check",
      "format",
      "hover",
      "fix",
      "rules",
      "capabilities",
      "preflight",
    ]) {
      assert.ok(
        payload.capabilities.operations.includes(op),
        `capabilities.operations must include ${op}`,
      );
    }
  });

  it("declares the documented capability flags", function () {
    const payload = runTool(["capabilities"]) as CapabilitiesPayload;
    const flags = payload.capabilities.capability_flags;
    assert.strictEqual(flags.completion, true);
    assert.strictEqual(flags.diagnostics, true);
    assert.strictEqual(flags.hover, true);
    assert.strictEqual(flags.format, true);
    assert.strictEqual(flags.code_actions, true);
    assert.strictEqual(flags.rules_manifest, true);
    assert.strictEqual(flags.preflight, true);
    // CIF is static-data focused: runtime log parsing is intentionally off.
    assert.strictEqual(flags.runtime_log_parser, false);
  });
});

describe("cif-lsp-tool format operation (issues #3, #5)", function () {
  this.timeout(20000);

  it("reports changed=true and stable summary on non-canonical input", function () {
    const file = writeTempCif("data_test\r\n_a   1\n_b  2\n");
    const payload = runTool(["format", file]) as FormatPayload;
    assert.strictEqual(payload.operation, "format");
    assert.strictEqual(payload.ok, true);
    assert.strictEqual(payload.changed, true);
    assert.strictEqual(payload.idempotent, true);
    assert.ok(payload.formatted_preview.includes("data_test\n"));
    assert.ok(payload.formatted_preview.includes("_a  1\n"));
    assert.ok(payload.formatted_preview.includes("_b  2\n"));
    assert.strictEqual(payload.summary.written, false);
  });

  it("reports changed=false on already-canonical input", function () {
    const file = writeTempCif("data_test\n_a 1\n");
    const payload = runTool(["format", file]) as FormatPayload;
    assert.strictEqual(payload.changed, false);
    assert.strictEqual(payload.idempotent, true);
  });

  it("writes the formatted output back when --write is supplied", function () {
    const file = writeTempCif("data_test\r\n_a   1\n_b   2\n");
    const before = fs.readFileSync(file, "utf8");
    const payload = runTool(["format", file, "--write"]) as FormatPayload;
    const after = fs.readFileSync(file, "utf8");
    assert.notStrictEqual(before, after);
    assert.strictEqual(payload.summary.written, true);
    // Two-tag run gets aligned to the longest tag column.
    assert.strictEqual(after, "data_test\n_a  1\n_b  2\n");
    // Re-running with --write reports written=false because the file is
    // already canonical.
    const second = runTool(["format", file, "--write"]) as FormatPayload;
    assert.strictEqual(second.summary.written, false);
    assert.strictEqual(second.changed, false);
  });

  it("is idempotent on a diverse fixture", function () {
    const file = writeTempCif(
      [
        "data_idempotent",
        "_a   1",
        "",
        "",
        "",
        "_bc 2",
        "_description.text",
        ";literal line   ",
        ";",
        "_loop_tag value",
      ].join("\n") + "\n",
    );
    const first = runTool(["format", file]) as FormatPayload;
    assert.ok(first.idempotent, "first pass reports idempotent=true");
    const tmp = writeTempCif(first.formatted_preview);
    const second = runTool(["format", tmp]) as FormatPayload;
    assert.strictEqual(second.changed, false);
    assert.strictEqual(second.formatted_preview, first.formatted_preview);
  });
});

describe("cif-lsp-tool logs operation (issue #22)", function () {
  this.timeout(20000);

  it("reports runtime-log-parser as unavailable with a stable reason", function () {
    const file = writeTempCif("data_test\n_a 1\n");
    const payload = runTool(["logs", file]) as LogsPayload;
    assert.strictEqual(payload.operation, "logs");
    assert.strictEqual(payload.capability.id, "runtime-log-parser");
    assert.strictEqual(payload.capability.status, "unavailable");
    assert.ok(
      payload.capability.reason.toLowerCase().includes("static"),
      "reason explains that CIF is static-data focused",
    );
    assert.deepStrictEqual(payload.entries, []);
    assert.strictEqual(payload.capabilities?.status, "unavailable");
  });
});

describe("cif-lsp-tool preflight operation (issue #28)", function () {
  this.timeout(20000);

  it("emits a DiagnosticEnvelope/v1 with artifact, version, and fixture metadata", function () {
    const file = writeTempCif(
      "data_partial\n_cell_length_a 5.0\n",
    );
    const payload = runTool(["preflight", file]) as PreflightPayload;
    assert.strictEqual(payload.operation, "preflight");
    assert.strictEqual(payload.envelope, "DiagnosticEnvelope/v1");
    assert.strictEqual(payload.capabilities?.status, "available");
    assert.strictEqual(payload.artifact_graph.artifacts.length, 1);
    const artifact = payload.artifact_graph.artifacts[0];
    assert.strictEqual(artifact.role, "primary-input");
    assert.strictEqual(artifact.file_type, "cif");
    assert.ok(
      artifact.version_assumption === "CIF-1.1" ||
        artifact.version_assumption === "CIF-2.0",
    );
    assert.ok(payload.version_assumptions.length >= 1);
    assert.ok(payload.regression_fixtures.valid.length >= 1);
    assert.ok(payload.regression_fixtures.invalid.length >= 1);
  });

  it("exposes fleet regression fixture paths", function () {
    const file = writeTempCif("data_test\n_a 1\n");
    const payload = runTool(["preflight", file]) as PreflightPayload;
    const valid = payload.regression_fixtures.valid;
    const invalid = payload.regression_fixtures.invalid;
    assert.ok(
      valid.some((p) => p.endsWith("duplicate_tag_valid.cif")),
      "valid fixture list must reference duplicate_tag_valid.cif",
    );
    assert.ok(
      invalid.some((p) => p.endsWith("duplicate_tag.cif")),
      "invalid fixture list must reference duplicate_tag.cif",
    );
  });
});

describe("cif-lsp-tool fix operation (issue #21)", function () {
  this.timeout(20000);

  it("emits a safe-to-apply quickfix for cif.cell.missing_parameters", function () {
    const file = writeTempCif(
      "data_partial\n_cell_length_a 5.0\n",
    );
    const payload = runTool([
      "fix",
      file,
      "--format",
      "json",
      "--line",
      "0",
      "--character",
      "0",
    ]) as FixPayload;
    assert.strictEqual(payload.operation, "fix");
    const action = payload.actions.find(
      (a) => a.diagnostic_code === "cif.cell.missing_parameters",
    );
    assert.ok(action, "fix action must cover cif.cell.missing_parameters");
    assert.strictEqual(action!.safe_to_auto_apply, true);
    assert.ok(action!.edit, "safe-to-apply action must carry a deterministic edit");
    assert.ok(action!.edit!.edits.length >= 1);
    const editText = action!.edit!.edits.map((e) => e.new_text).join("\n");
    assert.ok(editText.includes("_cell_length_b"));
    assert.ok(editText.includes("_cell_angle_gamma"));
  });

  it("emits review-only quickfixes for non-deterministic rules", function () {
    const file = writeTempCif("data_test\n_a 1\n_a 2\n");
    const payload = runTool([
      "fix",
      file,
      "--format",
      "json",
    ]) as FixPayload;
    assert.ok(payload.actions.length >= 1);
    for (const action of payload.actions) {
      // Duplicate-tag repair requires user intent, so the action must be
      // marked review-only.
      if (action.diagnostic_code === "cif.syntax.duplicate_tag") {
        assert.strictEqual(action.safe_to_auto_apply, false);
        assert.strictEqual(action.edit, null);
      }
    }
  });
});
