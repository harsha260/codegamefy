export type CompareMode = 'exact' | 'float' | 'special';

/**
 * Compare expected output with actual output.
 *
 * @param expected - Expected output string
 * @param actual - Actual output from code execution
 * @param mode - Comparison mode
 * @param tolerance - Floating point tolerance (for 'float' mode)
 * @returns true if output matches
 */
export function validateOutput(
  expected: string,
  actual: string,
  mode: CompareMode,
  tolerance: number = 1e-6,
): boolean {
  switch (mode) {
    case 'exact':
      return normalizeWhitespace(expected) === normalizeWhitespace(actual);

    case 'float':
      return compareFloat(expected, actual, tolerance);

    case 'special':
      // Special judge would be implemented per-problem
      // For now, fall back to exact comparison
      return normalizeWhitespace(expected) === normalizeWhitespace(actual);
  }
}

/**
 * Normalize whitespace for comparison:
 * - Trim leading/trailing whitespace
 * - Normalize line endings to \n
 * - Remove trailing whitespace from each line
 * - Remove trailing empty lines
 */
function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Compare outputs line-by-line with floating point tolerance.
 * Each token on each line is compared:
 * - If both parse as numbers, compare with tolerance
 * - Otherwise, compare as exact strings
 */
function compareFloat(expected: string, actual: string, tolerance: number): boolean {
  const expLines = normalizeWhitespace(expected).split('\n');
  const actLines = normalizeWhitespace(actual).split('\n');

  if (expLines.length !== actLines.length) return false;

  for (let i = 0; i < expLines.length; i++) {
    const expTokens = expLines[i]!.split(/\s+/);
    const actTokens = actLines[i]!.split(/\s+/);

    if (expTokens.length !== actTokens.length) return false;

    for (let j = 0; j < expTokens.length; j++) {
      const expNum = parseFloat(expTokens[j]!);
      const actNum = parseFloat(actTokens[j]!);

      if (!isNaN(expNum) && !isNaN(actNum)) {
        // Both are numbers — compare with tolerance
        if (Math.abs(expNum - actNum) > tolerance) {
          return false;
        }
      } else {
        // At least one is not a number — exact string comparison
        if (expTokens[j] !== actTokens[j]) {
          return false;
        }
      }
    }
  }

  return true;
}
