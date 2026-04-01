export const ROLL_EDGE_MODE = Object.freeze({
  NONE: 'none',
  ADVANTAGE: 'advantage',
  DISADVANTAGE: 'disadvantage',
});

/**
 * Build a resolved formula preview for dialog summary using available roll data.
 * @param {string} formula
 * @param {object} rollData
 * @param {string} edgeMode
 * @returns {string}
 */
export function getRollFormulaPreview(
  formula,
  rollData = {},
  edgeMode = ROLL_EDGE_MODE.NONE
) {
  const adjustedFormula = applyRollEdgeToFormula(formula, edgeMode);
  if (!adjustedFormula) return '';

  try {
    // Foundry normalizes and resolves @data paths when instantiating Roll.
    return new Roll(adjustedFormula, rollData).formula;
  } catch (_error) {
    // Fall back to the adjusted formula if resolution fails for any reason.
    return adjustedFormula;
  }
}

/**
 * Ask the user to confirm a roll and optionally apply advantage/disadvantage.
 * @param {{formula?: string, rollData?: object}} options
 * @returns {Promise<string | null>} Selected edge mode, or null if canceled.
 */
export async function promptRollConfirmation({ formula = '', rollData = {} } = {}) {
  return new Promise((resolve) => {
    let settled = false;

    const safeResolve = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const summary = getRollFormulaPreview(formula, rollData, ROLL_EDGE_MODE.NONE);

    const content = `
      <form class="tirduin-roll-confirmation">
        <p class="roll-summary" data-role="roll-summary">${summary}</p>
        <div class="roll-edge-row">
          <label class="roll-edge-option">
            <input type="radio" name="tirduin-roll-edge" value="${ROLL_EDGE_MODE.ADVANTAGE}">
            Ventaja
          </label>
          <label class="roll-edge-option">
            <input type="radio" name="tirduin-roll-edge" value="${ROLL_EDGE_MODE.DISADVANTAGE}">
            Desventaja
          </label>
        </div>
      </form>
    `;

    new Dialog({
      title: 'Confirmar tirada',
      content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: 'Tirar',
          callback: (html) => {
            const selected = html.find('input[name="tirduin-roll-edge"]:checked').val();
            safeResolve(selected || ROLL_EDGE_MODE.NONE);
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancelar',
          callback: () => safeResolve(null),
        },
      },
      default: 'roll',
      classes: ['tirduin', 'tirduin-roll-dialog'],
      render: (html) => {
        // Keep the roll summary in sync with selected edge mode.
        const summaryEl = html.find('[data-role="roll-summary"]');
        const radios = html.find('input[name="tirduin-roll-edge"]');

        const refreshSummary = () => {
          const selected = html.find('input[name="tirduin-roll-edge"]:checked').val();
          const edgeMode = selected || ROLL_EDGE_MODE.NONE;
          summaryEl.text(getRollFormulaPreview(formula, rollData, edgeMode));
        };

        radios.on('change', refreshSummary);
        refreshSummary();
      },
      close: () => safeResolve(null),
    }).render(true);
  });
}

/**
 * Inject edge dice (+/-1d6) into an existing formula without losing modifiers.
 * @param {string} formula
 * @param {string} edgeMode
 * @returns {string}
 */
export function applyRollEdgeToFormula(formula, edgeMode = ROLL_EDGE_MODE.NONE) {
  if (!formula) return formula;
  if (edgeMode === ROLL_EDGE_MODE.ADVANTAGE) return `(${formula}) + 1d6`;
  if (edgeMode === ROLL_EDGE_MODE.DISADVANTAGE) return `(${formula}) - 1d6`;
  return formula;
}

/**
 * Build a small flavor suffix to show the selected edge mode in chat.
 * @param {string} edgeMode
 * @returns {string}
 */
export function getRollEdgeFlavorSuffix(edgeMode = ROLL_EDGE_MODE.NONE) {
  if (edgeMode === ROLL_EDGE_MODE.ADVANTAGE) return ' (Ventaja)';
  if (edgeMode === ROLL_EDGE_MODE.DISADVANTAGE) return ' (Desventaja)';
  return '';
}