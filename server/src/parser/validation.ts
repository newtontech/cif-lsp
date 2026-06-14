import { isValue, ParserResult, Token, TokenType } from "./token";
import { ParserError, ParserErrorType } from "./parserErrors";

export function validateParsedData(data: ParserResult): void {
  checkDuplicateDataBlocks(data);
  checkDuplicateTagsInBlocks(data);
  checkInvalidUncertainty(data);
  checkMalformedDataBlocks(data);
  checkMissingCellParameters(data);
  checkAtomSiteSymmetryMismatch(data);
}

function checkDuplicateDataBlocks(data: ParserResult): void {
  const seen = new Map<string, Token>();
  const alreadyReported = new Set<Token>();
  for (const token of data.tokens) {
    if (token.type === TokenType.DATA) {
      // CIF data block names are case-insensitive
      const name = token.text.toLowerCase();
      const existing = seen.get(name);
      if (existing) {
        if (!alreadyReported.has(existing)) {
          data.errors.push(
            new ParserError(ParserErrorType.DuplicateData, existing),
          );
          alreadyReported.add(existing);
        }
        data.errors.push(new ParserError(ParserErrorType.DuplicateData, token));
      } else {
        seen.set(name, token);
      }
    }
  }
}

function checkDuplicateTagsInBlocks(data: ParserResult): void {
  const tagsByBlock = new Map<string, Map<string, Token>>();
  const alreadyReported = new Set<Token>();
  for (const token of data.tokens) {
    if (token.type !== TokenType.TAG) {
      continue;
    }
    const blockName = token.save?.text || token.block?.text;
    if (!blockName) {
      continue;
    }
    const tagName = token.text;
    if (!tagsByBlock.has(blockName)) {
      tagsByBlock.set(blockName, new Map());
    }
    const tagMap = tagsByBlock.get(blockName)!;
    const existing = tagMap.get(tagName);
    if (existing) {
      if (!alreadyReported.has(existing)) {
        data.errors.push(
          new ParserError(ParserErrorType.DuplicateTag, existing),
        );
        alreadyReported.add(existing);
      }
      data.errors.push(new ParserError(ParserErrorType.DuplicateTag, token));
    } else {
      tagMap.set(tagName, token);
    }
  }
}

export function validateTextContent(
  sourceCode: string,
  data: ParserResult,
): void {
  const errors = data.errors;
  const maxLineLength = 2048;
  let line = 0;
  let col = 0;
  let lineLength = 0;
  for (let i = 0; i < sourceCode.length; i++) {
    const char = sourceCode[i];
    if (char === "\n") {
      if (lineLength > maxLineLength) {
        errors.push(
          new ParserError(
            ParserErrorType.LineTooLong,
            undefined,
            `Line ${line + 1} exceeds ${maxLineLength} characters`,
          ),
        );
      }
      line++;
      col = 0;
      lineLength = 0;
      continue;
    }
    if (!isCif1CharAllowed(char.charCodeAt(0))) {
      const code =
        "U+" + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0");
      errors.push(
        new ParserError(
          ParserErrorType.NonAsciiCharacter,
          undefined,
          `Non-ASCII character '${char}' (${code}) at line ${line + 1}, col ${col + 1}`,
        ),
      );
    }
    col++;
    lineLength++;
  }
  if (lineLength > maxLineLength) {
    errors.push(
      new ParserError(
        ParserErrorType.LineTooLong,
        undefined,
        `Line ${line + 1} exceeds ${maxLineLength} characters`,
      ),
    );
  }
}

function isCif1CharAllowed(code: number): boolean {
  return code === 9 || code === 10 || (code >= 32 && code <= 127);
}

export function validateTokens(result: ParserResult): void {
  for (const token of result.tokens) {
    const { type, text } = token;
    const maxLength =
      type === TokenType.TAG
        ? 75
        : type === TokenType.DATA || type === TokenType.SAVE
          ? 80
          : undefined;
    if (maxLength !== undefined && text.length > maxLength) {
      result.errors.push(
        new ParserError(
          ParserErrorType.ValueTooLong,
          token,
          `Length ${text.length}, max ${maxLength}`,
        ),
      );
    }
  }
}

/**
 * Numeric base for an uncertainty suffix. Mirrors the lexer's NUMBER base so
 * the validator only flags tokens the lexer already treated as numeric.
 */
const UNCERTAINTY_BASE =
  "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?";

/**
 * Matches a numeric value immediately followed by a parenthesised group:
 *   <base>(<first-group>)<rest>
 * Captures the first parenthesised group and any trailing text so the caller
 * can decide whether the suffix is a well-formed CIF standard-uncertainty
 * `(<digits>)`.
 */
const UNCERTAINTY_FORM = new RegExp(
  `^(${UNCERTAINTY_BASE})\\(([^\\)]*)\\)(.*)$`,
);

function isWellFormedUncertaintySuffix(inner: string, rest: string): boolean {
  return /^\d+$/.test(inner) && rest === "";
}

