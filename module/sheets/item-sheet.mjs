import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
const BaseItemSheet = foundry.appv1?.sheets?.ItemSheet || ItemSheet;

export class TirduinRPSItemSheet extends BaseItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['tirduin', 'sheet', 'item'],
      width: 520,
      height: 480,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'description',
        },
      ],
    });
  }

  /** @override */
  get template() {
    const path = 'systems/tirduin/templates/item';
    // Las acciones de miedo reutilizan el tipo feature, pero con una sheet dedicada.
    if (this.item.type === 'feature' && this.item.system.category === 'fear') {
      return `${path}/item-fear-sheet.hbs`;
    }
    // Los especiales del NPC reutilizan feature, pero con una sheet simplificada.
    if (this.item.type === 'feature' && this.item.system.category === 'special') {
      return `${path}/item-special-sheet.hbs`;
    }
    // Las notas del personaje reutilizan la misma sheet simplificada.
    if (this.item.type === 'feature' && this.item.system.category === 'note') {
      return `${path}/item-special-sheet.hbs`;
    }
    // Acciones mágicas del NPC: feature con editor específico.
    if (this.item.type === 'feature' && this.item.system.category === 'magicAction') {
      return `${path}/item-magic-action-sheet.hbs`;
    }
    // Armas y armaduras tienen sus propias sheets de edición.
    if (this.item.type === 'weapon') return `${path}/item-weapon-sheet.hbs`;
    if (this.item.type === 'armor') return `${path}/item-armor-sheet.hbs`;
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.hbs`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.hbs`.
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Construye el contexto comun para cualquier sheet de item.
    // Retrieve base data structure.
    const context = super.getData();

    // Use a safe clone of the item data for further operations.
    const itemData = this.document.toPlainObject();

    // Se mantiene el enriquecido para las sheets que usan editor rico.
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item.system.description,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Necessary in v11, can be removed in v12
        async: true,
        // Data to fill in for inline rolls
        rollData: this.item.getRollData(),
        // Relative UUID resolution
        relativeTo: this.item,
      }
    );

    // Add the item's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.flags = itemData.flags;

    // Adding a pointer to CONFIG.TIRDUIN_RPS
    context.config = CONFIG.TIRDUIN_RPS;

    // Normaliza efectos para el partial comun de efectos.
    context.effects = prepareActiveEffectCategories(this.item.effects);

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // En armaduras, permite añadir hasta 3 resistencias extra (R2-R4).
    html.on('click', '.armor-add-resistance', async (ev) => {
      ev.preventDefault();
      if (this.item.type !== 'armor') return;

      const paths = [
        'system.resistance2.enabled',
        'system.resistance3.enabled',
        'system.resistance4.enabled',
      ];

      const nextPath = paths.find((path) => !foundry.utils.getProperty(this.item, path));
      if (!nextPath) return;

      await this.item.update({ [nextPath]: true });
    });

    html.on('click', '.armor-remove-resistance', async (ev) => {
      ev.preventDefault();
      if (this.item.type !== 'armor') return;

      const slot = Number(ev.currentTarget?.dataset?.slot) || 0;
      if (![2, 3, 4].includes(slot)) return;

      const update = {
        [`system.resistance${slot}.enabled`]: false,
        [`system.resistance${slot}.value`]: 0,
        [`system.resistance${slot}.damageType`]: '',
      };

      await this.item.update(update);
    });

    // Roll handlers, click handlers, etc. would go here.

    // Active Effect management
    html.on('click', '.effect-control', (ev) =>
      onManageActiveEffect(ev, this.item)
    );
  }
}
