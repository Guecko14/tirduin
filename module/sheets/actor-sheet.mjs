import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
import {
  applyChatRollMode,
  applyRollEdgeToFormula,
  buildRollFlavorHtml,
  buildTypedRollTitle,
  buildWeaponAttackDamageFlavorHtml,
  getD20OutcomeText,
  getRollEdgeFlavorSuffix,
  promptRollConfirmation,
} from '../helpers/roll-dialog.mjs';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class TirduinRPSActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['tirduin', 'sheet', 'actor'],
      width: 900,
      height: 600,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'skills',
        },
      ],
    });
  }

  /** @override */
  get template() {
    return `systems/tirduin/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Construye el contexto comun que consumen las plantillas de actor.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.document.toPlainObject();

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Adding a pointer to CONFIG.TIRDUIN_RPS
    context.config = CONFIG.TIRDUIN_RPS;

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
    }

    // Normaliza las skills para que NPC y Character puedan usar el mismo partial.
    const skills = context.system?.skills || {};
    const npcSkillKeys = [
      'atletismo', 'sigilo', 'juegoManos', 'acrobacias',
      'tratoAnimales', 'percepcion', 'perspicacia', 'supervivencia',
      'persuasion', 'enganar', 'interpretacion', 'intimidacion'
    ];

    const abilityMapping = {
      atletismo: 'VIG',
      sigilo: 'AGIL',
      juegoManos: 'AGIL',
      acrobacias: 'AGIL',
      investigacion: 'MENT',
      artesania: 'MENT',
      historia: 'MENT',
      religion: 'MENT',
      aether: 'MENT',
      naturaleza: 'MENT',
      medicina: 'MENT',
      tratoAnimales: 'INST',
      percepcion: 'INST',
      perspicacia: 'INST',
      supervivencia: 'INST',
      persuasion: 'PRE',
      enganar: 'PRE',
      interpretacion: 'PRE',
      intimidacion: 'PRE'
    };

    const skillKeys = this.actor.type === 'npc'
      ? npcSkillKeys
      : Object.keys(CONFIG.TIRDUIN_RPS.skills || {});

    context.system.skillList = skillKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(skills, key))
      .map((key) => {
        const skill = skills[key] || {};
        const rank = Number(skill.rank) || 0;
        const bonus = Number(skill.bonus) || 0;
        const abilityKey = abilityMapping[key] || '-';
        const abilityVal = Number(context.system?.abilities?.[abilityKey.toLowerCase()]?.value) || 0;

        const label = skill.label || CONFIG.TIRDUIN_RPS.skills?.[key] || key;
        const labelShort = label.length > 18 ? `${label.slice(0, 15)}…` : label;
        return {
          key,
          label,
          labelShort,
          ability: abilityKey,
          rank,
          bonus,
          total: abilityVal + rank + bonus
        };
    });

    // Enriquecer la biografia permite reutilizar el editor rico en la sheet.
    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.actor.system.biography,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Necessary in v11, can be removed in v12
        async: true,
        // Data to fill in for inline rolls
        rollData: this.actor.getRollData(),
        // Relative UUID resolution
        relativeTo: this.actor,
      }
    );

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    return context;
  }

  /**
   * Character-specific context modifications
   *
   * @param {object} context The context object to mutate
   */
  _prepareCharacterData(context) {
    // This is where you can enrich character-specific editor fields
    // or setup anything else that's specific to this type
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Separa los items por seccion visible de la ficha para simplificar las plantillas.
    const gear = [];
    const features = [];
    const fearActions = [];
    const specialActions = [];
    const magicActions = [];
    // Objetos del NPC: genéricos, armas y armaduras separados para el tab de Objetos.
    const npcGenericObjects = [];
    const npcWeapons = [];
    const npcArmors = [];
    let currentSlots = 0;
    const spells = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: [],
      10: [],
    };

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Objetos normales del inventario.
      if (i.type === 'item') {
        gear.push(i);
        // Los NPCs usan los items genéricos también en la sección de objetos.
        npcGenericObjects.push(i);
        currentSlots += Number(i.system?.weight) || 0;
      }
      // Las acciones de miedo son features marcadas con category=fear.
      else if (i.type === 'feature' && i.system.category === 'fear') {
        fearActions.push(i);
      }
      // Las entradas especiales del NPC usan feature con category=special.
      else if (i.type === 'feature' && i.system.category === 'special') {
        specialActions.push(i);
      }
      // Acciones mágicas manuales del NPC.
      else if (i.type === 'feature' && i.system.category === 'magicAction') {
        magicActions.push(i);
      }
      // El resto de features siguen apareciendo en la seccion de dotes.
      else if (i.type === 'feature') {
        features.push(i);
      }
      // Armas del NPC: van al listado de armas del tab de objetos.
      else if (i.type === 'weapon') {
        npcWeapons.push(i);
        currentSlots += Number(i.system?.weight) || 0;
      }
      // Armaduras del NPC: van al listado de armaduras del tab de objetos.
      else if (i.type === 'armor') {
        npcArmors.push(i);
        currentSlots += Number(i.system?.weight) || 0;
      }
      // Conjuros agrupados por nivel para el partial de spells.
      else if (i.type === 'spell') {
        const level = Number(i.system?.spellLevel);
        if (Number.isFinite(level) && spells[level]) {
          spells[level].push(i);
        }
      }
    }

    // Assign and return
    context.gear = gear;
    context.features = features;
    context.fearActions = fearActions;
    context.specialActions = specialActions;
    context.npcMagicActions = magicActions;
    // Colecciones para el tab de Objetos del NPC.
    context.npcGenericObjects = npcGenericObjects;
    context.npcWeapons = npcWeapons;
    context.npcArmors = npcArmors;
    context.npcWeaponActions = npcWeapons.filter((w) => !!w.system?.actionEnabled);
    context.npcArmorActions = npcArmors.filter((a) => !!a.system?.equipped);

    const vigor = Number(context.system?.abilities?.vig?.value) || 0;
    const slotsExtra = Number(context.system?.attributes?.slotsExtra?.value) || 0;
    const capacitySlots = vigor <= 0
      ? Math.max(0, 5 + slotsExtra)
      : Math.max(0, 5 + (2 * vigor) + slotsExtra);
    context.npcSlots = {
      current: Number(currentSlots.toFixed(2)),
      capacity: Number(capacitySlots.toFixed(2)),
      extra: slotsExtra,
    };

    context.spells = spells;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // En NPC: por defecto abre en Acciones, pero conserva el tab actual en rerenders.
    if (this.actor.type === 'npc') {
      const selectedTab = this._npcActiveTab || 'actions';
      const nav = html.find('.sheet-tabs[data-group="npc-sections"]');
      const content = html.find('.tabs-content');
      nav.find('.item').removeClass('active');
      content.find('.tab').removeClass('active');
      nav.find(`.item[data-tab="${selectedTab}"]`).addClass('active');
      content.find(`.tab[data-tab="${selectedTab}"]`).addClass('active');
    }

    // Navegacion custom de tabs para ambas sheets de actor.
    html.on('click', '.sheet-tabs .item', (ev) => {
      ev.preventDefault();
      const tabName = $(ev.currentTarget).data('tab');
      const tabContent = $(ev.currentTarget).closest('.sheet-tabs').siblings('.tabs-content');
      
      // Deactivate all tabs and contents
      $(ev.currentTarget).closest('.sheet-tabs').find('.item').removeClass('active');
      tabContent.find('.tab').removeClass('active');
      
      // Activate selected tab
      $(ev.currentTarget).addClass('active');
      tabContent.find(`.tab[data-tab="${tabName}"]`).addClass('active');

      // Guarda selección de tab para NPC durante la vida de esta sheet.
      if (this.actor.type === 'npc') this._npcActiveTab = tabName;
    });

    // Abre cualquier item embebido usando el data-item-id del bloque pulsado.
    html.on('click', '.item-edit', (ev) => {
      const row = $(ev.currentTarget).closest('[data-item-id]');
      const item = this.actor.items.get(row.data('itemId'));
      if (!item) return;
      item.sheet.render(true);
    });

    // Click en una armadura del NPC: tira VD y aplica desgaste de RA.
    html.on('click', '.npc-armor-item', this._onArmorItemClick.bind(this));

    // Click en un arma del NPC: dialogo de ataque (VIG/AGIL + competencia) y daño.
    html.on('click', '.npc-weapon-item', this._onWeaponItemClick.bind(this));

    // Toggle de armadura equipada (icono de escudo en la tabla de armaduras).
    html.on('click', '.armor-equip-toggle', this._onArmorEquipToggle.bind(this));

    // Toggle de arma disponible en Acciones.
    html.on('click', '.weapon-action-toggle', this._onWeaponActionToggle.bind(this));

    // Click en filas del tab de Acciones (arma, parar, mágico).
    html.on('click', '.npc-action-item', this._onActionItemClick.bind(this));

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Persistencia inmediata de campos simples sin esperar al submit del formulario.
    html.on('change', 'input[type="number"], input[type="text"], select, textarea', (ev) => {
      const field = $(ev.currentTarget);
      const name = field.attr('name');
      if (!name) return;

      let value = field.val();
      if (field.attr('type') === 'number') {
        value = Number(value) || 0;
      }

      const updateData = {};
      updateData[name] = value;
      this.actor.update(updateData);
    });

    // Creacion generica de items desde botones con data-type y data-* adicionales.
    html.on('click', '.item-create', this._onItemCreate.bind(this));

    // Borrado generico de items para listas normales y para acciones de miedo.
    html.on('click', '.item-delete', (ev) => {
      const row = $(ev.currentTarget).closest('[data-item-id]');
      const item = this.actor.items.get(row.data('itemId'));
      if (!item) return;
      item.delete();
      row.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on('click', '.effect-control', (ev) => {
      const row = ev.currentTarget.closest('li');
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on('click', '.rollable', this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Lee el tipo y los valores iniciales definidos en el boton pulsado.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = foundry.utils.duplicate(header.dataset);
    // Normaliza flags booleanas que llegan como string desde data-*.
    if (typeof data.actionEnabled !== 'undefined') {
      data.actionEnabled = data.actionEnabled === true || data.actionEnabled === 'true';
    }
    // Da nombres utiles por defecto segun la categoria del item creado.
    const name = data.category === 'fear'
      ? 'Nueva accion de miedo'
      : data.category === 'special'
        ? 'Nueva habilidad especial'
      : data.category === 'magicAction'
        ? 'Nuevo ataque magico'
      : (type === 'weapon' && data.actionEnabled)
        ? 'Nuevo ataque'
      : `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // El tipo ya viaja en itemData.type; se elimina del system inicial.
    delete itemData.system['type'];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      const actorRollData = this.actor.getRollData();
      const edgeMode = await promptRollConfirmation({
        formula: dataset.roll,
        rollData: actorRollData,
      });
      if (edgeMode === null) return null;

      const formula = applyRollEdgeToFormula(dataset.roll, edgeMode);
      let roll = new Roll(formula, actorRollData);
      await roll.evaluate();
      const title = buildTypedRollTitle('ability', dataset.label || 'Tirada');
      const outcomeText = getD20OutcomeText(roll);
      const edgeText = getRollEdgeFlavorSuffix(edgeMode);
      const flavor = buildRollFlavorHtml({
        title: `${title}${edgeText}`,
        roll,
        outcomeText,
        edgeMode,
      });
      await ChatMessage.create(applyChatRollMode({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: flavor,
      }));
      return roll;
    }
  }

  /**
   * Handle click on armor rows: roll VD, increment RA current and auto-mark broken.
   * @param {Event} event
   * @private
   */
  async _onArmorItemClick(event) {
    const clickedControl = event.target.closest('.npc-object-controls, .armor-equip-toggle');
    if (clickedControl) return;

    const row = event.currentTarget;
    const itemId = row?.dataset?.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || item.type !== 'armor') return;

    if (item.system?.broken) {
      ui.notifications?.warn(`${item.name} esta rota y no puede tirar VD.`);
      return null;
    }

    const vdFormula = String(item.system?.vd || '').trim();
    if (!vdFormula) return;

    const actorRollData = this.actor.getRollData();
    const roll = new Roll(vdFormula, actorRollData);
    await roll.evaluate();
    await ChatMessage.create(applyChatRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: buildRollFlavorHtml({
        title: buildTypedRollTitle('armor', `${item.name} VD`),
        roll,
      }),
    }));

    const raMax = Math.max(0, Number(item.system?.ra) || 0);
    const raCurrent = Math.min(
      Math.max(0, Number(item.system?.raCurrent) || 0) + 1,
      raMax
    );

    const updateData = {
      'system.raCurrent': raCurrent,
    };

    if (raMax > 0 && raCurrent >= raMax) {
      updateData['system.broken'] = true;
    }

    await item.update(updateData);

    if (item.system?.equipped) {
      const armorClass = this._calculateArmorClassFromEquippedArmors();
      await this.actor.update({ 'system.attributes.armorClass.value': armorClass });
    }

    return roll;
  }

  /**
   * Handle click on weapon rows: choose attribute + edge mode, then roll attack and damage.
   * @param {Event} event
   * @private
   */
  async _onWeaponItemClick(event) {
    const clickedControl = event.target.closest('.npc-object-controls');
    if (clickedControl) return;

    const row = event.currentTarget;
    const itemId = row?.dataset?.itemId;
    const weapon = this.actor.items.get(itemId);
    if (!weapon || weapon.type !== 'weapon') return;

    const damageDie = String(weapon.system?.damageDie || '').trim();
    if (!damageDie) {
      ui.notifications?.warn(`${weapon.name} no tiene dado de daño configurado.`);
      return null;
    }
    const damageDie2 = String(weapon.system?.damageDie2 || '').trim();
    const damageTypeKey = String(weapon.system?.damageType || '').trim();
    const damageTypeKey2 = String(weapon.system?.damageType2 || '').trim();

    const proficiency = Number(weapon.system?.proficiency) || 0;
    const actorRollData = this.actor.getRollData();
    const selection = await this._promptWeaponRollOptions({
      weaponName: weapon.name,
      damageDie,
      damageDie2,
      proficiency,
      actorRollData,
    });
    if (!selection) return null;

    const abilityKey = selection.abilityKey;
    const edgeMode = selection.edgeMode;
    const abilityValue = Number(this.actor.system?.abilities?.[abilityKey]?.value) || 0;

    const attackBaseFormula = `1d20 + (${abilityValue}) + (${proficiency})`;
    const attackFormula = applyRollEdgeToFormula(attackBaseFormula, edgeMode);
    const damageFormula = `${damageDie} + (${abilityValue})`;
    const damageFormula2 = damageDie2 || '';

    const damageTypeLabel = damageTypeKey
      ? game.i18n.localize(CONFIG.TIRDUIN_RPS.damageTypes[damageTypeKey] || damageTypeKey)
      : '';
    const damageTypeLabel2 = damageTypeKey2
      ? game.i18n.localize(CONFIG.TIRDUIN_RPS.damageTypes[damageTypeKey2] || damageTypeKey2)
      : '';

    const attackRoll = new Roll(attackFormula, actorRollData);
    await attackRoll.evaluate();
    const damageRoll = new Roll(damageFormula, actorRollData);
    await damageRoll.evaluate();
    let damageRoll2 = null;
    if (damageFormula2) {
      damageRoll2 = new Roll(damageFormula2, actorRollData);
      await damageRoll2.evaluate();
    }

    await ChatMessage.create(applyChatRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: buildWeaponAttackDamageFlavorHtml({
        weaponName: weapon.name,
        edgeText: getRollEdgeFlavorSuffix(edgeMode),
        edgeMode,
        attackRoll,
        damageRoll,
        damageTypeLabel,
        damageRoll2,
        damageTypeLabel2,
      }),
    }));

    return { attackRoll, damageRoll, damageRoll2 };
  }

  /**
   * Toggle whether a weapon appears in the NPC Actions tab.
   * @param {Event} event
   * @private
   */
  async _onWeaponActionToggle(event) {
    event.preventDefault();
    event.stopPropagation();

    const row = event.currentTarget.closest('[data-item-id]');
    const itemId = row?.dataset?.itemId;
    const weapon = this.actor.items.get(itemId);
    if (!weapon || weapon.type !== 'weapon') return;

    const next = !weapon.system?.actionEnabled;
    await weapon.update({ 'system.actionEnabled': next });
  }

  /**
   * Execute an action row from the NPC Actions tab.
   * @param {Event} event
   * @private
   */
  async _onActionItemClick(event) {
    const clickedControl = event.target.closest('.npc-object-controls');
    if (clickedControl) return;

    const row = event.currentTarget;
    const actionKind = row?.dataset?.actionKind;
    const itemId = row?.dataset?.itemId;
    if (!actionKind || !itemId) return;

    if (actionKind === 'weapon') {
      return this._onWeaponItemClick(event);
    }
    if (actionKind === 'armor') {
      return this._onArmorItemClick(event);
    }
    if (actionKind === 'magic') {
      return this._onMagicActionUse(itemId);
    }
  }

  /**
   * Roll and resolve a magical action against the first targeted token.
   * @param {string} itemId
   * @private
   */
  async _onMagicActionUse(itemId) {
    const magic = this.actor.items.get(itemId);
    if (!magic || magic.type !== 'feature' || magic.system?.category !== 'magicAction') return;

    const targetToken = game.user?.targets?.first();
    if (!targetToken?.actor) {
      ui.notifications?.warn('Selecciona un token objetivo para resolver la salvacion.');
      return null;
    }

    const damageFormula = String(magic.system?.damageDie || '').trim();
    if (!damageFormula) {
      ui.notifications?.warn(`${magic.name} no tiene daño configurado.`);
      return null;
    }

    const dc = Math.max(1, Number(magic.system?.dc) || 1);
    const saveType = String(magic.system?.saveType || 'fortaleza');
    const onSaveSuccess = String(magic.system?.onSaveSuccess || 'half');
    const saveLabelMap = {
      fortaleza: 'Fortaleza',
      reflejos: 'Reflejos',
      voluntad: 'Voluntad',
    };
    const saveLabel = saveLabelMap[saveType] || 'Salvacion';
    const targetSaveBonus = this._getSaveValue(targetToken.actor, saveType);

    const saveRoll = new Roll(`1d20 + (${targetSaveBonus})`, targetToken.actor.getRollData?.() || {});
    await saveRoll.evaluate();
    const damageRoll = new Roll(damageFormula, this.actor.getRollData());
    await damageRoll.evaluate();

    const success = (Number(saveRoll.total) || 0) >= dc;
    const resultText = success
      ? `${targetToken.name} supera ${saveLabel} (CD ${dc}).`
      : `${targetToken.name} falla ${saveLabel} (CD ${dc}).`;
    const rolledDamageTotal = Number(damageRoll.total) || 0;
    const appliedDamageTotal = !success
      ? rolledDamageTotal
      : onSaveSuccess === 'negate'
        ? 0
        : Math.floor(rolledDamageTotal / 2);
    const damageOutcomeText = !success
      ? `${targetToken.name} recibe el daño completo.`
      : onSaveSuccess === 'negate'
        ? `${targetToken.name} niega completamente el daño.`
        : `${targetToken.name} reduce el daño a la mitad.`;

    const saveCard = buildRollFlavorHtml({
      title: `[Salvacion] ${targetToken.name} - ${saveLabel}`,
      roll: saveRoll,
      outcomeText: resultText,
    });

    const damageCard = buildRollFlavorHtml({
      title: buildTypedRollTitle('spell', `${magic.name} Daño`),
      roll: damageRoll,
      outcomeText: damageOutcomeText,
      totalOverride: appliedDamageTotal,
      showDiceBreakdown: true,
      showBonus: true,
    });

    await ChatMessage.create(applyChatRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="tirduin-roll-bundle">${saveCard}${damageCard}</div>`,
    }));

    return { saveRoll, damageRoll, success, appliedDamageTotal };
  }

  /**
   * Get a save bonus from actor data with a fallback computed from abilities.
   * @param {Actor} targetActor
   * @param {'fortaleza'|'reflejos'|'voluntad'} saveType
   * @returns {number}
   * @private
   */
  _getSaveValue(targetActor, saveType) {
    const direct = Number(targetActor?.system?.saves?.[saveType]?.value);
    if (Number.isFinite(direct)) return direct;

    const vig = Number(targetActor?.system?.abilities?.vig?.value) || 0;
    const agil = Number(targetActor?.system?.abilities?.agil?.value) || 0;
    const inst = Number(targetActor?.system?.abilities?.inst?.value) || 0;
    const ment = Number(targetActor?.system?.abilities?.ment?.value) || 0;
    const pre = Number(targetActor?.system?.abilities?.pre?.value) || 0;

    if (saveType === 'fortaleza') return vig * 2;
    if (saveType === 'reflejos') return agil + inst;
    return ment + pre;
  }

  /**
   * Prompt weapon attack options with attribute selector and edge radios.
  * @param {{weaponName: string, damageDie: string, damageDie2?: string, proficiency: number, actorRollData: object}} options
   * @returns {Promise<{abilityKey: 'vig'|'agil', edgeMode: string}|null>}
   * @private
   */
  async _promptWeaponRollOptions({ weaponName, damageDie, damageDie2 = '', proficiency, actorRollData }) {
    return new Promise((resolve) => {
      let settled = false;

      const safeResolve = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const content = `
        <form class="tirduin-roll-confirmation tirduin-weapon-roll-confirmation">
          <div class="roll-summary">
            <div class="weapon-roll-topline">
              <span>Atributo</span>
              <select name="tirduin-weapon-ability">
                <option value="vig">Vigor</option>
                <option value="agil">Agilidad</option>
              </select>
              <span class="weapon-roll-prof">Comp: +${proficiency}</span>
            </div>
            <p class="weapon-roll-preview" data-role="weapon-attack-preview"></p>
            <p class="weapon-roll-preview" data-role="weapon-damage-preview"></p>
            <p class="weapon-roll-preview" data-role="weapon-damage2-preview"></p>
          </div>
          <div class="roll-edge-row">
            <label class="roll-edge-option">
              <input type="radio" name="tirduin-roll-edge" value="advantage">
              Ventaja
            </label>
            <label class="roll-edge-option">
              <input type="radio" name="tirduin-roll-edge" value="disadvantage">
              Desventaja
            </label>
          </div>
        </form>
      `;

      new Dialog({
        title: `Ataque de arma: ${weaponName}`,
        content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d20"></i>',
            label: 'Tirar',
            callback: (html) => {
              const abilityKey = html.find('select[name="tirduin-weapon-ability"]').val() || 'vig';
              const edgeMode = html.find('input[name="tirduin-roll-edge"]:checked').val() || 'none';
              safeResolve({ abilityKey, edgeMode });
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
          const abilitySelect = html.find('select[name="tirduin-weapon-ability"]');
          const edgeRadios = html.find('input[name="tirduin-roll-edge"]');
          const attackPreview = html.find('[data-role="weapon-attack-preview"]');
          const damagePreview = html.find('[data-role="weapon-damage-preview"]');
          const damagePreview2 = html.find('[data-role="weapon-damage2-preview"]');

          const refreshPreview = () => {
            const abilityKey = abilitySelect.val() || 'vig';
            const edgeMode = html.find('input[name="tirduin-roll-edge"]:checked').val() || 'none';
            const abilityValue = Number(this.actor.system?.abilities?.[abilityKey]?.value) || 0;

            const attackBase = `1d20 + (${abilityValue}) + (${proficiency})`;
            const attackFormula = applyRollEdgeToFormula(attackBase, edgeMode);
            const damageFormula = `${damageDie} + (${abilityValue})`;
            const damageFormula2 = damageDie2 || '';

            try {
              attackPreview.text(`Ataque: ${new Roll(attackFormula, actorRollData).formula}`);
            } catch (_error) {
              attackPreview.text(`Ataque: ${attackFormula}`);
            }

            try {
              damagePreview.text(`Daño: ${new Roll(damageFormula, actorRollData).formula}`);
            } catch (_error) {
              damagePreview.text(`Daño: ${damageFormula}`);
            }

            if (!damageFormula2) {
              damagePreview2.text('');
              return;
            }

            try {
              damagePreview2.text(`Daño 2: ${new Roll(damageFormula2, actorRollData).formula}`);
            } catch (_error) {
              damagePreview2.text(`Daño 2: ${damageFormula2}`);
            }
          };

          abilitySelect.on('change', refreshPreview);
          edgeRadios.on('change', refreshPreview);
          refreshPreview();
        },
        close: () => safeResolve(null),
      }).render(true);
    });
  }

  /**
   * Toggle equipped armor and update actor AC using armor CA plus agility cap.
   * @param {Event} event
   * @private
   */
  async _onArmorEquipToggle(event) {
    event.preventDefault();
    event.stopPropagation();

    const row = event.currentTarget.closest('[data-item-id]');
    const itemId = row?.dataset?.itemId;
    const armor = this.actor.items.get(itemId);
    if (!armor || armor.type !== 'armor') return;

    const willEquip = !armor.system?.equipped;
    const isShield = armor.system?.category === 'escudo';
    const updates = [];

    // Siempre actualiza el estado del item pulsado.
    updates.push(armor.update({ 'system.equipped': willEquip }));

    // Si se equipa una armadura no-escudo, desequipa el resto de no-escudos.
    // Si se equipa un escudo, desequipa el resto de escudos.
    for (const item of this.actor.items) {
      if (item.type !== 'armor' || item.id === armor.id) continue;
      if (!willEquip) continue;
      if (!item.system?.equipped) continue;
      if (isShield && item.system?.category !== 'escudo') continue;
      if (!isShield && item.system?.category === 'escudo') continue;
      updates.push(item.update({ 'system.equipped': false }));
    }

    if (updates.length) await Promise.all(updates);

    const armorClass = this._calculateArmorClassFromEquippedArmors();

    await this.actor.update({ 'system.attributes.armorClass.value': armorClass });
  }

  /**
   * Calculate AC from a specific armor and NPC agility using armor cap.
   * @param {object} armorSystem
   * @param {boolean} isBroken
   * @returns {number}
   * @private
   */
  _calculateArmorClassFromArmor(armorSystem, isBroken = false) {
    const agility = Number(this.actor.system?.abilities?.agil?.value) || 0;
    const caBase = isBroken
      ? Number(armorSystem?.caBroken) || 0
      : Number(armorSystem?.ca) || 0;
    const agilityCap = isBroken
      ? Number(armorSystem?.maxAgilityBroken) || 0
      : Number(armorSystem?.maxAgility) || 0;

    const agilityContribution = Math.min(agility, agilityCap);
    return caBase + agilityContribution;
  }

  /**
   * Calculate AC using currently equipped armors, with support for shield coexistence.
   * - No armor equipped: 10 + Agi
   * - Non-shield equipped: its CA + capped Agi
   * - Shield equipped together with non-shield: adds shield CA on top
   * - Only shield equipped: shield CA + capped Agi
   * @returns {number}
   * @private
   */
  _calculateArmorClassFromEquippedArmors() {
    const equippedArmors = this.actor.items.filter((i) => i.type === 'armor' && i.system?.equipped);
    const mainArmor = equippedArmors.find((i) => i.system?.category !== 'escudo');
    const shield = equippedArmors.find((i) => i.system?.category === 'escudo');

    let armorClass = mainArmor
      ? this._calculateArmorClassFromArmor(mainArmor.system, Boolean(mainArmor.system?.broken))
      : this._calculateUnarmoredArmorClass();

    if (shield && !shield.system?.broken) {
      armorClass += Number(shield.system?.bonus) || 0;
    }

    return armorClass;
  }

  /**
   * Fallback AC when no armor is equipped.
   * @returns {number}
   * @private
   */
  _calculateUnarmoredArmorClass() {
    const agility = Number(this.actor.system?.abilities?.agil?.value) || 0;
    return 10 + agility;
  }
}
