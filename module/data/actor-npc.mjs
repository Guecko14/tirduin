import TirduinRPSActorBase from "./base-actor.mjs";

export default class TirduinRPSNPC extends TirduinRPSActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.attributes = new fields.SchemaField({
      armorClass: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 10})
      }),
      speed: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 20})
      }),
    });

     schema.abilities = new fields.SchemaField(Object.keys(CONFIG.TIRDUIN_RPS.abilities).reduce((obj, ability) => {
      obj[ability] = new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: -5, max: 5 }),
      });
      return obj;
    }, {}));
    
    return schema
  }

  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
    for (const key in this.abilities) {
      // Calculate the modifier using d20 rules.
      this.abilities[key].mod = this.abilities[key].value; // NPCs use the ability score directly as their modifier.
      // Handle ability label localization.
      this.abilities[key].label = game.i18n.localize(CONFIG.TIRDUIN_RPS.abilities[key]) ?? key;
    }

    this.attributes.armorClass.label = game.i18n.localize(CONFIG.TIRDUIN_RPS.attributes.armorClass);
    this.attributes.speed.label = game.i18n.localize(CONFIG.TIRDUIN_RPS.attributes.speed);

  }

  getRollData() {
    const data = {};

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@vig.mod + 4`.
    if (this.abilities) {
      for (let [k,v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    return data
  }
}