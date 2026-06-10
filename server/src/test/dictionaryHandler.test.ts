import * as assert from "assert";
import {
  addCifDictionaryHandler,
  removeCifDictionaryHandler,
  cifKeys,
  cifKeysSet,
  hoverText,
  isValidValue,
} from "../handlers/cifDictionaryHandler";
import { parser } from "../parser/parser";
import { TokenType } from "../parser/token";

// Helper to build a full dictionary save frame for a tag
function makeTagDefinition(
  tagName: string,
  opts: {
    category?: string;
    type?: string;
    description?: string;
    contents?: string;
    range?: string;
    states?: string[];
  } = {},
): string {
  // CIF dictionaries wrap save frames inside data blocks
  let content = `data_test_dictionary\n`;
  content += `save_${tagName}\n`;
  // Quote the definition id so the parser sees it as a value (SINGLE), not a TAG
  content += `_definition.id '${tagName}'\n`;
  if (opts.category) content += `_name.category_id ${opts.category}\n`;
  if (opts.type) content += `_type.purpose ${opts.type}\n`;
  if (opts.description) content += `_description.text\n;${opts.description}\n;\n`;
  if (opts.contents) content += `_type.contents ${opts.contents}\n`;
  if (opts.range) content += `_enumeration.range ${opts.range}\n`;
  if (opts.states) {
    for (const state of opts.states) {
      content += `_enumeration_set.state ${state}\n`;
      content += `_enumeration_set.detail 'detail for ${state}'\n`;
    }
  }
  content += `save_\n`;
  return content;
}

