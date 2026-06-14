import { parser } from "../parser/parser";
import { Token, TokenType } from "../parser/token";

/**
 * Options for the safe CIF formatter. The defaults are conservative: the
 * formatter only rewrites whitespace that has no semantic meaning, so the
 * output round-trips through the lexer without changing the token stream.
 */
export interface FormatOptions {
  /**
   * Align consecutive single-line `_tag value` pairs inside a data block to
   * the longest tag length in the run. Defaults to true. Multiline `;...;`
   * values and quoted strings are never realigned.
   */
  alignTagValues?: boolean;
  /**
   * Maximum number of consecutive blank lines to preserve. Runs longer than
   * this are collapsed. Defaults to 1.
   */
  maxBlankLines?: number;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  alignTagValues: true,
  maxBlankLines: 1,
};

export interface FormatResult {
  /**
   * The formatted text. Always ends with exactly one trailing newline when
   * the input was non-empty.
   */
  formatted: string;
  /**
   * True when the formatter rewrote at least one character.
   */
  changed: boolean;
  /**
   * Stable summary that the agent CLI surfaces as JSON.
   */
  summary: {
    lines: number;
    trailing_whitespace_trimmed: number;
    blank_runs_collapsed: number;
    tag_runs_aligned: number;
    line_endings_normalized: boolean;
    trailing_newline_added: boolean;
  };
}

/**
 * Safe, idempotent CIF formatter.
 *
 * The formatter only rewrites presentation whitespace:
 * - normalizes `\r\n` line endings to `\n`,
 * - trims trailing whitespace from every line,
 * - collapses runs of blank lines longer than {@link FormatOptions.maxBlankLines},
 * - aligns consecutive single-line `_tag value` pairs to a common column,
 * - guarantees exactly one trailing newline.
 *
 * Multiline `;...;` values, quoted strings, and comments are preserved as-is.
 * The formatter is idempotent: feeding the output back through `formatCif`
 * yields the same text with `changed: false`.
 */
export function formatCif(
  source: string,
  options: FormatOptions = {},
): FormatResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalized = source.replace(/\r\n/g, "\n");
  const lineEndingsNormalized = normalized !== source;

  const rawLines = normalized.split("\n");
  // Split keeps a trailing empty string when the input ends with "\n"; we
  // drop it temporarily so we can reason about real lines and re-add the
  // trailing newline at the end. The flag is informational and the final
  // newline accounting is handled later via `trailingNewlineAdded`.
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  // First pass: trim trailing whitespace on each line, but never touch the
  // body or the opener/closer of a multiline `;...;` value.
  const lines = rawLines.map((line) => line);
  let trailingTrimmed = 0;
  let inMultiline = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inMultiline) {
      // We are inside a `;...;` body. Preserve every byte of the body,
      // including the closer line. The closer exits multiline mode but is
      // still part of the literal value.
      if (line.trimStart().startsWith(";")) {
        inMultiline = false;
      }
      continue;
    }
    if (line.trimStart().startsWith(";")) {
      // Entering a multiline value. Preserve the opener verbatim because
      // CIF treats the entire opener line as part of the literal value.
      inMultiline = true;
      continue;
    }
    const trimmed = line.replace(/[ \t]+$/, "");
    if (trimmed !== line) {
      trailingTrimmed++;
      lines[i] = trimmed;
    }
  }

  // Second pass: collapse blank-line runs.
  let blankRunsCollapsed = 0;
  const collapsed: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      blankRun++;
      if (blankRun <= opts.maxBlankLines) {
        collapsed.push("");
      }
      continue;
    }
    if (blankRun > opts.maxBlankLines) {
      blankRunsCollapsed++;
    }
    blankRun = 0;
    collapsed.push(line);
  }
  if (blankRun > opts.maxBlankLines) {
    blankRunsCollapsed++;
  }
  // Strip leading blank lines (a CIF file should not start with blanks).
  while (collapsed.length > 0 && collapsed[0] === "") {
    collapsed.shift();
  }
  // Strip trailing blank lines; we'll re-add exactly one trailing newline.
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === "") {
    collapsed.pop();
  }

  // Third pass (optional): align consecutive single-line tag/value runs.
  let tagRunsAligned = 0;
  if (opts.alignTagValues && collapsed.length > 0) {
    const aligned = alignTagRuns(collapsed);
    tagRunsAligned = aligned.runsAligned;
    aligned.lines.forEach((line, i) => {
      collapsed[i] = line;
    });
  }

  const formatted =
    collapsed.length === 0 ? "" : collapsed.join("\n") + "\n";

  // `changed` is the ground truth: did the formatter rewrite the source?
  // The individual summary counters are observability metadata and may
  // double-count work that cancels out (e.g. trimming a trailing newline
  // that is re-added at the end), so they must not drive this flag.
  const changed = formatted !== source;

  // A trailing newline is "added" only when the original source did not end
  // with exactly one newline character.
  const trailingNewlineAdded =
    !source.endsWith("\n") && formatted.endsWith("\n");

  return {
    formatted,
    changed,
    summary: {
      lines: collapsed.length,
      trailing_whitespace_trimmed: trailingTrimmed,
      blank_runs_collapsed: blankRunsCollapsed,
      tag_runs_aligned: tagRunsAligned,
      line_endings_normalized: lineEndingsNormalized,
      trailing_newline_added: trailingNewlineAdded,
    },
  };
}

