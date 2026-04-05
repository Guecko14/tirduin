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
  getNaturalD20Result,
  getRollEdgeFlavorSuffix,
  promptInitiativeConfirmation,
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
      // Esperanza mantiene compatibilidad con actores antiguos que solo tenían power.
      const currentHope = foundry.utils.hasProperty(context.system ?? {}, 'hope.value')
        ? context.system?.hope?.value
        : context.system?.power?.value;
      context.hopePips = this._buildResourcePips({
        path: 'system.hope.value',
        maxPath: 'system.hope.max',
        value: currentHope,
        max: context.system?.hope?.max ?? 6,
      });
      context.stressPips = this._buildResourcePips({
        path: 'system.stress.value',
        maxPath: 'system.stress.max',
        value: context.system?.stress?.value,
        max: context.system?.stress?.max ?? 6,
      });
      context.luckPips = this._buildResourcePips({
        path: 'system.luck.value',
        maxPath: 'system.luck.max',
        value: context.system?.luck?.value,
        max: context.system?.luck?.max ?? 3,
      });
      context.deathRollHopePips = this._buildResourcePips({
        path: 'system.deathRoll.hope.value',
        maxPath: 'system.deathRoll.hope.max',
        value: context.system?.deathRoll?.hope?.value,
        max: context.system?.deathRoll?.hope?.max ?? 3,
      });
      context.deathRollFearPips = this._buildResourcePips({
        path: 'system.deathRoll.fear.value',
        maxPath: 'system.deathRoll.fear.max',
        value: context.system?.deathRoll?.fear?.value,
        max: context.system?.deathRoll?.fear?.max ?? 3,
      });
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
    const fatigueLevel = Math.max(0, Math.min(5, Number(this.actor.system?.attributes?.fatigue?.value) || 0));
    const fallbackFatiguePenalty = {
      0: 0,
      1: -2,
      2: -3,
      3: -4,
      4: -5,
      5: -5,
    }[fatigueLevel] ?? 0;
    const fatigueRollPenalty = this.actor.type === 'character'
      ? (Number(this.actor.system?.attributes?.fatigue?.rollPenalty) || fallbackFatiguePenalty)
      : 0;

    context.fatigueRollPenalty = fatigueRollPenalty;
    if (this.actor.type === 'character') {
      for (const [abilityKey, abilityData] of Object.entries(context.system?.abilities || {})) {
        abilityData.rollMod = (Number(abilityData?.value) || 0) + fatigueRollPenalty;
      }
    }

    context.system.skillList = skillKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(skills, key))
      .map((key) => {
        const skill = skills[key] || {};
        const rank = Number(skill.rank) || 0;
        const bonus = Number(skill.bonus) || 0;
        const abilityKey = abilityMapping[key] || '-';
        const abilityVal = Number(this.actor.system?.abilities?.[abilityKey.toLowerCase()]?.value) || 0;

        const label = skill.label || CONFIG.TIRDUIN_RPS.skills?.[key] || key;
        const labelShort = label.length > 18 ? `${label.slice(0, 15)}…` : label;
        return {
          key,
          label,
          labelShort,
          ability: abilityKey,
          rank,
          bonus,
          total: abilityVal + rank + bonus + fatigueRollPenalty
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

  _buildResourcePips({ path, maxPath, value, max }) {
    // La sheet usa la misma UI de pips para varios recursos, así que se prepara
    // una estructura común con la ruta de update y el estado visual de cada pip.
    const safeMax = Math.max(0, Number(max) || 0);
    const currentValue = Math.max(0, Math.min(safeMax, Number(value) || 0));

    return Array.from({ length: safeMax }, (_, index) => ({
      value: index + 1,
      filled: index < currentValue,
      path,
      maxPath,
      max: safeMax,
      currentValue,
    }));
  }

  /**
   * Return a suitable fallback icon path for an item by type/category.
   * @param {object} itemLike
   * @returns {string|null}
   */
  _getSuggestedItemIcon(itemLike) {
    const type = itemLike?.type;
    const category = itemLike?.system?.category;

    if (type === 'spell') return 'icons/svg/book.svg';
    if (type === 'weapon') return 'icons/svg/sword.svg';
    if (type === 'armor') return 'icons/svg/shield.svg';
    if (type === 'feature' && category === 'fear') return 'icons/svg/skull.svg';
    if (type === 'feature' && category === 'special') return 'icons/svg/aura.svg';
    if (type === 'feature' && category === 'magicAction') return 'icons/svg/explosion.svg';
    if (type === 'feature') return 'icons/svg/upgrade.svg';
    return null;
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
      const suggestedIcon = this._getSuggestedItemIcon(i);
      if (i.img === Item.DEFAULT_ICON && suggestedIcon) {
        i.img = suggestedIcon;
      }
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

    // Publica en chat un resumen estructurado de dotes y conjuros.
    html.on('click', '.item-summary', this._onItemSummary.bind(this));

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

    // Boton de tirada de muerte (d20): actualiza pips de Esperanza o Miedo segun resultado.
    html.on('click', '.death-roll-btn', this._onDeathRoll.bind(this));

    html.on('click', '.resource-pip', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const pip = ev.currentTarget;
      const value = Number(pip.dataset.value) || 0;
      const currentValue = Number(pip.dataset.currentValue) || 0;
      const resourcePath = pip.dataset.resourcePath;
      const maxPath = pip.dataset.maxPath;
      const maxValue = Number(pip.dataset.maxValue) || 0;

      if (!resourcePath) return;

      const nextValue = currentValue === value ? Math.max(0, value - 1) : value;
      const updateData = {
        [resourcePath]: nextValue,
      };

      if (maxPath && maxValue > 0) {
        updateData[maxPath] = maxValue;
      }

      if (resourcePath === 'system.hope.value') {
        // Sincroniza el campo heredado para que Esperanza siga funcionando en
        // actores creados antes del cambio desde power hacia hope.
        updateData['system.power.value'] = nextValue;
        updateData['system.power.max'] = 6;
      }

      await this.actor.update(updateData);
    });

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

    // Quick initiative button in actor header.
    html.on('click', '.initiative-roll-btn', this._onInitiativeRollClick.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find('[data-item-id]').each((i, el) => {
        // Avoid duplicate listeners on rerenders when reusing DOM nodes.
        el.removeEventListener('dragstart', handler, false);
        el.setAttribute('draggable', true);
        el.addEventListener('dragstart', handler, false);
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
      : (type === 'spell')
        ? 'Nuevo conjuro'
      : (type === 'feature')
        ? 'Nueva dote'
      : (type === 'weapon' && data.actionEnabled)
        ? 'Nuevo ataque'
      : `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    const suggestedIcon = this._getSuggestedItemIcon({ type, system: data });
    if (suggestedIcon) itemData.img = suggestedIcon;
    // El tipo ya viaja en itemData.type; se elimina del system inicial.
    delete itemData.system['type'];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  /** @override */
  _onDragStart(event) {
    const row = event.currentTarget?.closest('[data-item-id]');
    const itemId = row?.dataset?.itemId;
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!item) return super._onDragStart(event);

    const dragData = item.toDragData();
    const suggestedIcon = this._getSuggestedItemIcon(item);

    // When source item keeps default icon, ship explicit item data with fallback icon.
    if ((item.img === Item.DEFAULT_ICON || !item.img) && suggestedIcon) {
      const itemData = item.toObject();
      itemData.img = suggestedIcon;
      dragData.data = itemData;
      delete dragData.uuid;
    }

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  _escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _humanizeInlineFormula(formula = '') {
    const source = String(formula || '').trim();
    if (!source) return '';

    // Show readable ability names instead of raw @paths.
    return source.replace(/@abilities\.([a-zA-Z0-9_]+)\.value/g, (_m, abilityKey) => {
      const key = String(abilityKey || '').toLowerCase();
      const i18nKey = CONFIG.TIRDUIN_RPS?.abilities?.[key];
      return i18nKey ? game.i18n.localize(i18nKey) : `@abilities.${key}.value`;
    });
  }

  _resolveInlineDamageLabel(damageKey = '') {
    const rawKey = String(damageKey || '').trim();
    if (!rawKey) return '';

    const normalize = (value) => String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    const aliasMap = {
      // slashing/piercing
      corte: 'slashingPiercing',
      cortante: 'slashingPiercing',
      punzante: 'slashingPiercing',
      slashing: 'slashingPiercing',
      piercing: 'slashingPiercing',
      slashpierce: 'slashingPiercing',
      // bludgeoning
      contundente: 'bludgeoning',
      bludgeoning: 'bludgeoning',
      golpe: 'bludgeoning',
      // elemental/common
      acido: 'acid',
      acid: 'acid',
      frio: 'cold',
      cold: 'cold',
      hielo: 'cold',
      fuego: 'fire',
      fire: 'fire',
      electrico: 'lightning',
      electricidad: 'lightning',
      rayo: 'lightning',
      lightning: 'lightning',
      // other
      sonico: 'sonic',
      sonic: 'sonic',
      psiquico: 'psychic',
      psychic: 'psychic',
      necrotico: 'necrotic',
      necrotic: 'necrotic',
      veneno: 'poison',
      poison: 'poison',
      aeter: 'aetherMagic',
      aether: 'aetherMagic',
      aethermagic: 'aetherMagic',
      magiaaeter: 'aetherMagic',
      magiaaether: 'aetherMagic',
    };

    const damageTypes = CONFIG.TIRDUIN_RPS?.damageTypes || {};
    const normalized = normalize(rawKey);
    const mappedKey = aliasMap[normalized] || rawKey;

    // 1) Try canonical key (or alias result)
    const directI18n = damageTypes[mappedKey] || damageTypes[String(mappedKey).toLowerCase()];
    if (directI18n) return game.i18n.localize(directI18n);

    // 2) Try matching localized labels entered by user (e.g. "Fuego").
    for (const [typeKey, typeI18n] of Object.entries(damageTypes)) {
      const localizedLabel = game.i18n.localize(typeI18n);
      if (normalized === normalize(typeKey) || normalized === normalize(localizedLabel)) {
        return localizedLabel;
      }
    }

    return rawKey;
  }

  _renderSummaryTextWithRollButtons(text = '') {
    const source = String(text || '');
    if (!source.trim()) return '';

    const rollLabel = game.i18n.localize('TIRDUIN_RPS.Chat.RollInline');
    const actorId = this._escapeHtml(this.actor.id);
    const regex = /\[([^\[\]]+)\]/g;
    let lastIndex = 0;
    let html = '';
    let match;

    while ((match = regex.exec(source)) !== null) {
      const before = source.slice(lastIndex, match.index);
      html += this._escapeHtml(before).replace(/\n/g, '<br>');

      const token = String(match[1] || '').trim();
      const [formulaPart, damagePart] = token.split('|').map((part) => String(part || '').trim());
      const formula = formulaPart;
      if (formula) {
        const safeFormula = this._escapeHtml(formula);
        const formulaLabel = this._humanizeInlineFormula(formula);
        const damageLabel = this._resolveInlineDamageLabel(damagePart);
        const buttonLabel = damageLabel
          ? `${formulaLabel} · ${damageLabel}`
          : formulaLabel;
        const safeButtonLabel = this._escapeHtml(buttonLabel);
        const safeFormulaLabel = this._escapeHtml(formulaLabel);
        const safeDamageLabel = this._escapeHtml(damageLabel);
        html += `<button type="button" class="tirduin-summary-roll" data-roll-formula="${safeFormula}" data-roll-label="${safeFormulaLabel}" data-roll-damage="${safeDamageLabel}" data-actor-id="${actorId}" title="${rollLabel}: ${safeButtonLabel}"><i class="fas fa-dice-d20"></i> ${safeButtonLabel}</button>`;
      } else {
        html += this._escapeHtml(match[0]);
      }

      lastIndex = regex.lastIndex;
    }

    const after = source.slice(lastIndex);
    html += this._escapeHtml(after).replace(/\n/g, '<br>');
    return html;
  }

  _buildFeatureSummaryBody(item) {
    const origin = String(item.system?.origin || 'class');
    const originLabel = origin === 'race'
      ? game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Features.Origins.Race')
      : origin === 'background'
        ? game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Features.Origins.Background')
        : game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Features.Origins.Class');
    const level = Number(item.system?.level) || 1;
    const description = this._renderSummaryTextWithRollButtons(item.system?.description || '');

    return `
      <div class="tirduin-item-summary-grid">
        <div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Features.Origin')}</span><strong>${this._escapeHtml(originLabel)}</strong></div>
        <div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Features.Level')}</span><strong>${level}</strong></div>
      </div>
      ${description ? `<div class="tirduin-item-summary-description"><h4>${game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Features.Description')}</h4><p>${description}</p></div>` : ''}
    `;
  }

  _buildSpellSummaryBody(item) {
    const spellType = item.system?.spellType === 'apt'
      ? game.i18n.localize('TIRDUIN_RPS.Item.Spell.Options.Type.Apt')
      : game.i18n.localize('TIRDUIN_RPS.Item.Spell.Options.Type.Conj');
    const actionCost = item.system?.actionCost === '2'
      ? game.i18n.localize('TIRDUIN_RPS.Item.Spell.Options.Action.Two')
      : item.system?.actionCost === 'reaction'
        ? game.i18n.localize('TIRDUIN_RPS.Item.Spell.Options.Action.Reaction')
        : game.i18n.localize('TIRDUIN_RPS.Item.Spell.Options.Action.One');
    const rangeType = item.system?.rangeType === 'melee'
      ? game.i18n.localize('TIRDUIN_RPS.Item.Spell.Options.Range.Melee')
      : `${Number(item.system?.rangeFeet) || 0} ${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Units.Ft')}`;
    const area = Number(item.system?.areaFeet) || 0;
    const duration = item.system?.durationType === 'instant'
      ? game.i18n.localize('TIRDUIN_RPS.Item.Spell.Options.Duration.Instant')
      : item.system?.durationType === 'minutes'
        ? `${Number(item.system?.durationValue) || 0} ${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Options.Duration.Minutes')}`
        : `${Number(item.system?.durationValue) || 0} ${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Options.Duration.Turns')}`;
    const verbal = !!item.system?.components?.verbal;
    const somatic = !!item.system?.components?.somatic;
    const components = verbal || somatic
      ? `${verbal ? game.i18n.localize('TIRDUIN_RPS.Item.Spell.Abbr.Verbal') : ''}${verbal && somatic ? ' / ' : ''}${somatic ? game.i18n.localize('TIRDUIN_RPS.Item.Spell.Abbr.Somatic') : ''}`
      : game.i18n.localize('TIRDUIN_RPS.Item.Spell.None');
    const cost = `${Number(item.system?.costValue) || 0}`;
    const description = this._renderSummaryTextWithRollButtons(item.system?.description || '');

    return `
      <div class="tirduin-item-summary-grid">
        <div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Fields.Type')}</span><strong>${this._escapeHtml(spellType)}</strong></div>
        <div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Fields.Level')}</span><strong>${Number(item.system?.spellLevel) || 1}</strong></div>
        <div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Fields.Action')}</span><strong>${this._escapeHtml(actionCost)}</strong></div>
        <div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Fields.Cost')}</span><strong>${this._escapeHtml(cost)}</strong></div>
        <div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Fields.Range')}</span><strong>${this._escapeHtml(rangeType)}</strong></div>
        ${area > 0 ? `<div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Fields.Area')}</span><strong>${area} ${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Units.Ft')}</strong></div>` : ''}
        <div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Fields.Duration')}</span><strong>${this._escapeHtml(duration)}</strong></div>
        <div class="tirduin-item-summary-row"><span>${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Fields.Components')}</span><strong>${this._escapeHtml(components)}</strong></div>
      </div>
      ${description ? `<div class="tirduin-item-summary-description"><h4>${game.i18n.localize('TIRDUIN_RPS.Item.Spell.Fields.Description')}</h4><p>${description}</p></div>` : ''}
    `;
  }

  _buildItemSummaryContent(item) {
    const isSpell = item.type === 'spell';
    const summaryLabel = isSpell
      ? game.i18n.localize('TIRDUIN_RPS.Item.Spell.Summary')
      : game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Features.Summary');
    const typeLabel = game.i18n.localize(isSpell ? 'TYPES.Item.spell' : 'TYPES.Item.feature');
    const body = isSpell ? this._buildSpellSummaryBody(item) : this._buildFeatureSummaryBody(item);

    return `
      <article class="tirduin-item-summary-card">
        <header class="tirduin-item-summary-header">
          <img src="${this._escapeHtml(item.img || Item.DEFAULT_ICON)}" width="26" height="26" alt="${this._escapeHtml(item.name)}" />
          <div>
            <div class="tirduin-item-summary-title">${this._escapeHtml(item.name)}</div>
            <div class="tirduin-item-summary-subtitle">${this._escapeHtml(typeLabel)} · ${this._escapeHtml(summaryLabel)}</div>
          </div>
        </header>
        ${body}
      </article>
    `;
  }

  async _onItemSummary(event) {
    event.preventDefault();
    event.stopPropagation();

    const row = $(event.currentTarget).closest('[data-item-id]');
    const item = this.actor.items.get(row.data('itemId'));
    if (!item || !['feature', 'spell'].includes(item.type)) return;

    const content = this._buildItemSummaryContent(item);
    await ChatMessage.create(applyChatRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
    }));
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
   * Roll initiative with confirmation (edge + bonus).
   * If actor has a combatant in active combat, updates initiative there too.
   * @param {Event} event
   * @private
   */
  async _onInitiativeRollClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const actorRollData = this.actor.getRollData();
    const baseFormula = CONFIG.Combat?.initiative?.formula || '1d20 + @abilities.agil.mod';
    const selection = await promptInitiativeConfirmation({
      formula: baseFormula,
      rollData: actorRollData,
    });
    if (!selection) return null;

    const edgeMode = selection.edgeMode || 'none';
    const bonus = Number(selection.bonus) || 0;
    let formula = applyRollEdgeToFormula(baseFormula, edgeMode);
    if (bonus !== 0) formula = `(${formula}) + (${bonus})`;

    const roll = new Roll(formula, actorRollData);
    await roll.evaluate();

    const combat = game.combat;
    const combatant = combat?.combatants?.find((c) => c.actor?.id === this.actor.id) || null;
    if (combat && combatant) {
      await combat.setInitiative(combatant.id, roll.total);
    }

    await ChatMessage.create(applyChatRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: buildRollFlavorHtml({
        title: `${buildTypedRollTitle('ability', 'Iniciativa')}${getRollEdgeFlavorSuffix(edgeMode)}`,
        roll,
        showDiceBreakdown: true,
        showBonus: true,
      }),
    }));

    return roll;
  }

  /**
   * Handle the death-roll button: roll 1d20, then increment hope or fear pips
   * depending on whether the natural result is even (Esperanza) or odd (Miedo).
   * @param {Event} event
   * @private
   */
  async _onDeathRoll(event) {
    event.preventDefault();

    const actorRollData = this.actor.getRollData();
    const edgeMode = await promptRollConfirmation({ formula: '1d20', rollData: actorRollData });
    if (edgeMode === null) return;

    const formula = applyRollEdgeToFormula('1d20', edgeMode);
    const roll = new Roll(formula, actorRollData);
    await roll.evaluate();

    const natural = getNaturalD20Result(roll);
    const isHope = natural !== null && natural % 2 === 0;

    // Increment the corresponding death-roll counter (capped at max).
    const system = this.actor.system;
    if (isHope) {
      const current = Number(system?.deathRoll?.hope?.value) || 0;
      const max = Number(system?.deathRoll?.hope?.max) || 3;
      await this.actor.update({ 'system.deathRoll.hope.value': Math.min(current + 1, max) });
    } else {
      const current = Number(system?.deathRoll?.fear?.value) || 0;
      const max = Number(system?.deathRoll?.fear?.max) || 3;
      await this.actor.update({ 'system.deathRoll.fear.value': Math.min(current + 1, max) });
    }

    const outcomeText = getD20OutcomeText(roll);
    const edgeText = getRollEdgeFlavorSuffix(edgeMode);
    const title = buildTypedRollTitle('save', `Tirada de Muerte${edgeText}`);
    const flavor = buildRollFlavorHtml({ title, roll, outcomeText, edgeMode });
    await ChatMessage.create(applyChatRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: flavor,
    }));
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

    if (item.system?.category === 'extra') {
      return null;
    }

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
        showDiceBreakdown: true,
        showBonus: true,
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
    const attackBonus = Number(selection.attackBonus) || 0;
    const extraDamageEntries = Array.isArray(selection.extraDamageEntries)
      ? selection.extraDamageEntries
      : [];
    const fatigueRollPenalty = this.actor.type === 'character'
      ? (Number(this.actor.system?.attributes?.fatigue?.rollPenalty) || 0)
      : 0;
    const abilityValue = (Number(this.actor.system?.abilities?.[abilityKey]?.value) || 0) + fatigueRollPenalty;

    const attackBaseFormula = `1d20 + (${abilityValue}) + (${proficiency}) + (${attackBonus})`;
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
    const damageRollExtraEntries = [];
    if (damageFormula2) {
      damageRoll2 = new Roll(damageFormula2, actorRollData);
      await damageRoll2.evaluate();
    }
    for (const entry of extraDamageEntries) {
      const formula = String(entry?.formula || '').trim();
      if (!formula) continue;

      const typeKey = String(entry?.damageTypeKey || '').trim();
      const typeLabel = typeKey
        ? game.i18n.localize(CONFIG.TIRDUIN_RPS.damageTypes[typeKey] || typeKey)
        : '';

      try {
        const roll = new Roll(formula, actorRollData);
        await roll.evaluate();
        damageRollExtraEntries.push({ roll, typeLabel });
      } catch (_error) {
        ui.notifications?.warn(`La fórmula de daño adicional no es válida: ${formula}`);
        return null;
      }
    }

    const targetToken = game.user?.targets?.first();
    const targetName = targetToken?.name ?? null;
    const targetAC = targetToken?.actor
      ? (Number(targetToken.actor.system?.attributes?.armorClass?.value) || null)
      : null;

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
        damageRollExtraEntries,
        targetName,
        targetAC,
      }),
    }));

    return { attackRoll, damageRoll, damageRoll2, damageRollExtraEntries };
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

    const damageFormula = String(magic.system?.damageDie || '').trim();
    if (!damageFormula) {
      ui.notifications?.warn(`${magic.name} no tiene daño configurado.`);
      return null;
    }

    const fatigueDcPenalty = Number(this.actor.system?.attributes?.fatigue?.dcPenalty) || 0;
    const dc = Math.max(1, (Number(magic.system?.dc) || 1) + fatigueDcPenalty);
    const saveType = String(magic.system?.saveType || 'fortaleza');
    const onSaveSuccess = String(magic.system?.onSaveSuccess || 'half');
    const saveLabelMap = {
      fortaleza: 'Fortaleza',
      reflejos: 'Reflejos',
      voluntad: 'Voluntad',
    };
    const saveLabel = saveLabelMap[saveType] || 'Salvacion';

    const targetToken = game.user?.targets?.first();

    const damageRoll = new Roll(damageFormula, this.actor.getRollData());
    await damageRoll.evaluate();

    // No target: show damage directly without a save
    if (!targetToken?.actor) {
      const damageCard = buildRollFlavorHtml({
        title: buildTypedRollTitle('spell', `${magic.name} Daño`),
        roll: damageRoll,
        outcomeText: `CD ${dc} (${saveLabel})`,
        showDiceBreakdown: true,
        showBonus: true,
      });
      await ChatMessage.create(applyChatRollMode({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="tirduin-roll-bundle">${damageCard}</div>`,
      }));
      return { damageRoll };
    }

    const targetSaveBonus = this._getSaveValue(targetToken.actor, saveType);
    const saveRoll = new Roll(`1d20 + (${targetSaveBonus})`, targetToken.actor.getRollData?.() || {});
    await saveRoll.evaluate();

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
      showDiceBreakdown: true,
      showBonus: true,
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
   * Prompt weapon attack options with attribute selector, edge radios and modifiers.
  * @param {{weaponName: string, damageDie: string, damageDie2?: string, proficiency: number, actorRollData: object}} options
   * @returns {Promise<{abilityKey: 'vig'|'agil', edgeMode: string, attackBonus: number, extraDamageEntries: Array<{formula: string, damageTypeKey: string}>}|null>}
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

      const damageTypeOptions = Object.entries(CONFIG.TIRDUIN_RPS?.damageTypes || {})
        .map(([key, i18nKey]) => `<option value="${key}">${game.i18n.localize(i18nKey)}</option>`)
        .join('');

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

            <div class="weapon-roll-line">
              <p class="weapon-roll-preview" data-role="weapon-attack-preview"></p>
              <button type="button" class="weapon-roll-line-add" data-role="attack-bonus-toggle" title="Bonificador de ataque">+</button>
            </div>
            <div class="weapon-roll-inline-fields" data-role="attack-bonus-fields" style="display:none;">
              <label>
                Bonif. ataque
                <input type="number" name="tirduin-attack-bonus" value="0" step="1">
              </label>
            </div>

            <div class="weapon-roll-line">
              <p class="weapon-roll-preview" data-role="weapon-damage-preview"></p>
              <button type="button" class="weapon-roll-line-add" data-role="damage-bonus-add" title="Añadir daño adicional">+</button>
            </div>
            <p class="weapon-roll-preview" data-role="weapon-damage2-preview"></p>

            <div class="weapon-roll-damage-bonuses" data-role="damage-bonuses"></div>
            <div class="weapon-roll-extra-previews" data-role="weapon-damage-extra-previews"></div>
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
            label: 'Cancelar',
            callback: () => safeResolve(null),
          },
        },
        default: 'roll',
        classes: ['tirduin', 'tirduin-roll-dialog'],
        render: (html) => {
          const abilitySelect = html.find('select[name="tirduin-weapon-ability"]');
          const edgeRadios = html.find('input[name="tirduin-roll-edge"]');
          const attackBonusToggle = html.find('[data-role="attack-bonus-toggle"]');
          const attackBonusFields = html.find('[data-role="attack-bonus-fields"]');
          const attackBonusInput = html.find('input[name="tirduin-attack-bonus"]');
          const addDamageBonusButton = html.find('[data-role="damage-bonus-add"]');
          const damageBonusesContainer = html.find('[data-role="damage-bonuses"]');
          const attackPreview = html.find('[data-role="weapon-attack-preview"]');
          const damagePreview = html.find('[data-role="weapon-damage-preview"]');
          const damagePreview2 = html.find('[data-role="weapon-damage2-preview"]');
          const extraPreviewsContainer = html.find('[data-role="weapon-damage-extra-previews"]');

          const buildDamageBonusRow = () => `
            <div class="weapon-roll-damage-bonus-row">
              <input type="text" name="tirduin-extra-damage" value="" placeholder="Daño adicional (ej: 1d6+2)">
              <select name="tirduin-extra-damage-type">
                <option value="">Sin tipo</option>
                ${damageTypeOptions}
              </select>
              <button type="button" class="weapon-roll-damage-bonus-remove" title="Quitar">−</button>
            </div>
          `;

          const refreshPreview = () => {
            const abilityKey = String(abilitySelect.val() || 'vig');
            const edgeMode = String(html.find('input[name="tirduin-roll-edge"]:checked').val() || 'none');
            const attackBonusEnabled = attackBonusFields.is(':visible');
            const attackBonus = attackBonusEnabled
              ? (Number(attackBonusInput.val()) || 0)
              : 0;
            const fatigueRollPenalty = this.actor.type === 'character'
              ? (Number(this.actor.system?.attributes?.fatigue?.rollPenalty) || 0)
              : 0;
            const abilityValue = (Number(this.actor.system?.abilities?.[abilityKey]?.value) || 0) + fatigueRollPenalty;

            const attackBase = attackBonusEnabled
              ? `1d20 + (${abilityValue}) + (${proficiency}) + (${attackBonus})`
              : `1d20 + (${abilityValue}) + (${proficiency})`;
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
            } else {
              try {
                damagePreview2.text(`Daño 2: ${new Roll(damageFormula2, actorRollData).formula}`);
              } catch (_error) {
                damagePreview2.text(`Daño 2: ${damageFormula2}`);
              }
            }

            extraPreviewsContainer.empty();
            damageBonusesContainer.find('.weapon-roll-damage-bonus-row').each((_index, element) => {
              const row = $(element);
              const formula = String(row.find('input[name="tirduin-extra-damage"]').val() || '').trim();
              const damageTypeKey = String(row.find('select[name="tirduin-extra-damage-type"]').val() || '').trim();
              const damageTypeLabel = damageTypeKey
                ? game.i18n.localize(CONFIG.TIRDUIN_RPS.damageTypes[damageTypeKey] || damageTypeKey)
                : '';

              if (!formula) return;

              let previewText = `Daño extra${damageTypeLabel ? ` (${damageTypeLabel})` : ''}: ${formula}`;
              try {
                previewText = `Daño extra${damageTypeLabel ? ` (${damageTypeLabel})` : ''}: ${new Roll(formula, actorRollData).formula}`;
              } catch (_error) {
                previewText = `Daño extra inválido${damageTypeLabel ? ` (${damageTypeLabel})` : ''}: ${formula}`;
              }

              extraPreviewsContainer.append(`<p class="weapon-roll-preview">${previewText}</p>`);
            });
          };

          abilitySelect.on('change', refreshPreview);
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
            refreshPreview();
          });

          attackBonusToggle.on('click', () => {
            const willShow = attackBonusFields.css('display') === 'none';
            attackBonusFields.css('display', willShow ? 'grid' : 'none');
            if (!willShow) {
              attackBonusInput.val(0);
            }
            refreshPreview();
          });

          attackBonusInput.on('input change', refreshPreview);

          addDamageBonusButton.on('click', () => {
            damageBonusesContainer.append(buildDamageBonusRow());
            refreshPreview();
          });

          damageBonusesContainer.on('input change', 'input, select', refreshPreview);
          damageBonusesContainer.on('click', '.weapon-roll-damage-bonus-remove', (event) => {
            event.preventDefault();
            $(event.currentTarget).closest('.weapon-roll-damage-bonus-row').remove();
            refreshPreview();
          });

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
    const category = String(armor.system?.category || '');
    const isShield = category === 'escudo';
    const isExtra = category === 'extra';
    const updates = [];

    // Siempre actualiza el estado del item pulsado.
    updates.push(armor.update({ 'system.equipped': willEquip }));

    // Reglas de equipado:
    // - Escudo: solo uno equipado.
    // - Extra: acumulable, no desequipa otros.
    // - Armadura base (no escudo/no extra): solo una equipada.
    for (const item of this.actor.items) {
      if (item.type !== 'armor' || item.id === armor.id) continue;
      if (!willEquip) continue;
      if (!item.system?.equipped) continue;
      const itemCategory = String(item.system?.category || '');
      if (isExtra) continue;
      if (isShield && itemCategory !== 'escudo') continue;
      if (!isShield && (itemCategory === 'escudo' || itemCategory === 'extra')) continue;
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
    const mainArmor = equippedArmors.find((i) => !['escudo', 'extra'].includes(i.system?.category));
    const shield = equippedArmors.find((i) => i.system?.category === 'escudo');
    const extraBonuses = equippedArmors
      .filter((i) => i.system?.category === 'extra' && !i.system?.broken)
      .reduce((sum, i) => sum + (Number(i.system?.bonus) || 0), 0);

    let armorClass = mainArmor
      ? this._calculateArmorClassFromArmor(mainArmor.system, Boolean(mainArmor.system?.broken))
      : this._calculateUnarmoredArmorClass();

    if (shield && !shield.system?.broken) {
      armorClass += Number(shield.system?.bonus) || 0;
    }

    armorClass += extraBonuses;

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
