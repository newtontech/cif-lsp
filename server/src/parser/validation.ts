import { isValue, ParserResult, Token, TokenType } from "./token";
import { ParserError, ParserErrorType } from "./parserErrors";

export function validateParsedData(data: ParserResult): void {
  checkDuplicateDataBlocks(data);
  checkDuplicateTagsInBlocks(data);
  checkInvalidUncertainty(data);
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
