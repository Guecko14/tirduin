// Import document classes.
import { TirduinRPSActor } from './documents/actor.mjs';
import { TirduinRPSItem } from './documents/item.mjs';
// Import sheet classes.
import { TirduinRPSActorSheet } from './sheets/actor-sheet.mjs';
import { TirduinRPSItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { TIRDUIN_RPS } from './helpers/config.mjs';
import * as damageHelpers from './helpers/damage.mjs';
import * as alteredStatesHelpers from './helpers/altered-states.mjs';
import {
  applyRollEdgeToFormula,
  promptInitiativeConfirmation,
} from './helpers/roll-dialog.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.tirduin = {
    TirduinRPSActor,
    TirduinRPSItem,
    damage: damageHelpers,
    alteredStates: alteredStatesHelpers,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.TIRDUIN_RPS = TIRDUIN_RPS;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: '1d20 + @abilities.agil.mod',
    decimals: 2,
  };

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = TirduinRPSActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    character: models.TirduinRPSCharacter,
    npc: models.TirduinRPSNPC
  }
  CONFIG.Item.documentClass = TirduinRPSItem;
  CONFIG.Item.dataModels = {
    item: models.TirduinRPSItem,
    feature: models.TirduinRPSFeature,
    spell: models.TirduinRPSSpell,
    fear: models.TirduinRPSFear,
    // Objetos de equipo del NPC: armas y armaduras con sus propias hojas.
    weapon: models.TirduinRPSWeapon,
    armor: models.TirduinRPSArmor,
  }

  // Explicitly set valid item types (must match system.json documentTypes.Item)
  CONFIG.Item.types = Object.keys(CONFIG.Item.dataModels);

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('tirduin', TirduinRPSActorSheet, {
    makeDefault: true,
    label: 'TIRDUIN_RPS.SheetLabels.Actor',
  });
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('tirduin', TirduinRPSItemSheet, {
    makeDefault: true,
    label: 'TIRDUIN_RPS.SheetLabels.Item',
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('armorCategoryLabel', function (category) {
  const labels = {
    sinArmadura: 'Sin armadura',
    ligera: 'Ligera',
    media: 'Media',
    pesada: 'Pesada',
    escudo: 'Escudo',
    extra: 'Extra',
  };
  return labels[category] || category;
});

Handlebars.registerHelper('weaponCategoryLabel', function (category) {
  const labels = {
    simple: 'Simple',
    marcial: 'Marcial',
    magica: 'Magica',
  };
  return labels[category] || category;
});

Handlebars.registerHelper('weaponSubcategoryLabel', function (subcategory) {
  const labels = {
    melee: 'Melee',
    distancia: 'Distancia',
  };
  return labels[subcategory] || subcategory;
});

Handlebars.registerHelper('isTrue', function (value) {
  return value === true;
});

Handlebars.registerHelper('damageTypeAbbr', function (damageType) {
  const labels = {
    slashingPiercing: 'C/P',
    bludgeoning: 'CON',
    acid: 'ACI',
    cold: 'FRI',
    fire: 'FUE',
    lightning: 'ELE',
    sonic: 'SON',
    psychic: 'PSI',
    necrotic: 'NEC',
    poison: 'VEN',
    aetherMagic: 'AET',
  };
  return labels[damageType] || '—';
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  const calculateArmorClassFromArmor = (actor, armorSystem, isBroken = false) => {
    const agility = Number(actor.system?.abilities?.agil?.value) || 0;
    const caBase = isBroken
      ? Number(armorSystem?.caBroken) || 0
      : Number(armorSystem?.ca) || 0;
    const agilityCap = isBroken
      ? Number(armorSystem?.maxAgilityBroken) || 0
      : Number(armorSystem?.maxAgility) || 0;
    return caBase + Math.min(agility, agilityCap);
  };

  const calculateArmorClassFromEquippedArmors = (actor) => {
    const equippedArmors = actor.items.filter((i) => i.type === 'armor' && i.system?.equipped);
    const mainArmor = equippedArmors.find((i) => !['escudo', 'extra'].includes(i.system?.category));
    const shield = equippedArmors.find((i) => i.system?.category === 'escudo');
    const extraBonuses = equippedArmors
      .filter((i) => i.system?.category === 'extra' && !i.system?.broken)
      .reduce((sum, i) => sum + (Number(i.system?.bonus) || 0), 0);

    const agility = Number(actor.system?.abilities?.agil?.value) || 0;
    let armorClass = mainArmor
      ? calculateArmorClassFromArmor(actor, mainArmor.system, Boolean(mainArmor.system?.broken))
      : 10 + agility;

    if (shield && !shield.system?.broken) {
      armorClass += Number(shield.system?.bonus) || 0;
    }

    armorClass += extraBonuses;

    return armorClass;
  };

  const syncNpcArmorClass = async (actor) => {
    if (!actor || !['npc', 'character'].includes(actor.type)) return;
    const armorClass = calculateArmorClassFromEquippedArmors(actor);
    if (Number(actor.system?.attributes?.armorClass?.value) === armorClass) return;
    await actor.update({ 'system.attributes.armorClass.value': armorClass });
  };

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));

  // Mantiene sincronizada la CA del NPC al editar/cerrar una armadura equipada.
  Hooks.on('updateItem', async (item) => {
    if (item.type !== 'armor') return;

    const actor = item.parent;
    await syncNpcArmorClass(actor);
  });

  // Si cambia Agilidad del NPC, la CA se recalcula automaticamente.
  Hooks.on('updateActor', async (actor, changedData) => {
    if (!actor || !['npc', 'character'].includes(actor.type)) return;
    const agilChanged = foundry.utils.hasProperty(changedData, 'system.abilities.agil.value');
    if (!agilChanged) return;
    await syncNpcArmorClass(actor);
  });

  // Intercept initiative rolls from Combat Encounter to ask for confirmation.
  if (!Combat.prototype._tirduinInitiativePatched) {
    const originalRollInitiative = Combat.prototype.rollInitiative;
    Combat.prototype.rollInitiative = async function (ids, options = {}) {
      if (options?.tirduinSkipPrompt) {
        return originalRollInitiative.call(this, ids, options);
      }

      const idList = typeof ids === 'string' ? [ids] : Array.from(ids || []);
      if (!idList.length) return originalRollInitiative.call(this, ids, options);

      const firstCombatant = this.combatants.get(idList[0]);
      const actor = firstCombatant?.actor || null;
      const rollData = actor?.getRollData?.() || {};
      const baseFormula = options?.formula || CONFIG.Combat?.initiative?.formula || '1d20 + @abilities.agil.mod';

      const selection = await promptInitiativeConfirmation({ formula: baseFormula, rollData });
      if (!selection) return this;

      const edgeMode = selection.edgeMode || 'none';
      const bonus = Number(selection.bonus) || 0;
      let formula = applyRollEdgeToFormula(baseFormula, edgeMode);
      if (bonus !== 0) formula = `(${formula}) + (${bonus})`;

      return originalRollInitiative.call(this, ids, {
        ...options,
        formula,
        tirduinSkipPrompt: true,
      });
    };

    Combat.prototype._tirduinInitiativePatched = true;
  }

  // Botones de tirada embebidos en resúmenes de chat ([formula]).
  Hooks.on('renderChatMessage', (_message, html) => {
    html.on('click', '.tirduin-summary-roll', async (event) => {
      event.preventDefault();

      const button = event.currentTarget;
      const formula = String(button.dataset.rollFormula || '').trim();
      if (!formula) return;
      const rollLabel = String(button.dataset.rollLabel || formula).trim();
      const rollDamage = String(button.dataset.rollDamage || '').trim();

      const actorId = String(button.dataset.actorId || '').trim();
      const actor = actorId ? game.actors?.get(actorId) : null;
      const rollData = actor?.getRollData?.() || {};

      let roll;
      try {
        roll = new Roll(formula, rollData);
        await roll.evaluate();
      } catch (_error) {
        ui.notifications?.warn(game.i18n.localize('TIRDUIN_RPS.Chat.InvalidFormula'));
        return;
      }

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker(actor ? { actor } : {}),
        flavor: rollDamage
          ? game.i18n.format('TIRDUIN_RPS.Chat.InlineRollFlavorWithDamage', {
              formula: rollLabel,
              damage: rollDamage,
            })
          : game.i18n.format('TIRDUIN_RPS.Chat.InlineRollFlavor', { formula: rollLabel }),
      }, {
        rollMode: game.settings.get('core', 'rollMode'),
      });
    });
  });
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.tirduin.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'tirduin.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}
