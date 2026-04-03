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
            showBonus: true,

        radios.on('change', refreshSummary);
        refreshSummary();
      },
      close: () => safeResolve(null),
            showBonus: true,
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

/**
 * Apply Foundry chat roll visibility rules to a manually created chat message.
 * @param {object} chatData
 * @param {string} rollMode
 * @returns {object}
 */
export function applyChatRollMode(chatData, rollMode = game.settings.get('core', 'rollMode')) {
  const messageData = {
    ...chatData,
    rollMode,
  };

  if (typeof ChatMessage?.applyRollMode === 'function') {
    ChatMessage.applyRollMode(messageData, rollMode);
    return messageData;
  }

  if (rollMode === 'gmroll') {
    messageData.whisper = ChatMessage.getWhisperRecipients('GM').map((user) => user.id);
  } else if (rollMode === 'blindroll') {
    messageData.whisper = ChatMessage.getWhisperRecipients('GM').map((user) => user.id);
    messageData.blind = true;
  } else if (rollMode === 'selfroll') {
    messageData.whisper = [game.user.id];
  }

  return messageData;
}

/**
 * Translate roll type keys to user-facing labels used inside brackets.
 * @param {string} typeKey
 * @returns {string}
 */
export function getRollTypeLabel(typeKey = '') {
  const labels = {
    ability: 'Habilidad',
    save: 'Salvacion',
    item: 'Objeto',
    feature: 'Dote',
    spell: 'Conjuro',
    fear: 'Miedo',
    special: 'Especial',
    weapon: 'Arma',
    armor: 'Armadura',
  };
  return labels[typeKey] || 'Tirada';
}

/**
 * Build the standardized flavor title: [Tipo] Nombre.
 * @param {string} typeKey
 * @param {string} name
 * @returns {string}
 */
export function buildTypedRollTitle(typeKey, name) {
  return `[${getRollTypeLabel(typeKey)}] ${name}`;
}

/**
 * Return first d20 natural result from a roll, if present.
 * @param {Roll} roll
 * @returns {number|null}
 */
export function getNaturalD20Result(roll) {
  const d20Term = roll?.dice?.find((die) => die?.faces === 20);
  if (!d20Term) return null;
  const first = d20Term.results?.find((r) => r?.active !== false);
  return typeof first?.result === 'number' ? first.result : null;
}

/**
 * Build the d20 outcome text requested by the system rules.
 * @param {Roll} roll
 * @returns {string}
 */
export function getD20OutcomeText(roll) {
  const natural = getNaturalD20Result(roll);
  if (natural === null) return '';

  const mood = (natural % 2 === 0) ? 'Esperanza' : 'Miedo';
  if (natural === 20) return `${mood} | CRITICO NATURAL`;
  if (natural === 1) return `${mood} | Pifa`;
  return `Tirada con ${mood}`;
}

/**
 * Return first edge d6 result from a roll, if present.
 * @param {Roll} roll
 * @returns {number|null}
 */
export function getEdgeD6Result(roll) {
  const d6Term = roll?.dice?.find((die) => die?.faces === 6);
  if (!d6Term) return null;
  const first = d6Term.results?.find((r) => r?.active !== false);
  return typeof first?.result === 'number' ? first.result : null;
}

/**
 * Build a compact dice breakdown preserving active die results order.
 * @param {Roll} roll
 * @returns {string}
 */
export function getRollDiceBreakdown(roll) {
  if (!roll?.dice?.length) return '';

  const values = [];
  for (const die of roll.dice) {
    const activeResults = die?.results?.filter((result) => result?.active !== false) || [];
    for (const result of activeResults) {
      if (typeof result?.result === 'number') values.push(String(result.result));
    }
  }

  return values.join('+');
}

/**
 * Build d20 outcome text with optional mood suppression.
 * @param {Roll} roll
 * @param {{includeMood?: boolean}} options
 * @returns {string}
 */
export function getD20OutcomeTextWithOptions(roll, { includeMood = true } = {}) {
  const natural = getNaturalD20Result(roll);
  if (natural === null) return '';

  if (!includeMood) {
    if (natural === 20) return 'CRITICO NATURAL';
    if (natural === 1) return 'Pifa';
    return '';
  }

  return getD20OutcomeText(roll);
}

/**
 * Build a stylized HTML flavor card for chat messages.
 * @param {{title: string, roll?: Roll, outcomeText?: string, edgeMode?: string, totalOverride?: number|null, showDiceBreakdown?: boolean, showBonus?: boolean}} options
 * @returns {string}
 */
