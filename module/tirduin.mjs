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
  applyChatRollMode,
  buildWeaponAttackDamageFlavorHtml,
  getNaturalD20Result,
  getRollEdgeFlavorSuffix,
} from './helpers/roll-dialog.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';
/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  // Foundry exposes a compatibility warning mode; set it to SILENT so
  // deprecation warnings from V1 Application APIs do not spam the console.
  try {
    const compatibilityMode = CONST?.COMPATIBILITY_MODES?.SILENT;
    if (compatibilityMode !== undefined) {
      if (CONFIG?.compatibility) CONFIG.compatibility.mode = compatibilityMode;
      if (Object.prototype.hasOwnProperty.call(CONFIG || {}, 'compatibilityMode')) {
        CONFIG.compatibilityMode = compatibilityMode;
      }
    }
  } catch (_error) {
    // Ignore if compatibility mode API differs across core versions.
  }

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
    formula: '1d20 + @abilities.agil.mod + @abilities.inst.mod',
    decimals: 2,
  };

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = TirduinRPSActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    character: models.TirduinRPSCharacter,
    npc: models.TirduinRPSNPC,
    loot: models.TirduinRPSLoot,
  }
  CONFIG.Actor.types = Object.keys(CONFIG.Actor.dataModels);
  CONFIG.Item.documentClass = TirduinRPSItem;
  CONFIG.Item.dataModels = {
    item: models.TirduinRPSItem,
    feature: models.TirduinRPSFeature,
    spell: models.TirduinRPSSpell,
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
  const ActorSheetBase = foundry.appv1?.sheets?.ActorSheet || ActorSheet;
  const ItemSheetBase = foundry.appv1?.sheets?.ItemSheet || ItemSheet;
  const ActorSheets = foundry.documents?.collections?.Actors || Actors;
  const ItemSheets = foundry.documents?.collections?.Items || Items;

  ActorSheets.unregisterSheet('core', ActorSheetBase);
  ActorSheets.registerSheet('tirduin', TirduinRPSActorSheet, {
    makeDefault: true,
    label: 'TIRDUIN_RPS.SheetLabels.Actor',
  });
  ItemSheets.unregisterSheet('core', ItemSheetBase);
  ItemSheets.registerSheet('tirduin', TirduinRPSItemSheet, {
    makeDefault: true,
    label: 'TIRDUIN_RPS.SheetLabels.Item',
  });

  // Suprime el error benigno de Foundry v14 donde el marcador de fase AE
  // (#prepareDataCycle, campo privado inaccesible) no se resetea entre el
  // update optimista local y la confirmación del servidor, ambos disparando
  // prepareData sobre el mismo objeto Actor en la misma macro-tarea.
  if (typeof Hooks.onError === 'function') {
    const _originalHooksOnError = Hooks.onError.bind(Hooks);
    Hooks.onError = function tirduinOnError(location, err, options) {
      const message = String(err?.message || '');
      if (
        message.includes('ActiveEffect application phase') &&
        message.includes('already completed')
      ) {
        // Error conocido y benigno: Foundry v14 intenta aplicar una fase AE
        // que ya se completó en el ciclo optimista previo. Los efectos se
        // aplicaron correctamente en el primer ciclo; el actor funciona bien.
        return;
      }

      if (message.includes("Cannot set properties of undefined (setting 'initial')")) {
        // Error observado en actores sintéticos al aplicar Active Effects en
        // v14 durante inicialización de escena. Se maneja de forma defensiva
        // en la subclase de Actor para evitar cortar el ciclo de preparación.
        return;
      }

      return _originalHooksOnError(location, err, options);
    };
  }

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

// New actors default token options in Token Configuration.
Hooks.on('preCreateActor', (actor, data) => {
  if (!['character', 'npc'].includes(actor.type)) return;

  const explicitActorLink = foundry.utils.hasProperty(data, 'prototypeToken.actorLink');
  const explicitVision = foundry.utils.hasProperty(data, 'prototypeToken.sight.enabled')
    || foundry.utils.hasProperty(data, 'prototypeToken.vision');

  // Keep previous behavior for character linked tokens and add default token vision.
  const shouldSetActorLink = actor.type === 'character' && !explicitActorLink;
  const shouldSetVision = !explicitVision;
  if (!shouldSetActorLink && !shouldSetVision) return;

  const currentPrototype = actor.prototypeToken?.toObject?.() || {};
  const update = {
    ...currentPrototype,
  };

  if (shouldSetActorLink) {
    update.actorLink = true;
  }

  if (shouldSetVision) {
    update.sight = {
      ...(currentPrototype.sight || {}),
      enabled: true,
    };
    // Legacy field compatibility used by some modules/UI.
    update.vision = true;
  }

  actor.updateSource({
    prototypeToken: update,
  });
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
    slashing: 'COR',
    piercing: 'PER',
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

Handlebars.registerHelper('armorResistanceSummary', function (armorSystem) {
  const damageTypeAbbr = Handlebars.helpers?.damageTypeAbbr;
  const parts = [];

  const appendResistance = (resistance, enabled = true) => {
    if (!enabled) return;
    const value = Number(resistance?.value) || 0;
    const damageType = String(resistance?.damageType || '').trim();
    if (value <= 0 || !damageType) return;

    const abbr = typeof damageTypeAbbr === 'function'
      ? String(damageTypeAbbr(damageType))
      : '—';
    parts.push(`${value}${abbr}`);
  };

  appendResistance(armorSystem?.resistance, true);
  appendResistance(armorSystem?.resistance2, Boolean(armorSystem?.resistance2?.enabled));
  appendResistance(armorSystem?.resistance3, Boolean(armorSystem?.resistance3?.enabled));
  appendResistance(armorSystem?.resistance4, Boolean(armorSystem?.resistance4?.enabled));

  return parts.join(' ');
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {

  // Force Foundry core Grid Diagonals setting to Alternative (1/2/1).
  if (game.user?.isGM) {
    const diagonalModes = CONST?.GRID_DIAGONALS || {};
    const modeEntry = Object.entries(diagonalModes).find(([key]) => {
      const normalized = String(key).toUpperCase();
      return normalized.includes('ALTERNATE') || normalized.includes('ALTERNATING') || normalized.includes('ALT');
    });
    const alternateMode = modeEntry?.[1];

    if (alternateMode !== undefined) {
      try {
        const current = game.settings.get('core', 'gridDiagonals');
        if (current !== alternateMode) {
          game.settings.set('core', 'gridDiagonals', alternateMode).catch(() => {});
        }
      } catch (_error) {
        // Ignore if the core setting key changes across versions.
      }
    }
  }

  const tokenSizeByActorSize = {
    diminuto: 0.5,
    pequeno: 0.75,
    mediano: 1,
    grande: 2,
    enorme: 3,
    gargantuesco: 4,
  };

  const getTokenSizeUnits = (actor) => {
    const sizeKey = String(actor?.system?.details?.size || 'mediano');
    return tokenSizeByActorSize[sizeKey] ?? 1;
  };

  const syncActorTokenSize = async (actor) => {
    if (!actor || !['npc', 'character'].includes(actor.type)) return;

    const tokenUnits = getTokenSizeUnits(actor);

    const prototypeWidth = Number(actor.prototypeToken?.width) || 1;
    const prototypeHeight = Number(actor.prototypeToken?.height) || 1;
    if (prototypeWidth !== tokenUnits || prototypeHeight !== tokenUnits) {
      await actor.update({
        'prototypeToken.width': tokenUnits,
        'prototypeToken.height': tokenUnits,
      });
    }

    const activeTokens = actor.getActiveTokens(true) || [];
    const tokenUpdates = [];
    for (const token of activeTokens) {
      const tokenWidth = Number(token.document?.width) || 1;
      const tokenHeight = Number(token.document?.height) || 1;
      if (tokenWidth === tokenUnits && tokenHeight === tokenUnits) continue;
      tokenUpdates.push(token.document.update({ width: tokenUnits, height: tokenUnits }));
    }

    if (tokenUpdates.length) await Promise.all(tokenUpdates);
  };

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
    await actor.update(
      { 'system.attributes.armorClass.value': armorClass },
      { tirduinSkipArmorSync: true }
    );
  };

  const pendingArmorSyncs = new Map();
  const scheduleArmorClassSync = (actor) => {
    if (!actor?.id) return;

    const existingTimeout = pendingArmorSyncs.get(actor.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Ejecuta fuera del ciclo actual para evitar updates anidados durante prepareData.
    const timeoutId = setTimeout(async () => {
      pendingArmorSyncs.delete(actor.id);
      try {
        await syncNpcArmorClass(actor);
      } catch (_error) {
        // Ignora errores de sincronización para no romper updates del actor.
      }
    }, 0);

    pendingArmorSyncs.set(actor.id, timeoutId);
  };

  /* -------------------------------------------- */
  /*  Loot Drag & Drop Helpers                    */
  /* -------------------------------------------- */

  const getTokenAtPoint = (x, y) => {
    // Resolve topmost token hit under the drop point in canvas pixels.
    const tokens = canvas?.tokens?.placeables || [];
    const gridSize = Number(canvas?.grid?.size) || 100;

    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const token = tokens[i];
      const doc = token?.document;
      if (!doc) continue;

      const left = Number(doc.x) || 0;
      const top = Number(doc.y) || 0;
      const width = (Number(doc.width) || 1) * gridSize;
      const height = (Number(doc.height) || 1) * gridSize;
      const inside = x >= left && x < (left + width) && y >= top && y < (top + height);
      if (inside) return token;
    }

    return null;
  };

  const getSnappedCanvasPoint = (x, y) => {
    // Grid snapping API changed between core versions, so keep a compatibility chain.
    if (canvas?.grid?.getSnappedPoint) {
      try {
        return canvas.grid.getSnappedPoint(
          { x, y },
          { mode: CONST.GRID_SNAPPING_MODES.CENTER }
        );
      } catch (_error) {
        // Fallback for API differences across core versions.
      }
    }
    if (canvas?.grid?.getSnappedPosition) {
      try {
        const snapped = canvas.grid.getSnappedPosition(x, y, 1);
        return { x: snapped?.x ?? x, y: snapped?.y ?? y };
      } catch (_error) {
        // Ignore and return raw point below.
      }
    }
    return { x, y };
  };

  const copyDroppedItemToActor = async (actor, item) => {
    if (!actor || !item) return false;

    // Create a detached clone so drops never mutate source compendium/world items.
    const itemData = foundry.utils.deepClone(item.toObject());
    delete itemData._id;
    await actor.createEmbeddedDocuments('Item', [itemData]);
    return true;
  };

  const isLootActor = (actor) => {
    if (!actor) return false;
    if (actor.type === 'loot') return true;
    if (Boolean(actor.getFlag?.('tirduin', 'lootContainer'))) return true;
    return String(actor.name || '').toLowerCase().startsWith('botin:');
  };

  const getLootOwnershipLevel = () => {
    return Number(CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER)
      || Number(CONST?.ENTITY_PERMISSIONS?.OWNER)
      || 3;
  };

  const getNeutralDisposition = () => {
    return Number(CONST?.TOKEN_DISPOSITIONS?.NEUTRAL) || 0;
  };

  const ensureLootActorAccess = async (actor) => {
    if (!game.user?.isGM || !isLootActor(actor)) return;

    const ownerLevel = getLootOwnershipLevel();
    const currentDefault = Number(actor?.ownership?.default);
    if (currentDefault === ownerLevel) return;

    await actor.update({
      ownership: {
        ...(actor.ownership || {}),
        default: ownerLevel,
      },
    });
  };

  const findNearbyLootToken = (x, y) => {
    // Merge drops into an existing nearby loot container before creating new tokens.
    const tokens = canvas?.tokens?.placeables || [];
    const gridSize = Number(canvas?.grid?.size) || 100;
    const searchRadius = gridSize * 3;

    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const token of tokens) {
      const actor = token?.actor;
      if (!isLootActor(actor)) continue;

      const tokenDoc = token.document;
      const tokenCenterX = (Number(tokenDoc?.x) || 0) + ((Number(tokenDoc?.width) || 1) * gridSize) / 2;
      const tokenCenterY = (Number(tokenDoc?.y) || 0) + ((Number(tokenDoc?.height) || 1) * gridSize) / 2;
      const dx = tokenCenterX - x;
      const dy = tokenCenterY - y;
      const distance = Math.hypot(dx, dy);

      if (distance > searchRadius || distance >= nearestDistance) continue;
      nearest = token;
      nearestDistance = distance;
    }

    return nearest;
  };

  const createLootTokenWithItem = async (dropData, item) => {
    if (!canvas?.scene) return false;

    // Loot containers are NPC actors flagged as loot to keep data-model compatibility.
    const lootName = game.i18n.format('TIRDUIN_RPS.Loot.Prefix', { name: item.name });
    const lootImg = item.img || 'icons/svg/chest.svg';
    const lootActor = await Actor.create({
      name: lootName,
      type: 'npc',
      img: lootImg,
      ownership: {
        default: getLootOwnershipLevel(),
      },
      flags: {
        tirduin: {
          lootContainer: true,
        },
      },
      prototypeToken: {
        actorLink: true,
        name: lootName,
        img: lootImg,
        disposition: getNeutralDisposition(),
        vision: false,
      },
    });

    const itemData = foundry.utils.deepClone(item.toObject());
    delete itemData._id;
    await lootActor.createEmbeddedDocuments('Item', [itemData]);

    const snapped = getSnappedCanvasPoint(Number(dropData.x) || 0, Number(dropData.y) || 0);
    const tokenDocument = await lootActor.getTokenDocument({
      name: lootName,
      actorLink: false,
      disposition: getNeutralDisposition(),
      x: snapped.x,
      y: snapped.y,
      width: 1,
      height: 1,
    });
    await tokenDocument.constructor.create(tokenDocument.toObject(), { parent: canvas.scene });

    return true;
  };

  // Ensure existing loot containers are accessible to all players.
  if (game.user?.isGM) {
    for (const actor of game.actors ?? []) {
      if (!isLootActor(actor)) continue;
      ensureLootActorAccess(actor).catch(() => {});
    }
  }

  // Players can open loot from tokens, but loot actors stay hidden in Actor Directory.
  const hideLootActorsFromDirectory = (html) => {
    // Ensure html is jQuery-wrapped for v14+ compatibility
    const jqueryHtml = html instanceof jQuery ? html : $(html);
    const entries = jqueryHtml.find('.directory-item.document.actor, .directory-item.actor, li.directory-item');
    for (const element of entries) {
      const actorId = element?.dataset?.documentId
        || element?.dataset?.entryId
        || element?.dataset?.actorId
        || String(element?.dataset?.uuid || '').split('.').pop();
      if (!actorId) continue;

      const actor = game.actors?.get(actorId);
      if (!isLootActor(actor)) continue;
      element.remove();
    }
  };

  Hooks.on('renderActorDirectory', (_app, html) => {
    if (game.user?.isGM) return;
    hideLootActorsFromDirectory(html);
  });

  if (!game.user?.isGM && ui?.actors?.element) {
    hideLootActorsFromDirectory(ui.actors.element);
  }

  // Players should open loot containers directly from token double-click on canvas.
  Hooks.on('clickToken2', (token) => {
    if (!token?.actor || !isLootActor(token.actor)) return;

    const ownerLevel = getLootOwnershipLevel();
    const hasAccess = token.actor.testUserPermission?.(game.user, ownerLevel)
      || token.actor.isOwner;
    if (!hasAccess) return;

    token.actor.sheet?.render(true);
    return false;
  });

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => {
    if (data?.type !== 'Item') return true;
    createItemMacro(data, slot);
    return false;
  });

  // Flujo principal de drop en canvas:
  // 1) Si cae sobre token, se copia al inventario de ese actor.
  // 2) Si cae en vacio, intenta apilar en botin cercano.
  // 3) Si no existe botin cercano, crea uno nuevo en el mapa.
  Hooks.on('dropCanvasData', async (_canvas, data) => {
    if (data?.type !== 'Item') return true;

    let item;
    try {
      item = await Item.fromDropData(data);
    } catch (_error) {
      ui.notifications?.warn(game.i18n.localize('TIRDUIN_RPS.Loot.DropReadError'));
      return false;
    }
    if (!item) return false;

    const token = getTokenAtPoint(Number(data.x) || 0, Number(data.y) || 0);
    if (token?.actor) {
      try {
        // Direct drop over token: push item into that actor inventory.
        await copyDroppedItemToActor(token.actor, item);
        ui.notifications?.info(game.i18n.format('TIRDUIN_RPS.Loot.AddToActor', {
          item: item.name,
          actor: token.actor.name,
        }));
      } catch (_error) {
        ui.notifications?.warn(game.i18n.localize('TIRDUIN_RPS.Loot.AddToActorError'));
      }
      return false;
    }

    try {
      const nearbyLoot = findNearbyLootToken(Number(data.x) || 0, Number(data.y) || 0);
      if (nearbyLoot?.actor) {
        // Empty-ground drop with nearby loot: stack into nearest container.
        await copyDroppedItemToActor(nearbyLoot.actor, item);
        ui.notifications?.info(game.i18n.format('TIRDUIN_RPS.Loot.AddToNearby', {
          item: item.name,
          actor: nearbyLoot.actor.name,
        }));
        return false;
      }

      const created = await createLootTokenWithItem(data, item);
      if (created) {
        ui.notifications?.info(game.i18n.format('TIRDUIN_RPS.Loot.CreatedOnMap', {
          item: item.name,
        }));
      }
    } catch (_error) {
      console.error('Tirduin | Error creando botin en mapa', _error);
      const detail = String(_error?.message || _error || '').trim();
      ui.notifications?.warn(game.i18n.format('TIRDUIN_RPS.Loot.CreateFailed', {
        detail: detail ? ` ${detail}` : '',
      }));
    }

    return false;
  });

  // Mantiene sincronizada la CA del NPC al editar/cerrar una armadura equipada.
  Hooks.on('updateItem', async (item) => {
    if (item.type !== 'armor') return;

    const actor = item.parent;
    scheduleArmorClassSync(actor);
  });

  // Si cambia Agilidad del NPC, la CA se recalcula automaticamente.
  Hooks.on('updateActor', async (actor, changedData, options) => {
    if (!actor || !['npc', 'character'].includes(actor.type)) return;
    if (options?.tirduinSkipArmorSync) return;

    // Compara con valor numérico para evitar falsos positivos por coerción de
    // tipo string→number que el FormApplication de Foundry v1 introduce al
    // enviar todos los campos del formulario con cada cambio.
    const newAgilRaw = foundry.utils.getProperty(changedData, 'system.abilities.agil.value');
    const agilChanged = newAgilRaw !== undefined
      && Number(newAgilRaw) !== Number(actor._source?.system?.abilities?.agil?.value);
    if (agilChanged) {
      scheduleArmorClassSync(actor);
    }

    const sizeChanged = foundry.utils.hasProperty(changedData, 'system.details.size');
    if (sizeChanged) {
      // Igual que con CA: guard para no encadenar ciclos de preparación.
      await syncActorTokenSize(actor);
    }
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
      const baseFormula = options?.formula || CONFIG.Combat?.initiative?.formula || '1d20 + @abilities.agil.mod + @abilities.inst.mod';

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
  const handleInlineSummaryRollClick = async (event) => {
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

      let messageMode = 'public';
      try {
        messageMode = game.settings.get('core', 'messageMode') || 'public';
      } catch (_error) {
        try {
          messageMode = game.settings.get('core', 'rollMode') || 'public';
        } catch (_err2) {
          messageMode = 'public';
        }
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
        rollMode: messageMode,
      });
  };

  Hooks.on('renderChatMessageHTML', (_message, element) => {
    element.querySelectorAll('.tirduin-summary-roll').forEach((button) => {
      button.addEventListener('click', handleInlineSummaryRollClick);
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

function promptWeaponRollOptions({ weaponName, damageDie, damageDie2 = '', proficiency, actorRollData }) {
  return new Promise((resolve) => {
    let settled = false;

    const safeResolve = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const damageTypeOptions = Object.entries(CONFIG.TIRDUIN_RPS?.damageTypes || {})
      .map(([key, i18nKey]) => `<option value="${key}">${game.i18n.localize(i18nKey)}</option>`)
      .join('');
    let customSelectDocNamespace = '';
    const attributeLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Weapon.Attribute');
    const vigorLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Weapon.AbilityVigor');
    const agilityLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Weapon.AbilityAgility');
    const proficiencyLabel = game.i18n.format('TIRDUIN_RPS.RollDialog.Weapon.Proficiency', { value: proficiency });
    const attackBonusLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Weapon.AttackBonus');
    const attackBonusTitle = game.i18n.localize('TIRDUIN_RPS.RollDialog.Weapon.AttackBonusTitle');
    const addExtraDamageTitle = game.i18n.localize('TIRDUIN_RPS.RollDialog.Weapon.AddExtraDamageTitle');
    const extraDamagePlaceholder = game.i18n.localize('TIRDUIN_RPS.RollDialog.Weapon.ExtraDamagePlaceholder');
    const noTypeLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Weapon.NoType');
    const removeLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Weapon.Remove');
    const rollLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Common.Roll');
    const cancelLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Common.Cancel');
    const advantageLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Common.Advantage');
    const disadvantageLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Common.Disadvantage');
    const selectLabel = game.i18n.localize('TIRDUIN_RPS.RollDialog.Common.Select');

    const content = `
      <form class="tirduin-roll-confirmation tirduin-weapon-roll-confirmation">
        <div class="roll-summary">
          <div class="weapon-roll-topline">
            <span>${attributeLabel}</span>
            <select name="tirduin-weapon-ability">
              <option value="vig">${vigorLabel}</option>
              <option value="agil">${agilityLabel}</option>
            </select>
            <span class="weapon-roll-prof">${proficiencyLabel}</span>
          </div>

          <div class="weapon-roll-line">
            <p class="weapon-roll-preview" data-role="weapon-attack-preview"></p>
            <button type="button" class="weapon-roll-line-add" data-role="attack-bonus-toggle" title="${attackBonusTitle}">+</button>
          </div>
          <div class="weapon-roll-inline-fields" data-role="attack-bonus-fields" style="display:none;">
            <label>
              ${attackBonusLabel}
              <input type="number" name="tirduin-attack-bonus" value="0" step="1">
            </label>
          </div>

          <div class="weapon-roll-line">
            <p class="weapon-roll-preview" data-role="weapon-damage-preview"></p>
            <button type="button" class="weapon-roll-line-add" data-role="damage-bonus-add" title="${addExtraDamageTitle}">+</button>
          </div>
          <p class="weapon-roll-preview" data-role="weapon-damage2-preview"></p>

          <div class="weapon-roll-damage-bonuses" data-role="damage-bonuses"></div>
          <div class="weapon-roll-extra-previews" data-role="weapon-damage-extra-previews"></div>
        </div>

        <div class="roll-edge-row">
          <label class="roll-edge-option">
            <input type="radio" name="tirduin-roll-edge" value="advantage">
            ${advantageLabel}
          </label>
          <label class="roll-edge-option">
            <input type="radio" name="tirduin-roll-edge" value="disadvantage">
            ${disadvantageLabel}
          </label>
        </div>
      </form>
    `;

    new Dialog({
      title: game.i18n.format('TIRDUIN_RPS.RollDialog.Weapon.Title', { weaponName }),
      content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: rollLabel,
          callback: (html) => {
            const abilityKey = html.find('select[name="tirduin-weapon-ability"]').val() || 'vig';
            const edgeMode = html.find('input[name="tirduin-roll-edge"]:checked').val() || 'none';
            const attackBonusEnabled = html.find('[data-role="attack-bonus-fields"]').is(':visible');
            const attackBonus = attackBonusEnabled
              ? (Number(html.find('input[name="tirduin-attack-bonus"]').val()) || 0)
              : 0;

            const extraDamageEntries = [];
            html.find('.weapon-roll-damage-bonus-row').each((_index, element) => {
              const row = $(element);
              const formula = String(row.find('input[name="tirduin-extra-damage"]')?.val() || '').trim();
              const damageTypeKey = String(row.find('select[name="tirduin-extra-damage-type"]')?.val() || '').trim();
              if (!formula) return;
              extraDamageEntries.push({ formula, damageTypeKey });
            });

            safeResolve({ abilityKey, edgeMode, attackBonus, extraDamageEntries });
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: cancelLabel,
          callback: () => safeResolve(null),
        },
      },
      default: 'roll',
      classes: ['tirduin', 'tirduin-roll-dialog'],
      render: (html) => {
        customSelectDocNamespace = `.tirduinWeaponSelect-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        const closeAllCustomSelects = () => {
          html.find('.tirduin-custom-select.is-open').removeClass('is-open');
        };

        const initializeCustomSelects = (scope) => {
          scope.find('select').each((_index, element) => {
            const select = $(element);
            if (select.data('tirduinCustomSelectReady')) return;
            select.data('tirduinCustomSelectReady', true);

            const wrapper = $('<div class="tirduin-custom-select"></div>');
            select.addClass('tirduin-native-select').wrap(wrapper);

            const host = select.parent();
            const trigger = $('<button type="button" class="tirduin-custom-select-trigger"></button>');
            const menu = $('<div class="tirduin-custom-select-menu"></div>');

            const syncFromSelect = () => {
              const selectedValue = String(select.val() ?? '');
              const selectedOption = select.find('option:selected').first();
              const label = String(selectedOption.text() || '').trim();
              trigger.text(label || selectLabel);

              menu.find('.tirduin-custom-select-option').each((_i, optionButton) => {
                const btn = $(optionButton);
                btn.toggleClass('is-selected', String(btn.data('value') ?? '') === selectedValue);
              });
            };

            select.find('option').each((_optIndex, optionEl) => {
              const option = $(optionEl);
              const value = String(option.attr('value') || '');
              const optionButton = $('<button type="button" class="tirduin-custom-select-option"></button>');
              optionButton.text(String(option.text() || '').trim());
              optionButton.attr('data-value', value);

              if (option.prop('disabled')) {
                optionButton.prop('disabled', true);
              }

              menu.append(optionButton);
            });

            host.append(trigger, menu);
            syncFromSelect();

            trigger.on('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              const willOpen = !host.hasClass('is-open');
              closeAllCustomSelects();
              if (willOpen) host.addClass('is-open');
            });

            menu.on('click', '.tirduin-custom-select-option', (event) => {
              event.preventDefault();
              event.stopPropagation();
              const button = $(event.currentTarget);
              const value = String(button.data('value') || '');
              select.val(value).trigger('change');
              syncFromSelect();
              closeAllCustomSelects();
            });

            select.on('change', () => syncFromSelect());
            select.on('blur', () => closeAllCustomSelects());
          });
        };

        const updatePreviews = () => {
          const abilityKey = String(html.find('select[name="tirduin-weapon-ability"]').val() || 'vig');
          const attackBonus = Number(html.find('input[name="tirduin-attack-bonus"]').val()) || 0;
          const extraDamageEntries = [];
          html.find('.weapon-roll-damage-bonus-row').each((_index, element) => {
            const row = $(element);
            const formula = String(row.find('input[name="tirduin-extra-damage"]')?.val() || '').trim();
            const damageTypeKey = String(row.find('select[name="tirduin-extra-damage-type"]')?.val() || '').trim();
            if (!formula) return;
            extraDamageEntries.push({ formula, damageTypeKey });
          });

          const abilityValue = Number(actorRollData?.abilities?.[abilityKey]?.value) || 0;
          const attackFormula = applyRollEdgeToFormula(`1d20 + (${abilityValue}) + (${proficiency}) + (${attackBonus})`, html.find('input[name="tirduin-roll-edge"]:checked').val() || 'none');
          const damageFormula = `${damageDie} + (${abilityValue})`;
          const damageFormula2 = damageDie2 || '';

          const attackPreview = html.find('[data-role="weapon-attack-preview"]');
          const damagePreview = html.find('[data-role="weapon-damage-preview"]');
          const damagePreview2 = html.find('[data-role="weapon-damage2-preview"]');
          const extraPreviews = html.find('[data-role="weapon-damage-extra-previews"]');

          attackPreview.text(game.i18n.format('TIRDUIN_RPS.RollDialog.Weapon.AttackPreview', { formula: attackFormula }));
          damagePreview.text(game.i18n.format('TIRDUIN_RPS.RollDialog.Weapon.DamagePreview', { formula: damageFormula }));
          if (damageFormula2) {
            damagePreview2.text(game.i18n.format('TIRDUIN_RPS.RollDialog.Weapon.DamagePreview2', { formula: damageFormula2 }));
          } else {
            damagePreview2.text('');
          }

          extraPreviews.empty();
          for (const entry of extraDamageEntries) {
            const formula = entry.formula;
            const typeKey = entry.damageTypeKey;
            const typeLabel = typeKey ? ` (${game.i18n.localize(CONFIG.TIRDUIN_RPS.damageTypes[typeKey] || typeKey)})` : '';
            const previewText = game.i18n.format('TIRDUIN_RPS.RollDialog.Weapon.ExtraDamagePreview', { type: typeLabel, formula });
            extraPreviews.append(`<p class="weapon-roll-preview">${previewText}</p>`);
          }
        };

        const abilitySelect = html.find('select[name="tirduin-weapon-ability"]');
        const edgeRadios = html.find('input[name="tirduin-roll-edge"]');
        const attackBonusToggle = html.find('[data-role="attack-bonus-toggle"]');
        const attackBonusFields = html.find('[data-role="attack-bonus-fields"]');
        const attackBonusInput = html.find('input[name="tirduin-attack-bonus"]');
        const addDamageBonusButton = html.find('[data-role="damage-bonus-add"]');
        const damageBonusesContainer = html.find('[data-role="damage-bonuses"]');

        attackBonusToggle.on('click', () => {
          const willShow = attackBonusFields.css('display') === 'none';
          attackBonusFields.css('display', willShow ? 'grid' : 'none');
          if (!willShow) {
            attackBonusInput.val(0);
          }
          updatePreviews();
        });

        abilitySelect.on('change', updatePreviews);
        edgeRadios.on('click', (event) => {
          const target = event.currentTarget;
          const wasChecked = target.dataset.wasChecked === 'true';
          edgeRadios.each((_i, radio) => {
            radio.dataset.wasChecked = 'false';
          });
          if (wasChecked) {
            target.checked = false;
          } else {
            target.checked = true;
            target.dataset.wasChecked = 'true';
          }
          updatePreviews();
        });
        attackBonusInput.on('input change', updatePreviews);

        addDamageBonusButton.on('click', (event) => {
          event.preventDefault();
          const row = $(
            `<div class="weapon-roll-damage-bonus-row">
              <input type="text" name="tirduin-extra-damage" placeholder="${extraDamagePlaceholder}">
              <select name="tirduin-extra-damage-type">
                <option value="">${noTypeLabel}</option>
                ${damageTypeOptions}
              </select>
              <button type="button" class="weapon-roll-damage-bonus-remove" title="${removeLabel}">−</button>
            </div>`
          );
          damageBonusesContainer.append(row);
          initializeCustomSelects(row);
          updatePreviews();
        });

        damageBonusesContainer.on('input change', 'input, select', updatePreviews);
        damageBonusesContainer.on('click', '.weapon-roll-damage-bonus-remove', (event) => {
          event.preventDefault();
          $(event.currentTarget).closest('.weapon-roll-damage-bonus-row').remove();
          updatePreviews();
        });

        html.on('click', '.tirduin-custom-select', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });

        initializeCustomSelects(html);
        updatePreviews();

        $(document).on(`click${customSelectDocNamespace}`, (event) => {
          if (!$(event.target).closest('.tirduin-custom-select').length) {
            closeAllCustomSelects();
          }
        });
      },
      close: () => safeResolve(null),
    }).render(true);
  });
}

async function rollItemMacro(itemUuid) {
  const dropData = {
    type: 'Item',
    uuid: itemUuid,
  };

  const item = await Item.fromDropData(dropData);
  if (!item || !item.parent) {
    const itemName = item?.name ?? itemUuid;
    return ui.notifications.warn(
      `Could not find item ${itemName}. You may need to delete and recreate this macro.`
    );
  }

  if (item.type !== 'weapon') {
    return item.roll();
  }

  const damageDie = String(item.system?.damageDie || '').trim();
  if (!damageDie) {
    return ui.notifications.warn(game.i18n.format('TIRDUIN_RPS.Roll.Warning.WeaponNoDamageDie', { item: item.name }));
  }

  const damageDie2 = String(item.system?.damageDie2 || '').trim();
  const damageTypeKey = String(item.system?.damageType || '').trim();
  const damageTypeKey2 = String(item.system?.damageType2 || '').trim();
  const isRangedWeapon = String(item.system?.subcategory || '') === 'distancia';
  const currentProjectiles = Math.max(0, Number(item.system?.projectiles) || 0);

  if (isRangedWeapon && currentProjectiles <= 0) {
    return ui.notifications.warn(game.i18n.format('TIRDUIN_RPS.Roll.Warning.WeaponNoProjectiles', { item: item.name }));
  }

  const proficiency = Number(item.system?.proficiency) || 0;
  const actorRollData = item.actor?.getRollData() || {};
  const selection = await promptWeaponRollOptions({
    weaponName: item.name,
    damageDie,
    damageDie2,
    proficiency,
    actorRollData,
  });
  if (!selection) return null;

  const abilityKey = selection.abilityKey;
  const edgeMode = selection.edgeMode;
  const attackBonus = selection.attackBonus || 0;
  const extraDamageEntries = selection.extraDamageEntries || [];
  const fatigueRollPenalty = item.actor?.type === 'character'
    ? (Number(item.actor.system?.attributes?.fatigue?.rollPenalty) || 0)
    : 0;
  const abilityValue = (Number(item.actor.system?.abilities?.[abilityKey]?.value) || 0) + fatigueRollPenalty;

  const attackBaseFormula = `1d20 + (${abilityValue}) + (${proficiency}) + (${attackBonus})`;
  const attackFormula = applyRollEdgeToFormula(attackBaseFormula, edgeMode);
  const damageFormula = `${damageDie} + (${abilityValue})`;
  const damageFormula2 = damageDie2 || '';

  const attackRoll = new Roll(attackFormula, actorRollData);
  await attackRoll.evaluate();

  const isCritical = getNaturalD20Result(attackRoll) === 20;
  const duplicateDiceTermsInFormula = (formula = '') => String(formula).replace(
    /(\d*)d(\d+)/gi,
    (_match, count, faces) => `${(Number(count) || 1) * 2}d${faces}`
  );

  const resolvedDamageFormula = isCritical ? duplicateDiceTermsInFormula(damageFormula) : damageFormula;
  const resolvedDamageFormula2 = (isCritical && damageFormula2)
    ? duplicateDiceTermsInFormula(damageFormula2)
    : damageFormula2;

  const damageRoll = new Roll(resolvedDamageFormula, actorRollData);
  await damageRoll.evaluate();

  let damageRoll2 = null;
  if (resolvedDamageFormula2) {
    damageRoll2 = new Roll(resolvedDamageFormula2, actorRollData);
    await damageRoll2.evaluate();
  }

  const extraDamageRolls = [];
  for (const entry of extraDamageEntries) {
    const extraRoll = new Roll(entry.formula, actorRollData);
    await extraRoll.evaluate();
    extraDamageRolls.push({
      roll: extraRoll,
      typeLabel: entry.damageTypeKey
        ? game.i18n.localize(CONFIG.TIRDUIN_RPS.damageTypes[entry.damageTypeKey] || entry.damageTypeKey)
        : '',
    });
  }

  const targetToken = game.user?.targets?.first();
  const targetName = targetToken?.name ?? null;
  const targetAC = targetToken?.actor
    ? (Number(targetToken.actor.system?.attributes?.armorClass?.value) || null)
    : null;

  await ChatMessage.create(applyChatRollMode({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    content: buildWeaponAttackDamageFlavorHtml({
      weaponName: item.name,
      edgeText: getRollEdgeFlavorSuffix(edgeMode),
      edgeMode,
      attackRoll,
      damageRoll,
      damageTypeLabel: damageTypeKey
        ? game.i18n.localize(CONFIG.TIRDUIN_RPS.damageTypes[damageTypeKey] || damageTypeKey)
        : '',
      damageRoll2,
      damageTypeLabel2: damageTypeKey2
        ? game.i18n.localize(CONFIG.TIRDUIN_RPS.damageTypes[damageTypeKey2] || damageTypeKey2)
        : '',
      damageRollExtraEntries: extraDamageRolls,
      targetName,
      targetAC,
    }),
  }));

  if (isRangedWeapon) {
    const nextProjectiles = Math.max(0, currentProjectiles - 1);
    await item.update({ 'system.projectiles': nextProjectiles });
  }

  return { attackRoll, damageRoll, damageRoll2 };
}