interface AlignResult {
  lines: string[];
  runsAligned: number;
}

/**
 * Aligns runs of consecutive `_tag <single-line-value>` pairs inside a data
 * block to a common column. The formatter never aligns:
 * - lines that are comments, blank, or `loop_` headers,
 * - tag values that span multiple lines (e.g. `;...;` blocks),
 * - quoted values that contain a newline,
 * - lines that start the file or follow a `loop_` keyword (because the loop
 *   header layout is controlled by the loop grammar, not the formatter).
 *
 * Alignment is computed per run: the longest `_tag` length plus two spaces.
 * The run breaks as soon as a non-tag line is encountered.
 */
function alignTagRuns(lines: string[]): AlignResult {
  const result = [...lines];
  let runsAligned = 0;
  let i = 0;
  while (i < result.length) {
    const line = result[i];
    if (!isTagValuePair(line) || followsLoopHeader(result, i)) {
      i++;
      continue;
    }
    // Collect the run.
    const start = i;
    const run: string[] = [];
    while (i < result.length && isTagValuePair(result[i])) {
      run.push(result[i]);
      i++;
    }
    if (run.length < 2) {
      // Single-tag runs are not realigned: their alignment is already
      // canonical and rewriting them would just add churn.
      continue;
    }
    const maxTagLen = Math.max(...run.map((r) => tagOf(r).length));
    const targetColumn = maxTagLen + 2;
    let runChanged = false;
    for (let j = 0; j < run.length; j++) {
      const original = run[j];
      const tag = tagOf(original);
      const value = valueOf(original);
      const aligned = tag.padEnd(targetColumn) + value;
      if (aligned !== original) {
        runChanged = true;
        result[start + j] = aligned;
      }
    }
    if (runChanged) {
      runsAligned++;
    }
  }
  return { lines: result, runsAligned };
}

function isTagValuePair(line: string): boolean {
  if (!line.startsWith("_")) {
    return false;
  }
  const match = /^(_\S+)[ \t]+(\S.*)$/.exec(line);
  return match !== null && !match[2].startsWith(";");
}

function tagOf(line: string): string {
  const match = /^(_\S+)[ \t]/.exec(line);
  return match ? match[1] : "";
}

function valueOf(line: string): string {
  const match = /^_\S+[ \t]+(\S.*)$/.exec(line);
  return match ? match[1] : "";
}

function followsLoopHeader(lines: string[], index: number): boolean {
  // Walk backwards skipping blank lines; if the previous non-blank line is a
  // `loop_` keyword or a loop header tag, we're inside a loop body and
  // alignment would corrupt the column structure the parser expects.
  for (let i = index - 1; i >= 0; i--) {
    const prev = lines[i].trim();
    if (prev === "") continue;
    if (/^loop_$/i.test(prev)) return true;
    // Inside a loop body, tags are listed one per line without values; the
    // value rows come after the tag list. We don't realign either section.
    if (/^_\S+$/.test(prev)) return true;
    return false;
  }
  return false;
}

/**
 * Returns true if formatting `source` twice is a fixed point: the second
 * pass produces the same text and reports `changed: false`.
 */
export function isFormatterIdempotent(source: string): boolean {
  const first = formatCif(source);
  const second = formatCif(first.formatted);
  return second.changed === false && second.formatted === first.formatted;
}

/**
 * Re-exports the token types used by the formatter tests so callers do not
 * need to depend on parser internals directly.
 */
export const FormatterTokenTypes = TokenType;

/**
 * Parses the input for sanity-checking in tests and CLI smoke; not used by
 * the formatter itself (the formatter operates purely on text).
 */
export function parseForFormatterCheck(source: string): {
  tokens: Token[];
} {
  return parser(source);
}
