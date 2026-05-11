/**
 * Clase base para ActorSheets de Tirduin.
 * Centraliza listeners que se repiten en Personajes, NPCs y Botín.
 */
export default class TirduinBaseActorSheet extends ActorSheet {
    activateListeners(html) {
        super.activateListeners(html);

        // CRUD de Items unificado
        html.find('.item-create').click(this._onItemCreate.bind(this));
        html.find('.item-edit').click(this._onItemEdit.bind(this));
        html.find('.item-delete').click(this._onItemDelete.bind(this));

        // Toggle de colapsables (Dotes, Conjuros y Especiales)
        html.find('.character-feature-title-row, .special-item-main, .character-spell-title-row').click(ev => {
            const item = this._getItemFromEvent(ev);
            if (item) item.update({ "flags.tirduin.collapsed": !item.flags.tirduin?.collapsed });
        });
    }

    /**
     * Método auxiliar para obtener un Item desde un evento del DOM.
     * Centraliza los selectores de los elementos de lista.
     * @param {Event} event 
     * @returns {Item|null}
     * @private
     */
    _getItemFromEvent(event) {
        const li = $(event.currentTarget).parents(".item, .npc-object-item, .character-feature-item, .character-spell-item, .special-item");
        return this.actor.items.get(li.data("itemId")) || null;
    }

    _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const itemData = {
            name: `Nuevo ${header.dataset.type}`,
            type: header.dataset.type,
            system: header.dataset.category ? { category: header.dataset.category } : {}
        };
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    _onItemEdit(event) {
        event.preventDefault();
        const item = this._getItemFromEvent(event);
        return item?.sheet.render(true);
    }

    _onItemDelete(event) {
        event.preventDefault();
        const item = this._getItemFromEvent(event);
        return item?.delete();
    }
}