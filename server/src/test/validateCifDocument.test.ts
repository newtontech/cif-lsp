import * as assert from "assert";
import { parser } from "../parser/parser";
import {
  getSeverity,
  ParserErrorType,
  ParserSeverity,
} from "../parser/parserErrors";
import { TokenType } from "../parser/token";

/**
 * Tests for document-level validation, focusing on diagnostic stability.
 * Tests the validateCifDocument pipeline: lexer → parser → error collection.
 */
describe("document validation pipeline", function () {
  describe("well-formed CIF documents", function () {
    it("should validate a minimal valid CIF", function () {
      const result = parser("data_test\n_key value");
      assert.strictEqual(result.errors.length, 0);
    });

    it("should validate a CIF with all value types", function () {
      const input = `data_all_types
_unquoted hello
_single 'quoted value'
_double "another quoted"
_number 42
_float 3.14
_scientific 1e-5
_with_su 1.23(4)
_dot .
_question ?
`;
      const result = parser(input);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should validate a realistic crystallographic CIF with loop", function () {
      const input = `data_Si
_chemical_name_mineral      'Silicon'
_cell_length_a              5.431
_cell_length_b              5.431
_cell_length_c              5.431
_cell_angle_alpha           90.0
_cell_angle_beta            90.0
_cell_angle_gamma           90.0
_symmetry_space_group_name_H-M  'F d -3 m'
loop_
_symmetry_equiv_pos_as_xyz
  'x, y, z'
  '-x, -y, -z'
`;
      const result = parser(input);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should validate multiple data blocks with same tag names", function () {
      const input = `data_A
_x 1
data_B
_x 2
data_C
_x 3
`;
      const result = parser(input);
      const dupTagErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.DuplicateTag,
      );
      assert.strictEqual(dupTagErrors.length, 0);
    });
  });

  describe("diagnostic severity", function () {
    it("should produce Warning severity for empty file", function () {
      const result = parser("");
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].type, ParserErrorType.EmptyFile);
      // EmptyFile is classified as a Warning
      assert.strictEqual(
        getSeverity(ParserErrorType.EmptyFile),
        ParserSeverity.Warning,
      );
    });

    it("should produce Error severity for most parse errors", function () {
      const errorTypes = [
        ParserErrorType.MissingDataBlock,
        ParserErrorType.ValueMissing,
        ParserErrorType.DuplicateData,
        ParserErrorType.DuplicateTag,
        ParserErrorType.LoopValueMismatch,
      ];
      for (const t of errorTypes) {
        assert.strictEqual(getSeverity(t), ParserSeverity.Error);
      }
    });
  });

  describe("token position tracking", function () {
    it("should track correct positions for tags and values", function () {
      const input = "data_test\n_cell_length_a 5.43";
      const result = parser(input);
      const dataToken = result.tokens.find((t) => t.type === TokenType.DATA);
      const tagToken = result.tokens.find(
        (t) => t.type === TokenType.TAG && t.text === "_cell_length_a",
      );
      const valueToken = result.tokens.find((t) => t.text === "5.43");

      assert.ok(dataToken);
      assert.strictEqual(dataToken.range.start.line, 0);
      assert.strictEqual(dataToken.range.start.character, 0);

      assert.ok(tagToken);
      assert.strictEqual(tagToken.range.start.line, 1);
      assert.strictEqual(tagToken.range.start.character, 0);
      assert.strictEqual(tagToken.range.end.character, 14); // "_cell_length_a" is 14 chars, end exclusive

      assert.ok(valueToken);
      assert.strictEqual(valueToken.range.start.line, 1);
      assert.strictEqual(valueToken.range.start.character, 15);
    });

    it("should track correct positions across multiple lines", function () {
      const input = "data_test\n_a 1\n_b 2\n_c 3";
      const result = parser(input);
      const bTag = result.tokens.find((t) => t.text === "_b");
      assert.ok(bTag);
      assert.strictEqual(bTag.range.start.line, 2);
      assert.strictEqual(bTag.range.start.character, 0);
    });
  });

  describe("error recovery", function () {
    it("should continue parsing after MissingDataBlock error", function () {
      // Token not inside a data block
      const result = parser("data_test\n_a 1\nstray\ndata_block2\n_b 2");
      const strayError = result.errors.find(
        (e) => e.type === ParserErrorType.UnexpectedValue,
      );
      assert.ok(strayError);
      // Should still parse data_block2
      const bTag = result.tokens.find((t) => t.text === "_b");
      assert.ok(bTag);
      assert.strictEqual(bTag.block?.text, "data_block2");
    });

    it("should handle cascading errors gracefully", function () {
      // Multiple issues in one file
      const input = `data_test
_a 1
_a 2
loop_ _x _y
val1
`;
      const result = parser(input);
      // Should have DuplicateTag and LoopValueMismatch
      assert.ok(result.errors.length >= 2);
      assert.ok(
        result.errors.some((e) => e.type === ParserErrorType.DuplicateTag),
      );
      assert.ok(
        result.errors.some((e) => e.type === ParserErrorType.LoopValueMismatch),
      );
    });
  });
});
