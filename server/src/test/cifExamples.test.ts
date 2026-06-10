import * as assert from "assert";
import { lexer } from "../parser/lexer";
import { parser } from "../parser/parser";
import { formatParserError, ParserErrorType } from "../parser/parserErrors";
import { TokenType, isValue } from "../parser/token";

/**
 * Tests that exercise real-world CIF files and common patterns.
 * These validate parse/diagnostic stability for crystallographic data.
 */
describe("CIF real-world examples", function () {
  describe("crystal structure (NaCl)", function () {
    const input = `data_NaCl
_chemical_name_systematic     'sodium chloride'
_chemical_formula_sum         'Na Cl'
_chemical_formula_weight      58.44
_cell_length_a                5.6402
_cell_length_b                5.6402
_cell_length_c                5.6402
_cell_angle_alpha             90.0
_cell_angle_beta              90.0
_cell_angle_gamma             90.0
_symmetry_space_group_name_H-M 'F m -3 m'
_symmetry_Int_Tables_number   225
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
Na1 Na 0.0 0.0 0.0 1.0
Cl1 Cl 0.5 0.0 0.0 1.0
`;

    it("should parse without errors", function () {
      const result = parser(input);
      assert.deepStrictEqual(result.errors, []);
    });

    it("should correctly tag loop values", function () {
      const result = parser(input);
      const values = result.tokens.filter((t) => isValue(t) && t.loop);
      // 2 rows × 6 columns = 12 values in the loop
      assert.strictEqual(values.length, 12);

      // First row: Na1 Na 0.0 0.0 0.0 1.0
      const na1 = values.find((t) => t.text === "Na1");
      assert.ok(na1);
      assert.strictEqual(na1.tag?.text, "_atom_site_label");

      const naOcc = values.find(
        (t) => t.text === "1.0" && t.tag?.text === "_atom_site_occupancy",
      );
      assert.ok(naOcc);

      // Second row: Cl1 Cl 0.5 0.0 0.0 1.0
      const cl1 = values.find((t) => t.text === "Cl1");
      assert.ok(cl1);
      assert.strictEqual(cl1.tag?.text, "_atom_site_label");
    });

    it("should assign all tokens to the data block", function () {
      const result = parser(input);
      // DATA tokens are the block themselves; exclude them
      const dataTokens = result.tokens.filter(
        (t) =>
          t.type !== TokenType.WHITESPACE &&
          t.type !== TokenType.NEWLINE &&
          t.type !== TokenType.DATA,
      );
      dataTokens.forEach((t) => {
        assert.strictEqual(t.block?.text, "data_NaCl");
      });
    });
  });

  describe("multi-block CIF", function () {
    const input = `data_block_A
_a 1
_b 2

data_block_B
_c 3
loop_
_x
_y
10 20
30 40
`;

    it("should parse without errors", function () {
      const result = parser(input);
      assert.deepStrictEqual(result.errors, []);
    });

    it("should separate tokens by block", function () {
      const result = parser(input);
      const aTag = result.tokens.find((t) => t.text === "_a");
      const cTag = result.tokens.find((t) => t.text === "_c");
      assert.strictEqual(aTag?.block?.text, "data_block_A");
      assert.strictEqual(cTag?.block?.text, "data_block_B");
    });

    it("should correctly parse loop values in the second block", function () {
      const result = parser(input);
      const val10 = result.tokens.find((t) => t.text === "10");
      const val20 = result.tokens.find((t) => t.text === "20");
      assert.strictEqual(val10?.tag?.text, "_x");
      assert.strictEqual(val20?.tag?.text, "_y");
      assert.strictEqual(val10?.block?.text, "data_block_B");
    });
  });

  describe("save frames", function () {
    const input = `data_my_data
_a 1
save_my_frame
_x 10
_y 20
save_
_b 2
`;

    it("should parse without errors", function () {
      const result = parser(input);
      assert.deepStrictEqual(result.errors, []);
    });

    it("should assign save frame context", function () {
      const result = parser(input);
      const xTag = result.tokens.find((t) => t.text === "_x");
      const yTag = result.tokens.find((t) => t.text === "_y");
      assert.strictEqual(xTag?.save?.text, "save_my_frame");
      assert.strictEqual(yTag?.save?.text, "save_my_frame");
    });

    it("should not assign save context to tags outside the frame", function () {
      const result = parser(input);
      const aTag = result.tokens.find((t) => t.text === "_a");
      const bTag = result.tokens.find((t) => t.text === "_b");
      // Outside save frames, save is null or undefined
      assert.ok(!aTag?.save, "_a should not have save context");
      assert.ok(!bTag?.save, "_b should not have save context");
    });
  });

  describe("multiline string values", function () {
    const input = `data_multiline
_description
;This is a multiline
text value that spans
multiple lines.
;
_simple_tag hello
`;

    it("should parse without errors", function () {
      const result = parser(input);
      assert.deepStrictEqual(result.errors, []);
    });

    it("should capture multiline text correctly", function () {
      const result = parser(input);
      const ml = result.tokens.find((t) => t.type === TokenType.MULTILINE);
      assert.ok(ml);
      assert.ok(ml.text.includes("This is a multiline"));
      assert.ok(ml.text.includes("multiple lines."));
      assert.strictEqual(ml.tag?.text, "_description");
    });

    it("should have correct range for multiline values", function () {
      const result = parser(input);
      const ml = result.tokens.find((t) => t.type === TokenType.MULTILINE);
      assert.ok(ml);
      // Multiline token includes the leading \n; and trailing \n;
      // Starts at end of line 1 (after _description), ends at line 5 (closing ;)
      assert.strictEqual(ml.range.start.line, 1);
      assert.strictEqual(ml.range.end.line, 5);
    });
  });

  describe("quoted values", function () {
    const input = `data_quoted
_name 'John O''Reilly'
_title 'The Crystal Structure'
_simple plain_value
`;

    it("should parse without errors", function () {
      const result = parser(input);
      assert.deepStrictEqual(result.errors, []);
    });

    it("should handle single-quoted strings with embedded quotes", function () {
      const result = parser(input);
      const nameValue = result.tokens.find(
        (t) => t.type === TokenType.SINGLE && t.tag?.text === "_name",
      );
      assert.ok(nameValue);
      assert.strictEqual(nameValue.text, "'John O''Reilly'");
    });

    it("should handle plain single-quoted strings", function () {
      const result = parser(input);
      const titleValue = result.tokens.find(
        (t) => t.type === TokenType.SINGLE && t.tag?.text === "_title",
      );
      assert.ok(titleValue);
      assert.strictEqual(titleValue.text, "'The Crystal Structure'");
    });

    it("should handle unquoted values", function () {
      const result = parser(input);
      const simple = result.tokens.find(
        (t) => t.type === TokenType.UNQUOTED && t.tag?.text === "_simple",
      );
      assert.ok(simple);
      assert.strictEqual(simple.text, "plain_value");
    });
  });

  describe("numeric values", function () {
    const input = `data_nums
_int_positive 42
_int_negative -3
_int_su 100(5)
_float_pi 3.14159
_float_sci 1.5e-10
_float_neg -0.001
_dot .
_question ?
`;

    it("should parse without errors", function () {
      const result = parser(input);
      assert.deepStrictEqual(result.errors, []);
    });

    it("should recognize all numeric formats", function () {
      const result = parser(input);
      const nums = result.tokens.filter((t) => t.type === TokenType.NUMBER);
      assert.strictEqual(nums.length, 6);

      const texts = nums.map((t) => t.text);
      assert.ok(texts.includes("42"));
      assert.ok(texts.includes("-3"));
      assert.ok(texts.includes("100(5)"));
      assert.ok(texts.includes("3.14159"));
      assert.ok(texts.includes("1.5e-10"));
      assert.ok(texts.includes("-0.001"));
    });

    it("should recognize dot and question mark special values", function () {
      const result = parser(input);
      const dot = result.tokens.find((t) => t.type === TokenType.DOT);
      const question = result.tokens.find((t) => t.type === TokenType.QUESTION);
      assert.ok(dot);
      assert.ok(question);
    });
  });

  describe("comments", function () {
    const input = `data_comments
# This is a comment before any data
_a 1
# Another comment
_b 2
`;

    it("should parse without errors", function () {
      const result = parser(input);
      assert.deepStrictEqual(result.errors, []);
    });

    it("should preserve comment tokens in lexer output", function () {
      // Parser filters out comments; use lexer directly
      const lexerResult = lexer(input);
      const comments = lexerResult.tokens.filter(
        (t) => t.type === TokenType.COMMENT,
      );
      assert.strictEqual(comments.length, 2);
      assert.ok(comments[0].text.includes("comment before any data"));
      assert.ok(comments[1].text.includes("Another comment"));
    });
  });

  describe("CRLF normalization", function () {
    const input = "data_crlf\r\n_a 1\r\n_b 2\r\n";

    it("should parse CRLF-delimited files without errors", function () {
      const result = parser(input);
      assert.deepStrictEqual(result.errors, []);
    });
  });

  describe("loop with many columns", function () {
    const input = `data_test
loop_
_a _b _c _d _e
1 2 3 4 5
6 7 8 9 10
`;

    it("should parse without errors", function () {
      const result = parser(input);
      assert.deepStrictEqual(result.errors, []);
    });

    it("should correctly assign tags in the right order", function () {
      const result = parser(input);
      const val1 = result.tokens.find((t) => t.text === "1");
      const val10 = result.tokens.find((t) => t.text === "10");
      assert.strictEqual(val1?.tag?.text, "_a");
      assert.strictEqual(val10?.tag?.text, "_e");
    });
  });
});