export function buildRollFlavorHtml({
  title = '',
  roll = null,
  outcomeText = '',
  edgeMode = ROLL_EDGE_MODE.NONE,
  totalOverride = null,
  showDiceBreakdown = false,
  showBonus = false,
} = {}) {
  const safeTitle = String(title)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const natural = roll ? getNaturalD20Result(roll) : null;
  const edgeD6 = roll ? getEdgeD6Result(roll) : null;
  const total = typeof totalOverride === 'number'
    ? totalOverride
    : (roll && typeof roll.total === 'number') ? roll.total : null;
  const hasEdge = natural !== null
    && edgeD6 !== null
    && (edgeMode === ROLL_EDGE_MODE.ADVANTAGE || edgeMode === ROLL_EDGE_MODE.DISADVANTAGE);
  const edgeSigned = hasEdge
    ? (edgeMode === ROLL_EDGE_MODE.ADVANTAGE ? edgeD6 : -edgeD6)
    : 0;
  const diceValues = [];
  for (const die of roll?.dice || []) {
    for (const result of die?.results || []) {
      if (result?.active === false) continue;
      if (typeof result?.result === 'number') diceValues.push(result.result);
    }
  }
  const diceSum = diceValues.reduce((sum, value) => sum + value, 0);
  const bonus = (natural !== null && total !== null)
    ? (total - natural - edgeSigned)
    : (total !== null && diceValues.length ? (total - diceSum) : null);
  const shouldShowBonus = bonus !== null && (natural !== null || (showBonus && bonus !== 0));
  const bonusLabel = bonus === null
    ? ''
    : `${bonus >= 0 ? '+' : ''}${bonus}`;
  const mood = natural !== null ? (natural % 2 === 0 ? 'esperanza' : 'miedo') : '';
  const moodLabel = mood ? (mood === 'esperanza' ? 'Esperanza' : 'Miedo') : '';
  const resolvedOutcome = outcomeText || (roll ? getD20OutcomeText(roll) : '');
  const edgeLabel = hasEdge
    ? `${edgeMode === ROLL_EDGE_MODE.ADVANTAGE ? '+' : '-'}${edgeD6}`
    : '';
  const diceBreakdown = showDiceBreakdown && roll ? getRollDiceBreakdown(roll) : '';

  return `
    <div class="tirduin-roll-flavor ${mood ? `is-${mood}` : ''}">
      ${safeTitle ? `<div class="tirduin-roll-title">${safeTitle}</div>` : ''}
      ${natural !== null ? `
      <div class="tirduin-roll-mood ${hasEdge ? 'tirduin-roll-mood-edge' : ''}">
        <span class="tirduin-roll-dot"></span>
        <span class="tirduin-roll-mood-label">${moodLabel}</span>
        <span class="tirduin-roll-mood-value">${natural}</span>
        ${hasEdge ? `<span class="tirduin-roll-edge-value">${edgeLabel}</span>` : ''}
      </div>
      ` : ''}
      ${diceBreakdown ? `<div class="tirduin-roll-breakdown">${diceBreakdown}</div>` : ''}
      ${total !== null ? `
      <div class="tirduin-roll-metrics">
        ${shouldShowBonus ? `<div class="tirduin-roll-bonus">Bonificador: ${bonusLabel}</div>` : ''}
        <div class="tirduin-roll-total">Total: ${total}</div>
      </div>
      ` : ''}
      ${resolvedOutcome ? `<div class="tirduin-roll-outcome">${resolvedOutcome}</div>` : ''}
    </div>
  `;
}

/**
 * Build one unified chat card containing both weapon attack and damage rolls.
 * @param {{weaponName: string, edgeText?: string, edgeMode?: string, attackRoll: Roll, damageRoll: Roll, damageTypeLabel?: string, damageRoll2?: Roll|null, damageTypeLabel2?: string}} options
 * @returns {string}
 */
export function buildWeaponAttackDamageFlavorHtml({
  weaponName = '',
  edgeText = '',
  edgeMode = ROLL_EDGE_MODE.NONE,
  attackRoll,
  damageRoll,
  damageTypeLabel = '',
  damageRoll2 = null,
  damageTypeLabel2 = '',
  targetName = null,
  targetAC = null,
} = {}) {
  const attackTitle = buildTypedRollTitle(
    'weapon',
    `${weaponName} Ataque${edgeText}`
  );
  const damageTitle = damageTypeLabel || 'Danio';
  const damageTitle2 = damageTypeLabel2 || 'Danio 2';

  let attackOutcomeText = getD20OutcomeText(attackRoll);
  if (targetName !== null && targetAC !== null) {
    const hit = (Number(attackRoll.total) || 0) >= Number(targetAC);
    const hitLabel = hit ? 'IMPACTA' : 'FALLA';
    attackOutcomeText = [attackOutcomeText, `${hitLabel} a ${targetName}`]
      .filter(Boolean)
      .join(' | ');
  }

  return `
    <div class="tirduin-roll-bundle">
      ${buildRollFlavorHtml({
        title: attackTitle,
        roll: attackRoll,
        outcomeText: attackOutcomeText,
        edgeMode,
      })}
      ${buildRollFlavorHtml({
        title: damageTitle,
        roll: damageRoll,
        showDiceBreakdown: true,
        showBonus: true,
      })}
      ${damageRoll2 ? buildRollFlavorHtml({
        title: damageTitle2,
        roll: damageRoll2,
        showDiceBreakdown: true,
        showBonus: true,
      }) : ''}
    </div>
  `;
}