/**
 * Flags CIF numeric values that carry a malformed standard-uncertainty suffix.
 *
 * CIF allows a numeric value to be written as `<number>(<digits>)`, where the
 * parenthesised digits are the standard uncertainty in the last quoted digits
 * (for example `12.34(5)` means 12.34 ± 0.05). Values such as `12.34(ab)`,
 * `12.34(5.6)`, `12.34()`, `12.34(5)(6)`, or `1.2(3)x` look numeric but carry
 * a suffix that is not a valid uncertainty annotation, so they are reported.
 */
function checkInvalidUncertainty(data: ParserResult): void {
  for (const token of data.tokens) {
    if (!isValue(token)) {
      continue;
    }
    if (token.type !== TokenType.NUMBER && token.type !== TokenType.UNQUOTED) {
      continue;
    }
    const match = UNCERTAINTY_FORM.exec(token.text);
    if (match === null) {
      continue;
    }
    const inner = match[2];
    const rest = match[3];
    if (isWellFormedUncertaintySuffix(inner, rest)) {
      continue;
    }
    data.errors.push(new ParserError(ParserErrorType.InvalidUncertainty, token));
  }
}

/**
 * Matches a `data_` keyword written without a block name (case-insensitive).
 *
 * The CIF lexer recognises a data-block header as `data_<name>` where `<name>`
 * is non-empty. A standalone `data_` token therefore ends up classified as
 * UNQUOTED text. The parser's {@link dataBlock} step emits
 * `MalformedDataBlock` for these tokens directly, so this validator only acts
 * as a defensive net for callers that bypass the parser (e.g. future lexer
 * re-entry paths) without duplicating the diagnostic for the common path.
 */
const MALFORMED_DATA_BLOCK = /^data_$/i;

/**
 * Flags `data_` keywords written without a block name.
 *
 * Defensive check: the parser's dataBlock step already emits
 * `MalformedDataBlock` for UNQUOTED `data_` tokens, so this scans for any
 * such token that has not already been flagged to keep the diagnostic count
 * stable when callers reach validation through a different path.
 */
function checkMalformedDataBlocks(data: ParserResult): void {
  const alreadyReported = new Set<Token>();
  for (const error of data.errors) {
    if (
      error.type === ParserErrorType.MalformedDataBlock &&
      error.token !== undefined
    ) {
      alreadyReported.add(error.token);
    }
  }
  for (const token of data.tokens) {
    if (token.type !== TokenType.UNQUOTED) {
      continue;
    }
    if (alreadyReported.has(token)) {
      continue;
    }
    if (MALFORMED_DATA_BLOCK.test(token.text)) {
      data.errors.push(
        new ParserError(ParserErrorType.MalformedDataBlock, token),
      );
      alreadyReported.add(token);
    }
  }
}

/**
 * The six canonical unit-cell parameters required to fully describe a unit
 * cell. A data block that declares some but not all of them is incomplete.
 */
const CELL_PARAMETER_TAGS: readonly string[] = [
  "_cell.length_a",
  "_cell.length_b",
  "_cell.length_c",
  "_cell.angle_alpha",
  "_cell.angle_beta",
  "_cell.angle_gamma",
];

/**
 * Maps each canonical cell parameter to the set of CIF data names that
 * downstream tools treat as synonymous. CIF dictionaries use underscores in
 * both `_cell.length_a` (ddl-mmtf) and `_cell_length_a` (coreCIF) shapes; we
 * accept both so the rule is robust against either dictionary convention.
 */
const CELL_PARAMETER_ALIASES: ReadonlyMap<string, readonly string[]> = new Map(
  CELL_PARAMETER_TAGS.map((canonical) => {
    const alt = "_" + canonical.slice(1).replace(".", "_");
    return [canonical, [canonical.toLowerCase(), alt.toLowerCase()]];
  }),
);

interface CellParameterBlock {
  blockToken: Token;
  present: Set<string>;
}

/**
 * Aggregates cell-parameter tag declarations per data block.
 *
 * Returns blocks that declare at least one (but not all six) cell parameter.
 * Blocks without any cell parameter are ignored because they may describe
 * non-crystallographic data; blocks with all six are intentionally complete.
 */
function collectIncompleteCellBlocks(data: ParserResult): CellParameterBlock[] {
  const blocks = new Map<Token, Set<string>>();
  for (const token of data.tokens) {
    if (token.type !== TokenType.TAG) {
      continue;
    }
    const block = token.save ?? token.block;
    if (!block) {
      continue;
    }
    const lower = token.text.toLowerCase();
    for (const [canonical, aliases] of CELL_PARAMETER_ALIASES) {
      if (aliases.includes(lower)) {
        if (!blocks.has(block)) {
          blocks.set(block, new Set());
        }
        blocks.get(block)!.add(canonical);
        break;
      }
    }
  }
  const incomplete: CellParameterBlock[] = [];
  for (const [blockToken, present] of blocks) {
    if (present.size > 0 && present.size < CELL_PARAMETER_TAGS.length) {
      incomplete.push({ blockToken, present });
    }
  }
  return incomplete;
}