describe("CIF common invalid cases", function () {
  it("should reject a file with no data block", function () {
    const result = parser("_a 1\n_b 2");
    const errors = result.errors;
    assert.ok(errors.length > 0);
    assert.ok(
      errors.some(
        (e) =>
          formatParserError(e).includes("missing data block") ||
          formatParserError(e).includes("value missing"),
      ),
    );
  });

  it("should reject tag-only data block", function () {
    const result = parser("data_empty\n_just_a_tag");
    const errors = result.errors;
    assert.ok(errors.length > 0);
    assert.ok(
      errors.some((e) => formatParserError(e).includes("value missing")),
    );
  });

  it("should detect missing loop values", function () {
    const result = parser("data_test\nloop_ _a _b _c\n1 2");
    const errors = result.errors;
    assert.ok(errors.length > 0);
    assert.ok(
      errors.some((e) => formatParserError(e).includes("loop value mismatch")),
    );
  });

  it("should detect extra loop values", function () {
    const result = parser("data_test\nloop_ _a _b\n1 2 3");
    const errors = result.errors;
    assert.ok(errors.length > 0);
    assert.ok(
      errors.some((e) => formatParserError(e).includes("loop value mismatch")),
    );
  });

  it("should detect duplicate data blocks", function () {
    const result = parser("data_dup\n_a 1\ndata_dup\n_b 2");
    const errors = result.errors.filter(
      (e) => formatParserError(e).includes("duplicate data"),
    );
    assert.strictEqual(errors.length, 2);
  });

  it("should detect duplicate tags in same block", function () {
    const result = parser("data_test\n_a 1\n_a 2");
    const errors = result.errors.filter(
      (e) => formatParserError(e).includes("duplicate tag"),
    );
    assert.strictEqual(errors.length, 2);
  });

  it("should detect unclosed save frame", function () {
    const result = parser("data_test\nsave_open\n_x 1");
    const errors = result.errors;
    assert.ok(errors.length > 0);
    assert.ok(
      errors.some((e) => formatParserError(e).includes("unclosed save frame")),
    );
  });

  it("should detect empty data block", function () {
    const result = parser("data_empty");
    const errors = result.errors;
    assert.ok(errors.length > 0);
    assert.ok(
      errors.some((e) => formatParserError(e).includes("empty data block")),
    );
  });

  it("should detect non-ASCII in CIF1", function () {
    const result = parser("data_test\n_a ümlaut");
    const errors = result.errors.filter(
      (e) => e.type === ParserErrorType.NonAsciiCharacter,
    );
    assert.strictEqual(errors.length, 1);
  });

  it("should detect line too long in CIF1", function () {
    const longLine = "data_test\n_a " + "x".repeat(2100);
    const result = parser(longLine);
    const errors = result.errors.filter(
      (e) => formatParserError(e).includes("line too long"),
    );
    assert.strictEqual(errors.length, 1);
  });

  it("should detect empty file", function () {
    const result = parser("");
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => formatParserError(e).includes("empty file")),
    );
  });

  it("should detect stray values without tags", function () {
    const result = parser("data_test\n_a 1 stray_value");
    const errors = result.errors;
    assert.ok(errors.length > 0);
    assert.ok(
      errors.some((e) =>
        formatParserError(e).includes("unexpected value"),
      ),
    );
  });
});

describe("CIF2 features", function () {
  it("should parse CIF2 header with tables", function () {
    const input = `#\\#CIF_2.0
data_cif2_test
_tag { 'key': 'value' }
`;
    const result = parser(input);
    assert.strictEqual(result.errors.length, 0);
  });

  it("should parse CIF2 lists", function () {
    const input = `#\\#CIF_2.0
data_list_test
_numbers [1 2 3]
`;
    const result = parser(input);
    assert.strictEqual(result.errors.length, 0);
  });
});
