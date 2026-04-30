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
import * as rollDialog from './helpers/roll-dialog.mjs';
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
    rollWeaponAttack,
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
    extra: 'Extra',
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
          game.settings.set('core', 'gridDiagonals', alternateMode).catch(() => { });
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

    // Solo el dueño o el GM deben procesar la actualización en DB
    if (!game.user.isGM && !actor.isOwner) return;

    const tokenUnits = getTokenSizeUnits(actor);

    const prototypeWidth = Number(actor.prototypeToken?.width) || 1;
    const prototypeHeight = Number(actor.prototypeToken?.height) || 1;
    if (prototypeWidth !== tokenUnits || prototypeHeight !== tokenUnits) {
      await actor.update({
        'prototypeToken.width': tokenUnits,
        'prototypeToken.height': tokenUnits,
      }, { tirduinSync: true });
    }

    const activeTokens = actor.getActiveTokens(true) || [];
    const tokenUpdates = [];

    for (const token of activeTokens) {
      // Filtrado de permisos: evita errores en clientes sin control
      if (!game.user.isGM && !token.actor?.isOwner) continue;

      const tokenWidth = Number(token.document?.width) || 1;
      const tokenHeight = Number(token.document?.height) || 1;
      if (tokenWidth === tokenUnits && tokenHeight === tokenUnits) continue;

      tokenUpdates.push({
        _id: token.id,
        width: tokenUnits,
        height: tokenUnits
      });
    }

    // Batch update seguro
    if (tokenUpdates.length && canvas.scene) {
      await canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
    }
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

    // Solo el dueño o el GM deben procesar la actualización en DB
    if (!game.user.isGM && !actor.isOwner) return;

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
      ensureLootActorAccess(actor).catch(() => { });
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
  Hooks.on('updateActor', async (actor, changedData, options, userId) => {
    // Evita reaccionar a tu propio update si ya viene marcado
    if (options?.tirduinSync) return;

    if (!isAuthoritativeUser(actor)) return;

    // Ejecuta sync centralizado
    await runActorSync(actor, changedData);
  });

  function isAuthoritativeUser(actor) {
    // Prioridad: GM
    if (game.user.isGM) return true;

    // Fallback: propietario del actor
    if (actor?.isOwner) {
      // Opcional: evitar múltiples owners ejecutando
      const owners = game.users.filter(u =>
        u.active && actor.testUserPermission(u, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
      );
      const firstOwner = owners.sort((a, b) => a.id.localeCompare(b.id))[0];
      return game.user.id === firstOwner?.id;
    }

    return false;
  }

  async function runActorSync(actor, changedData) {
    if (!actor || !['npc', 'character'].includes(actor.type)) return;

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

  }


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
  if (data.type !== "Item") return;
  if (!data.uuid) return;
  const item = await fromUuid(data.uuid);

  const command = `game.tirduin.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find((m) => m.name === item.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "tirduin.itemMacro": true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

async function rollItemMacro(itemUuid) {
  const item = await fromUuid(itemUuid);
  if (!item) return ui.notifications.warn("No se encontró el objeto.");

  // Si es un arma, usamos el método centralizado
  if (item.type === 'weapon') {
    return rollWeaponAttack(item);
  }

  // Para otros objetos
  return item.roll();
}

/**
 * Lanza el diálogo de ataque y ejecuta la tirada.
 * Esta función es ahora el "cerebro" único para ataques, usado por fichas y macros.
 */
export async function rollWeaponAttack(item) {
  const actor = item.actor;
  if (!actor) return;

  // 1. Recopilar datos necesarios del item
  const weaponData = {
    name: item.name,
    damageDie: String(item.system?.damageDie || "").trim(),
    damageDie2: String(item.system?.damageDie2 || "").trim(),
    proficiency: Number(item.system?.proficiency) || 0,
    ability: item.system?.ability || 'vig',
    damageType: item.system?.damageType,
    damageType2: item.system?.damageType2,
  };

  // Recopilar bonificaciones de armas extra equipadas
  const armasExtraEquipadas = actor.items.filter(i =>
    i.type === 'weapon' &&
    i.system?.actionEnabled === true && // equipado y usable
    i.system?.category === 'extra'
  );

  // Extraemos los detalles de cada bonificador
  const extrasList = armasExtraEquipadas.map(i => ({
    name: i.name,
    attack: Number(i.system?.proficiencyExtra) || 0,
    damage: i.system?.damageDieExtra || '',
    damagetype: i.system?.damageTypeExtra || '',
  }));

  // 2. Abrir el diálogo (Standalone, sin depender de la sheet)
  const selection = await promptWeaponRollOptions({ actor, weapon: weaponData, extrasList });
  if (!selection) return null;

  // 3. Lógica de Tirada (Ataque y Daño)
  const { abilityKey, edgeMode, attackBonus, extraDamageEntries } = selection;
  const rollData = actor.getRollData();

  // Penalizador por fatiga (si aplica)
  const fatiguePenalty = actor.type === 'character' ? (Number(actor.system.attributes?.fatigue?.rollPenalty) || 0) : 0;
  const abilityValue = (Number(actor.system.abilities?.[weaponData.ability]?.value) || 0) + fatiguePenalty;

  // Ejecutar Ataque
  const baseFormula = `1d20 + ${abilityValue} + ${weaponData.proficiency} + ${extrasList.reduce((sum, e) => sum + e.attack, 0)}`;
  const attackFormula = rollDialog.applyRollEdgeToFormula(baseFormula, edgeMode);
  const attackRoll = new Roll(attackFormula, rollData);
  await attackRoll.evaluate();

  const isCritical = rollDialog.getNaturalD20Result(attackRoll) === 20;
  const dDice = (f) => String(f).replace(/(\d*)d(\d+)/gi, (m, c, faces) => `${(Number(c) || 1) * 2}d${faces}`);

  // Daños agrupados por tipo usando Map para mantener orden y flexibilidad
  const damageMap = new Map();

  // 1. Añadir daño base del arma
  const baseKey = weaponData.damageType;
  const baseFormulaAttack = `${weaponData.damageDie} + ${abilityValue}`;
  damageMap.set(baseKey, [baseFormulaAttack]);

  // 2. Añadir segundo daño del arma (si existe)
  if (weaponData.damageDie2) {
    const type2 = weaponData.damageType2 || baseKey;
    // IMPORTANTE: Si el tipo no existe en el mapa, lo creamos antes de hacer el push
    if (!damageMap.has(type2)) damageMap.set(type2, []);
    damageMap.get(type2).push(weaponData.damageDie2);
  }

  // 3. Agrupar daños de los extras por tipo
  for (const extra of extrasList) {

    const type = extra.damagetype || weaponData.damageType;
    const formula = extra.damage;

    if (!damageMap.has(type)) damageMap.set(type, []);
    damageMap.get(type).push(formula);
  }

  // 4. Evaluar las tiradas agrupadas (esto se mantiene igual)
  const damageRolls = [];
  for (const [type, components] of damageMap) {
    let finalFormula;

    if (isCritical) {
      const diceParts = components.filter(c => c.includes('d'));
      const flatParts = components.filter(c => !c.includes('d'));
      const doubledDice = diceParts.length > 0 ? dDice(diceParts.join(' + ')) : "";
      const flatBonus = flatParts.length > 0 ? flatParts.join(' + ') : "";
      finalFormula = [doubledDice, flatBonus].filter(Boolean).join(' + ');
    } else {
      finalFormula = components.join(' + ');
    }

    const roll = await new Roll(finalFormula, rollData).evaluate();
    damageRolls.push({
      roll,
      typeLabel: game.i18n.localize(CONFIG.TIRDUIN_RPS.damageTypes[type] || type)
    });
  }

  // 5. Generar mensaje de chat usando roll-dialog.mjs
  const target = game.user.targets.first();
  const chatContent = rollDialog.buildWeaponAttackDamageFlavorHtml({
    weaponName: weaponData.name,
    edgeText: rollDialog.getRollEdgeFlavorSuffix(edgeMode),
    edgeMode,
    attackRoll,
    damageRollEntries: damageRolls,
    targetName: target?.name,
    targetAC: target?.actor?.system?.attributes?.armorClass?.value
  });

  await ChatMessage.create(rollDialog.applyChatRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: chatContent,
    rolls: [attackRoll, ...damageRolls.map(d => d.roll)],
    img: actor.img
  }));

  // Gasto de munición si es a distancia
  if (item.system.subcategory === 'distancia') {
    const p = Number(item.system.projectiles) || 0;
    await item.update({ "system.projectiles": Math.max(0, p - 1) });
  }
}

/**
 * El diálogo de opciones. He restaurado los textos de tu sistema.
 */
async function promptWeaponRollOptions({ actor, weapon, extrasList }) {
  const i18n = (k) => game.i18n.localize(k);
  const fatigue = actor.type === 'character' ? (Number(actor.system.attributes?.fatigue?.rollPenalty) || 0) : 0;
  // Construimos una representación visual de los extras para el preview
  const extrasAttackString = extrasList.length > 0
    ? extrasList.map(e => e.attack !== 0 ? ` + ${e.attack}[${e.name}]` : '').join('')
    : "";
  // Construimos una representación visual de los extras para el preview
  const extrasDamageString = extrasList.length > 0
    ? extrasList.map(e => e.damage !== '' ? ` + ${e.damage} ${i18n('TIRDUIN_RPS.Damage.Type.' + e.damagetype)}[${e.name}]` : '').join('')
    : "";


  // Generamos el HTML igual que lo hacía tu actor-sheet
  const content = `
    <form>
      <div class="roll-preview-attack" style="text-align:center; font-weight:bold; padding:10px; background:rgba(0,0,0,0.05); border-radius:4px;">
        ---
      </div>
      <div class="roll-preview-damage" style="text-align:center; font-weight:bold; padding:10px; background:rgba(0,0,0,0.05); border-radius:4px;">
        ---
      </div>
      <div class="form-group">
        <label>${i18n('TIRDUIN_RPS.RollDialog.Common.Advantage')}</label>
        <input type="radio" name="edge" value="advantage">
        <label>Normal</label>
        <input type="radio" name="edge" value="none" checked>
        <label>${i18n('TIRDUIN_RPS.RollDialog.Common.Disadvantage')}</label>
        <input type="radio" name="edge" value="disadvantage">
      </div>
    </form>`;

  return new Promise(resolve => {
    new Dialog({
      title: `${i18n('TIRDUIN_RPS.RollDialog.Weapon.Title')} ${weapon.name}`,
      content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: i18n('TIRDUIN_RPS.RollDialog.Common.Roll'),
          callback: (html) => resolve({
            edgeMode: html.find('[name="edge"]:checked').val()
          })
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: i18n('TIRDUIN_RPS.RollDialog.Common.Cancel'),
          callback: () => resolve(null)
        }
      },
      render: (html) => {
        const update = () => {
          // Formamos la fórmula de ataque en base a la habilidad, bonificaciones extra y estado de fatiga
          const abVal = (actor.system.abilities[weapon.ability]?.value || 0) + fatigue;
          const adv = html.find('[name="edge"][value="advantage"]').is(':checked');
          const dis = html.find('[name="edge"][value="disadvantage"]').is(':checked');

          let formulaBase = `Ataque: 1d20 + ${abVal}[${weapon.ability.toUpperCase()}] + ${weapon.proficiency}[PROF] ${extrasAttackString}`;

          if (adv) formulaBase = `(${formulaBase}) + 1d6`;
          else if (dis) formulaBase = `(${formulaBase}) - 1d6`;

          html.find('.roll-preview-attack').text(formulaBase);

          // Formamos la fórmula de daño considerando bonificaciones extra y estado de fatiga
          let damageFormula = `Daño: ${weapon.damageDie}  + ${abVal} ${i18n('TIRDUIN_RPS.Damage.Type.' + weapon.damageType)} ${weapon.damageDie2 !== '' ? `+ ${weapon.damageDie2} ${i18n('TIRDUIN_RPS.Damage.Type.' + weapon.damageType2)}` : ''} ${extrasDamageString}`;

          html.find('.roll-preview-damage').text(damageFormula);
        };
        html.find('select, input').on('change', update);
        update();
      },
      close: () => resolve(null)
    }).render(true);
  });
}