import * as assert from "assert";
import {
  formatCif,
  isFormatterIdempotent,
} from "../format/cifFormatter";

describe("cifFormatter", function () {
  describe("line ending normalization", function () {
    it("converts CRLF to LF", function () {
      const input = "data_test\r\n_key value\r\n";
      const result = formatCif(input);
      assert.strictEqual(result.formatted, "data_test\n_key value\n");
      assert.strictEqual(result.summary.line_endings_normalized, true);
      assert.strictEqual(result.changed, true);
    });

    it("leaves LF endings unchanged", function () {
      const input = "data_test\n_key value\n";
      const result = formatCif(input);
      assert.strictEqual(result.formatted, input);
      assert.strictEqual(result.summary.line_endings_normalized, false);
      assert.strictEqual(result.changed, false);
    });
  });

  describe("trailing whitespace", function () {
    it("trims trailing spaces and tabs from each line", function () {
      const input = "data_test\n_key value   \n_other\t\n";
      const result = formatCif(input);
      assert.strictEqual(result.formatted, "data_test\n_key value\n_other\n");
      assert.strictEqual(result.summary.trailing_whitespace_trimmed, 2);
    });

    it("preserves whitespace inside multiline `;...;` values", function () {
      const input = "data_test\n_description.text\n;line one   \nsecond line\n;\n";
      const result = formatCif(input);
      assert.strictEqual(result.formatted, input);
      assert.strictEqual(result.summary.trailing_whitespace_trimmed, 0);
    });
  });

  describe("blank line collapsing", function () {
    it("collapses runs of blank lines longer than maxBlankLines", function () {
      const input = "data_test\n_a 1\n\n\n\n_b 2\n";
      const result = formatCif(input, { maxBlankLines: 1 });
      assert.strictEqual(result.formatted, "data_test\n_a 1\n\n_b 2\n");
      assert.strictEqual(result.summary.blank_runs_collapsed, 1);
    });

    it("strips leading and trailing blank lines", function () {
      const input = "\n\n\ndata_test\n_a 1\n\n\n";
      const result = formatCif(input);
      assert.strictEqual(result.formatted, "data_test\n_a 1\n");
    });
  });

  describe("tag-value alignment", function () {
    it("aligns consecutive single-line tag/value pairs to a common column", function () {
      const input = "data_test\n_a 1\n_bc 2\n_def 3\n";
      const result = formatCif(input);
      // Longest tag is `_def` (4 chars), so values align at column 6.
      assert.strictEqual(
        result.formatted,
        "data_test\n_a    1\n_bc   2\n_def  3\n",
      );
      assert.strictEqual(result.summary.tag_runs_aligned, 1);
    });

    it("does not realign single-tag runs", function () {
      const input = "data_test\n_a 1\n\n_b 2\n";
      const result = formatCif(input);
      assert.strictEqual(result.formatted, input);
      assert.strictEqual(result.summary.tag_runs_aligned, 0);
    });

    it("does not realign loop bodies", function () {
      const input = "data_test\nloop_\n_tag_a\n_tag_b\n1 2\n3 4\n";
      const result = formatCif(input);
      assert.strictEqual(result.formatted, input);
      assert.strictEqual(result.summary.tag_runs_aligned, 0);
    });

    it("preserves quoted values with internal spaces", function () {
      const input = 'data_test\n_name "my compound name"\n';
      const result = formatCif(input);
      assert.strictEqual(result.formatted, input);
    });
  });

  describe("trailing newline", function () {
    it("adds exactly one trailing newline when missing", function () {
      const input = "data_test\n_a 1";
      const result = formatCif(input);
      assert.strictEqual(result.formatted, "data_test\n_a 1\n");
      assert.strictEqual(result.summary.trailing_newline_added, true);
    });

    it("collapses multiple trailing newlines to one", function () {
      const input = "data_test\n_a 1\n\n\n";
      const result = formatCif(input);
      assert.strictEqual(result.formatted, "data_test\n_a 1\n");
    });

    it("does not report trailing_newline_added when input already ends with newline", function () {
      const input = "data_test\n_a 1\n";
      const result = formatCif(input);
      assert.strictEqual(result.summary.trailing_newline_added, false);
    });
  });

  describe("empty input", function () {
    it("returns empty string for empty input", function () {
      const result = formatCif("");
      assert.strictEqual(result.formatted, "");
      assert.strictEqual(result.changed, false);
    });
  });

  describe("idempotence", function () {
    const idempotentSamples: Array<[string, string]> = [
      ["minimal block", "data_test\n_a 1\n"],
      ["aligned tags", "data_test\n_a   1\n_bc  2\n_def 3\n"],
      ["quoted value", 'data_test\n_name "compound"\n'],
      ["multiline value", "data_test\n_desc\n;line\n;\n"],
      ["loop body", "data_test\nloop_\n_a\n_b\n1 2\n"],
      ["mixed whitespace", "data_test\r\n_a   1\r\n\n\n_b 2   \r\n"],
      ["with comments", "# header\ndata_test\n_a 1\n"],
    ];
    for (const [label, sample] of idempotentSamples) {
      it(`is a fixed point for ${label}`, function () {
        const first = formatCif(sample);
        const second = formatCif(first.formatted);
        assert.strictEqual(second.changed, false, "second pass reports change");
        assert.strictEqual(second.formatted, first.formatted);
        assert.ok(
          isFormatterIdempotent(sample),
          "isFormatterIdempotent returns true",
        );
      });
    }
  });
});