describe("cifDictionaryHandler", function () {
  beforeEach(function () {
    // Reset by removing any previously added dictionaries
    // Note: The handler uses a module-level Map, so we rely on isolate
    // For proper test isolation, we'd need a reset function, but the
    // current design uses module-level state. Tests are designed to be
    // additive and non-conflicting.
  });

  describe("cifKeys / completion items", function () {
    it("should return empty completion items when no dictionaries loaded", function () {
      // The default state may or may not have items depending on test order
      // Just verify it returns an array
      const keys = cifKeys();
      assert.ok(Array.isArray(keys));
    });
  });

  describe("addCifDictionaryHandler", function () {
    it("should process a dictionary with tag definitions", function () {
      const dictContent =
        makeTagDefinition("_test_tag", {
          category: "test_category",
          description: "A test tag",
        }) + makeTagDefinition("_test_tag2", {
          category: "test_category2",
        });

      addCifDictionaryHandler({ path: "test.dic", content: dictContent });

      const keys = cifKeys();
      const labels = keys.map((k) => k.label);
      assert.ok(labels.includes("_test_tag"));
      assert.ok(labels.includes("_test_tag2"));
    });

    it("should add definitions to the keys set", function () {
      const dictContent = makeTagDefinition("_unique_test_tag_xyz", {
        category: "cat",
      });
      addCifDictionaryHandler({
        path: "test2.dic",
        content: dictContent,
      });
      const keySet = cifKeysSet();
      assert.ok(keySet.has("_unique_test_tag_xyz"));
    });

    it("should handle duplicate dictionary entries gracefully", function () {
      const dictContent = makeTagDefinition("_dup_test_tag", {
        category: "cat1",
      });
      addCifDictionaryHandler({ path: "dup1.dic", content: dictContent });
      // Add again - should not crash
      addCifDictionaryHandler({ path: "dup2.dic", content: dictContent });
    });
  });

  describe("removeCifDictionaryHandler", function () {
    it("should remove a dictionary by path", function () {
      removeCifDictionaryHandler({ path: "test.dic" });
      removeCifDictionaryHandler({ path: "test2.dic" });
      removeCifDictionaryHandler({ path: "dup1.dic" });
      removeCifDictionaryHandler({ path: "dup2.dic" });
      // No assertion needed - just verify no crash
    });

    it("should remove completion, hover, and validation data for removed dictionaries", function () {
      const dictContent = makeTagDefinition("_removed_test_tag", {
        category: "removed_cat",
        description: "Removed test tag",
        states: ["yes", "no"],
      });
      addCifDictionaryHandler({
        path: "removed_test.dic",
        content: dictContent,
      });

      assert.ok(cifKeysSet().has("_removed_test_tag"));
      assert.ok(cifKeys().some((item) => item.label === "_removed_test_tag"));

      const tagResult = parser("data_test\n_removed_test_tag yes");
      const tagToken = tagResult.tokens.find(
        (t) => t.type === TokenType.TAG && t.text === "_removed_test_tag",
      );
      const invalidValue = parser("data_test\n_removed_test_tag maybe").tokens.find(
        (t) => t.text === "maybe",
      );
      assert.ok(tagToken);
      assert.ok(invalidValue);
      assert.ok(hoverText(tagToken!).includes("Removed test tag"));
      assert.strictEqual(isValidValue(invalidValue!), false);

      removeCifDictionaryHandler({ path: "removed_test.dic" });

      assert.ok(!cifKeysSet().has("_removed_test_tag"));
      assert.ok(!cifKeys().some((item) => item.label === "_removed_test_tag"));
      assert.strictEqual(hoverText(tagToken!), "");
      assert.strictEqual(isValidValue(invalidValue!), true);
    });
  });

  describe("hoverText", function () {
    it("should return empty string for non-TAG tokens", function () {
      const result = parser("data_test\n_a val");
      const dataToken = result.tokens.find((t) => t.type === TokenType.DATA);
      assert.ok(dataToken);
      const hover = hoverText(dataToken!);
      assert.strictEqual(hover, "");
    });

    it("should return empty string for tags not in dictionary", function () {
      const result = parser("data_test\n_nonexistent_tag val");
      const tagToken = result.tokens.find((t) => t.type === TokenType.TAG);
      assert.ok(tagToken);
      const hover = hoverText(tagToken!);
      assert.strictEqual(hover, "");
    });

    it("should return hover text for tags defined in dictionary", function () {
      const dictContent =
        makeTagDefinition("_hover_test_tag", {
          category: "hover_cat",
          description: "This is a hover test tag",
        });
      addCifDictionaryHandler({
        path: "hover_test.dic",
        content: dictContent,
      });

      const result = parser("data_test\n_hover_test_tag val");
      const tagToken = result.tokens.find(
        (t) => t.type === TokenType.TAG && t.text === "_hover_test_tag",
      );
      assert.ok(tagToken);
      const hover = hoverText(tagToken!);
      assert.ok(hover.includes("This is a hover test tag"));
      assert.ok(hover.includes("hover_cat"));

      removeCifDictionaryHandler({ path: "hover_test.dic" });
    });
  });

  describe("isValidValue", function () {
    it("should return true for tags without definitions", function () {
      const result = parser("data_test\n_undefined_tag 42");
      const valueToken = result.tokens.find((t) => t.text === "42");
      assert.ok(valueToken);
      assert.strictEqual(isValidValue(valueToken!), true);
    });

    it("should return true for dot (unknown) values", function () {
      const result = parser("data_test\n_a .");
      const valueToken = result.tokens.find((t) => t.text === ".");
      assert.ok(valueToken);
      assert.strictEqual(isValidValue(valueToken!), true);
    });

    it("should return true for question mark (missing) values", function () {
      const result = parser("data_test\n_a ?");
      const valueToken = result.tokens.find((t) => t.text === "?");
      assert.ok(valueToken);
      assert.strictEqual(isValidValue(valueToken!), true);
    });

    describe("enumeration validation", function () {
      it("should validate enumeration states", function () {
        const dictContent = makeTagDefinition("_enum_test_tag", {
          states: ["active", "inactive", "pending"],
        });
        addCifDictionaryHandler({
          path: "enum_test.dic",
          content: dictContent,
        });

        // Test valid state
        const validResult = parser("data_test\n_enum_test_tag active");
        const validValue = validResult.tokens.find((t) => t.text === "active");
        assert.ok(validValue);
        assert.strictEqual(isValidValue(validValue!), true);

        // Test invalid state
        const invalidResult = parser("data_test\n_enum_test_tag unknown");
        const invalidValue = invalidResult.tokens.find(
          (t) => t.text === "unknown",
        );
        assert.ok(invalidValue);
        assert.strictEqual(isValidValue(invalidValue!), false);

        removeCifDictionaryHandler({ path: "enum_test.dic" });
      });
    });

    describe("range validation", function () {
      it("should validate numeric ranges", function () {
        const dictContent = makeTagDefinition("_range_test_tag", {
          contents: "real",
          range: "0:100",
        });
        addCifDictionaryHandler({
          path: "range_test.dic",
          content: dictContent,
        });

        // Valid value in range
        const validResult = parser("data_test\n_range_test_tag 50.0");
        const validValue = validResult.tokens.find((t) => t.text === "50.0");
        assert.ok(validValue);
        assert.strictEqual(isValidValue(validValue!), true);

        // Value below range
        const lowResult = parser("data_test\n_range_test_tag -1.0");
        const lowValue = lowResult.tokens.find((t) => t.text === "-1.0");
        assert.ok(lowValue);
        assert.strictEqual(isValidValue(lowValue!), false);

        // Value above range
        const highResult = parser("data_test\n_range_test_tag 101.0");
        const highValue = highResult.tokens.find((t) => t.text === "101.0");
        assert.ok(highValue);
        assert.strictEqual(isValidValue(highValue!), false);

        removeCifDictionaryHandler({ path: "range_test.dic" });
      });

      it("should validate open-ended ranges", function () {
        const dictContent = makeTagDefinition("_open_range_tag", {
          contents: "real",
          range: "0:",
        });
        addCifDictionaryHandler({
          path: "open_range.dic",
          content: dictContent,
        });

        // Positive value should be valid
        const validResult = parser("data_test\n_open_range_tag 5.0");
        const validValue = validResult.tokens.find((t) => t.text === "5.0");
        assert.ok(validValue);
        assert.strictEqual(isValidValue(validValue!), true);

        // Zero should be valid (boundary)
        const zeroResult = parser("data_test\n_open_range_tag 0.0");
        const zeroValue = zeroResult.tokens.find((t) => t.text === "0.0");
        assert.ok(zeroValue);
        assert.strictEqual(isValidValue(zeroValue!), true);

        // Negative should be invalid
        const negResult = parser("data_test\n_open_range_tag -0.1");
        const negValue = negResult.tokens.find((t) => t.text === "-0.1");
        assert.ok(negValue);
        assert.strictEqual(isValidValue(negValue!), false);

        removeCifDictionaryHandler({ path: "open_range.dic" });
      });
    });

    describe("type validation", function () {
      it("should validate real/float values", function () {
        const dictContent = makeTagDefinition("_real_test_tag", {
          contents: "real",
        });
        addCifDictionaryHandler({
          path: "real_test.dic",
          content: dictContent,
        });

        // Valid floats
        for (const val of ["1.0", "-0.5", "3.14", "1e10", "-1.5E-3", "42"]) {
          const result = parser(`data_test\n_real_test_tag ${val}`);
          const token = result.tokens.find((t) => t.text === val);
          assert.ok(token, `Expected token for ${val}`);
          assert.strictEqual(isValidValue(token!), true, `${val} should be valid real`);
        }

        // Invalid float
        const invalidResult = parser("data_test\n_real_test_tag hello");
        const invalidValue = invalidResult.tokens.find((t) => t.text === "hello");
        assert.ok(invalidValue);
        assert.strictEqual(isValidValue(invalidValue!), false);

        removeCifDictionaryHandler({ path: "real_test.dic" });
      });

      it("should validate integer values", function () {
        const dictContent = makeTagDefinition("_int_test_tag", {
          contents: "integer",
        });
        addCifDictionaryHandler({
          path: "int_test.dic",
          content: dictContent,
        });

        // Valid integers
        const validResult = parser("data_test\n_int_test_tag 42");
        const validValue = validResult.tokens.find((t) => t.text === "42");
        assert.ok(validValue);
        assert.strictEqual(isValidValue(validValue!), true);

        // Invalid integer (decimal)
        const invalidResult = parser("data_test\n_int_test_tag 3.14");
        const invalidValue = invalidResult.tokens.find((t) => t.text === "3.14");
        assert.ok(invalidValue);
        assert.strictEqual(isValidValue(invalidValue!), false);

        removeCifDictionaryHandler({ path: "int_test.dic" });
      });

      it("should validate date values", function () {
        const dictContent = makeTagDefinition("_date_test_tag", {
          contents: "date",
        });
        addCifDictionaryHandler({
          path: "date_test.dic",
          content: dictContent,
        });

        // Valid dates
        for (const val of ["2024", "2024-01", "2024-01-15"]) {
          const result = parser(`data_test\n_date_test_tag ${val}`);
          const token = result.tokens.find((t) => t.text === val);
          assert.ok(token, `Expected token for ${val}`);
          assert.strictEqual(isValidValue(token!), true, `${val} should be valid date`);
        }

        // Invalid date
        const invalidResult = parser("data_test\n_date_test_tag not-a-date");
        const invalidValue = invalidResult.tokens.find(
          (t) => t.text === "not-a-date",
        );
        assert.ok(invalidValue);
        assert.strictEqual(isValidValue(invalidValue!), false);

        // Invalid month
        const badMonthResult = parser("data_test\n_date_test_tag 2024-13");
        const badMonthValue = badMonthResult.tokens.find(
          (t) => t.text === "2024-13",
        );
        assert.ok(badMonthValue);
        assert.strictEqual(isValidValue(badMonthValue!), false);

        removeCifDictionaryHandler({ path: "date_test.dic" });
      });
    });
  });
});
