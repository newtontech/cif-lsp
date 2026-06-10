import * as assert from "assert";
import { parser } from "../parser/parser";
import { ParserErrorType } from "../parser/parserErrors";

describe("validation", function () {
  describe("duplicate data blocks", function () {
    it("should report no errors for unique data blocks", function () {
      const input = `
        data_block1
        _a a1
        data_block2
        _b b1
      `;
      const result = parser(input);
      const dupErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.DuplicateData,
      );
      assert.strictEqual(dupErrors.length, 0);
    });

    it("should report duplicate data blocks (case insensitive)", function () {
      const input = `
        data_TEST
        _a a1
        data_test
        _b b1
      `;
      const result = parser(input);
      const dupErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.DuplicateData,
      );
      assert.strictEqual(dupErrors.length, 2);
    });

    it("should report three errors for three identical data block names", function () {
      const input = `
        data_block1
        _a a1
        data_block1
        _b b1
        data_block1
        _c c1
      `;
      const result = parser(input);
      const dupErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.DuplicateData,
      );
      assert.strictEqual(dupErrors.length, 3);
    });
  });

  describe("duplicate tags within a block", function () {
    it("should report no errors for unique tags in a block", function () {
      const input = `
        data_block1
        _a a1
        _b b1
        _c c1
      `;
      const result = parser(input);
      const tagErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.DuplicateTag,
      );
      assert.strictEqual(tagErrors.length, 0);
    });

    it("should report duplicate tags in the same data block", function () {
      const input = `
        data_block1
        _a a1
        _a a2
        _a a3
      `;
      const result = parser(input);
      const tagErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.DuplicateTag,
      );
      assert.strictEqual(tagErrors.length, 3);
    });

    it("should allow same tag name in different data blocks", function () {
      const input = `
        data_block1
        _a a1
        data_block2
        _a a2
      `;
      const result = parser(input);
      const tagErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.DuplicateTag,
      );
      assert.strictEqual(tagErrors.length, 0);
    });

    it("should track duplicates within save frames", function () {
      const input = `
        data_block1
        save_frame1
        _x x1
        _x x2
        save_
      `;
      const result = parser(input);
      const tagErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.DuplicateTag,
      );
      assert.strictEqual(tagErrors.length, 2);
    });
  });

  describe("non-ASCII characters (CIF1)", function () {
    it("should accept pure ASCII input", function () {
      const input = "data_test\n_a hello";
      const result = parser(input);
      const asciiErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.NonAsciiCharacter,
      );
      assert.strictEqual(asciiErrors.length, 0);
    });

    it("should detect a non-ASCII character", function () {
      const input = "data_test\n_a é"; // é
      const result = parser(input);
      const asciiErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.NonAsciiCharacter,
      );
      assert.strictEqual(asciiErrors.length, 1);
      assert.ok(asciiErrors[0].message?.includes("U+00E9"));
    });

    it("should detect control characters", function () {
      const input = "data_test\n_a \x01"; // SOH
      const result = parser(input);
      const asciiErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.NonAsciiCharacter,
      );
      assert.strictEqual(asciiErrors.length, 1);
    });
  });

  describe("line length validation (CIF1)", function () {
    it("should accept lines under 2048 characters", function () {
      const shortLine = "data_test\n" + "_a " + "x".repeat(100);
      const result = parser(shortLine);
      const lengthErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.LineTooLong,
      );
      assert.strictEqual(lengthErrors.length, 0);
    });

    it("should reject lines over 2048 characters", function () {
      const longLine = "data_test\n" + "_a " + "x".repeat(2100);
      const result = parser(longLine);
      const lengthErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.LineTooLong,
      );
      assert.strictEqual(lengthErrors.length, 1);
      assert.ok(lengthErrors[0].message?.includes("2048"));
    });
  });

  describe("value length validation", function () {
    it("should accept tag names up to 75 characters", function () {
      const tag = "_" + "a".repeat(74); // 75 chars total
      const input = `data_test\n${tag} val`;
      const result = parser(input);
      const lengthErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.ValueTooLong,
      );
      assert.strictEqual(lengthErrors.length, 0);
    });

    it("should reject tag names over 75 characters", function () {
      const tag = "_" + "a".repeat(75); // 76 chars total
      const input = `data_test\n${tag} val`;
      const result = parser(input);
      const lengthErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.ValueTooLong,
      );
      assert.strictEqual(lengthErrors.length, 1);
      assert.strictEqual(lengthErrors[0].token?.text, tag);
    });

    it("should accept data block names up to 80 characters", function () {
      const name = "data_" + "b".repeat(75); // 80 chars total
      const input = `${name}\n_a val`;
      const result = parser(input);
      const lengthErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.ValueTooLong,
      );
      assert.strictEqual(lengthErrors.length, 0);
    });

    it("should reject data block names over 80 characters", function () {
      const name = "data_" + "b".repeat(76); // 81 chars total
      const input = `${name}\n_a val`;
      const result = parser(input);
      const lengthErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.ValueTooLong,
      );
      assert.strictEqual(lengthErrors.length, 1);
    });

    it("should reject save frame names over 80 characters", function () {
      const name = "save_" + "s".repeat(76); // 81 chars total
      const input = `data_test\n${name}\n_a val\nsave_`;
      const result = parser(input);
      const lengthErrors = result.errors.filter(
        (e) => e.type === ParserErrorType.ValueTooLong,
      );
      assert.strictEqual(lengthErrors.length, 1);
    });
  });
});
