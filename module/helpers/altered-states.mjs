/**
 * Resolve a localized altered state catalog from system config.
 * @returns {Array<{key: string, label: string, description: string}>}
 */
export function getAlteredStateCatalog() {
  const source = CONFIG.TIRDUIN_RPS?.alteredStates || {};

  return Object.entries(source).map(([key, entry]) => ({
    key,
    label: game.i18n.localize(entry.label || key),
    description: game.i18n.localize(entry.description || ""),
  }));
}

/**
 * Resolve one altered state by key.
 * @param {string} key
 * @returns {{key: string, label: string, description: string} | null}
 */
export function getAlteredStateByKey(key = "") {
  const source = CONFIG.TIRDUIN_RPS?.alteredStates || {};
  const entry = source[key];
  if (!entry) return null;

  return {
    key,
    label: game.i18n.localize(entry.label || key),
    description: game.i18n.localize(entry.description || ""),
  };
}