/**
 * Flags data blocks that declare some but not all six unit-cell parameters.
 *
 * Crystallographic runners require all of `_cell.length_a/b/c` and
 * `_cell.angle_alpha/beta/gamma` to build a unit cell. A partial declaration
 * (for example, only the three lengths) leaves the cell under-specified, so
 * the rule warns once per offending block and names the missing tags in the
 * message. The diagnostic range covers the offending `data_<name>` token so
 * agents and editors can link the warning back to the block.
 */
function checkMissingCellParameters(data: ParserResult): void {
  const incomplete = collectIncompleteCellBlocks(data);
  for (const { blockToken, present } of incomplete) {
    const missing = CELL_PARAMETER_TAGS.filter(
      (canonical) => !present.has(canonical),
    );
    if (missing.length === 0) {
      continue;
    }
    const display = missing
      .map((tag) => "_" + tag.slice(1).replace(".", "_"))
      .join(", ");
    data.errors.push(
      new ParserError(
        ParserErrorType.MissingCellParameters,
        blockToken,
        `Missing ${missing.length} unit-cell parameter(s): ${display}`,
      ),
    );
  }
}

/**
 * Tags that mark an `_atom_site` loop. Their presence means the block
 * declares per-atom coordinate data that needs symmetry information to be
 * interpretable.
 */
const ATOM_SITE_COORD_TAGS: readonly string[] = [
  "_atom_site.fract_x",
  "_atom_site.fract_y",
  "_atom_site.fract_z",
  "_atom_site.cartn_x",
  "_atom_site.cartn_y",
  "_atom_site.cartn_z",
].flatMap((canonical) => [
  canonical.toLowerCase(),
  "_" + canonical.slice(1).replace(".", "_"),
]);

/**
 * Tags that satisfy the symmetry-information requirement for an `_atom_site`
 * loop. Either an explicit space-group name or a list of equivalent positions
 * is sufficient.
 */
const SYMMETRY_INFO_TAGS: readonly string[] = [
  "_symmetry.space_group_name_h-m",
  "_symmetry.space_group_name_hall",
  "_symmetry.int_tables_number",
  "_symmetry_equiv.pos_as_xyz",
].flatMap((canonical) => [
  canonical.toLowerCase(),
  "_" + canonical.slice(1).replace(".", "_"),
]);

interface AtomSiteSymmetryBlock {
  blockToken: Token;
  atomSiteToken: Token;
}

/**
 * Locates data blocks that declare atom-site coordinates but no symmetry
 * information. Each occurrence yields the block token and the first
 * `_atom_site_*` coordinate tag seen, so the diagnostic range can point at
 * the relevant loop body instead of an unrelated line.
 */
function collectAtomSiteWithoutSymmetry(
  data: ParserResult,
): AtomSiteSymmetryBlock[] {
  const atomSiteBlocks = new Map<Token, Token>();
  const symmetryBlocks = new Set<Token>();
  for (const token of data.tokens) {
    if (token.type !== TokenType.TAG) {
      continue;
    }
    const block = token.save ?? token.block;
    if (!block) {
      continue;
    }
    const lower = token.text.toLowerCase();
    if (ATOM_SITE_COORD_TAGS.includes(lower) && !atomSiteBlocks.has(block)) {
      atomSiteBlocks.set(block, token);
    }
    if (SYMMETRY_INFO_TAGS.includes(lower)) {
      symmetryBlocks.add(block);
    }
  }
  const result: AtomSiteSymmetryBlock[] = [];
  for (const [blockToken, atomSiteToken] of atomSiteBlocks) {
    if (!symmetryBlocks.has(blockToken)) {
      result.push({ blockToken, atomSiteToken });
    }
  }
  return result;
}

/**
 * Flags atom-site loops declared without any symmetry information.
 *
 * Per-atom fractional/Cartesian coordinates can only be interpreted together
 * with the symmetry operations of the space group. A data block that lists
 * `_atom_site_*` coordinates but none of `_symmetry_space_group_name_*`,
 * `_symmetry_int_tables_number`, or `_symmetry_equiv_pos_as_xyz` is therefore
 * inconsistent. The warning points at the first atom-site coordinate tag so
 * the user can add the missing symmetry section nearby.
 */
function checkAtomSiteSymmetryMismatch(data: ParserResult): void {
  const blocks = collectAtomSiteWithoutSymmetry(data);
  for (const { atomSiteToken } of blocks) {
    data.errors.push(
      new ParserError(
        ParserErrorType.AtomSiteSymmetryMismatch,
        atomSiteToken,
        "Atom-site coordinates are declared without any symmetry information; add _symmetry_space_group_name_H-M or _symmetry_equiv_pos_as_xyz.",
      ),
    );
  }
}
