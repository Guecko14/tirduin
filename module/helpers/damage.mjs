/**
 * Normalize a numeric input.
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Count damage dice from a formula string.
 * Supports multiple dice groups: e.g. 2d6+1d8 => 3 dice.
 * @param {string} formula
 * @returns {number}
 */
export function extractDiceCount(formula = "") {
  if (!formula || typeof formula !== "string") return 0;

  const regex = /(\d+)\s*d\s*\d+/gi;
  let totalDice = 0;
  let match;

  while ((match = regex.exec(formula)) !== null) {
    totalDice += toNumber(match[1]);
  }

  return totalDice;
}
