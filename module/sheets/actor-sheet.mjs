import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

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
      }
      // Las acciones de miedo son features marcadas con category=fear.
      else if (i.type === 'feature' && i.system.category === 'fear') {
        fearActions.push(i);
      }
      // Las entradas especiales del NPC usan feature con category=special.
      else if (i.type === 'feature' && i.system.category === 'special') {
        specialActions.push(i);
      }
      // El resto de features siguen apareciendo en la seccion de dotes.
      else if (i.type === 'feature') {
        features.push(i);
      }
      // Conjuros agrupados por nivel para el partial de spells.
      else if (i.type === 'spell') {
        if (i.system.spellLevel != undefined) {
          spells[i.system.spellLevel].push(i);
        }
      }
    }

    // Assign and return
    context.gear = gear;
    context.features = features;
    context.fearActions = fearActions;
    context.specialActions = specialActions;
    context.spells = spells;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

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
    });

    // Abre cualquier item embebido usando el data-item-id del bloque pulsado.
    html.on('click', '.item-edit', (ev) => {
      const row = $(ev.currentTarget).closest('[data-item-id]');
      const item = this.actor.items.get(row.data('itemId'));
      if (!item) return;
      item.sheet.render(true);
    });

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
    // Da nombres utiles por defecto segun la categoria del item creado.
    const name = data.category === 'fear'
      ? 'Nueva accion de miedo'
      : data.category === 'special'
        ? 'Nueva habilidad especial'
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
  _onRoll(event) {
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
      let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }
}
