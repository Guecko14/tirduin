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

/**
 * Resolve per-die vulnerability and resistance values for a damage type.
 * @param {object} damageModifiers
 * @param {string} damageType
 * @returns {{ vulnerabilityPerDie: number, resistancePerDie: number, netPerDie: number }}
 */
export function getPerDieModifiers(damageModifiers = {}, damageType = "") {
  const vulnerabilityPerDie = toNumber(damageModifiers?.vulnerability?.[damageType]);
  const resistancePerDie = toNumber(damageModifiers?.resistance?.[damageType]);

  return {
    vulnerabilityPerDie,
    resistancePerDie,
    netPerDie: vulnerabilityPerDie - resistancePerDie,
  };
}

/**
 * Compute total flat adjustment from vulnerability/resistance by number of dice.
 * Formula: adjustment = (vulnerability - resistance) * diceCount
 * @param {object} params
 * @param {object} params.damageModifiers
 * @param {string} params.damageType
 * @param {number} [params.diceCount]
 * @param {string} [params.damageFormula]
 * @returns {{ diceCount: number, netPerDie: number, flatAdjustment: number, vulnerabilityPerDie: number, resistancePerDie: number }}
 */
export function computeDamageTypeAdjustment({
  damageModifiers = {},
  damageType = "",
  diceCount,
  damageFormula,
} = {}) {
  const resolvedDiceCount = Number.isFinite(Number(diceCount))
    ? toNumber(diceCount)
    : extractDiceCount(damageFormula || "");

  const { vulnerabilityPerDie, resistancePerDie, netPerDie } = getPerDieModifiers(
    damageModifiers,
    damageType
  );

  return {
    diceCount: resolvedDiceCount,
    vulnerabilityPerDie,
    resistancePerDie,
    netPerDie,
    flatAdjustment: netPerDie * resolvedDiceCount,
  };
}

/**
 * Apply adjustment to a rolled damage value.
 * @param {object} params
 * @param {number} params.rolledDamage
 * @param {object} params.damageModifiers
 * @param {string} params.damageType
 * @param {number} [params.diceCount]
 * @param {string} [params.damageFormula]
 * @returns {{ rolledDamage: number, finalDamage: number, flatAdjustment: number, diceCount: number, vulnerabilityPerDie: number, resistancePerDie: number, netPerDie: number }}
 */
export function applyDamageTypeAdjustment({
  rolledDamage = 0,
  damageModifiers = {},
  damageType = "",
  diceCount,
  damageFormula,
} = {}) {
  const details = computeDamageTypeAdjustment({
    damageModifiers,
    damageType,
    diceCount,
    damageFormula,
  });

  return {
    rolledDamage: toNumber(rolledDamage),
    finalDamage: toNumber(rolledDamage) + details.flatAdjustment,
    ...details,
  };
}
