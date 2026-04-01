import TirduinRPSDataModel from "./base-model.mjs";

export default class TirduinRPSItemBase extends TirduinRPSDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const damageTypeKeys = Object.keys(CONFIG.TIRDUIN_RPS?.damageTypes || {});
    const schema = {};

    schema.description = new fields.StringField({ required: true, blank: true });

    // Generic damage modifiers for object-like items.
    const buildDamageModifierSchema = () => damageTypeKeys.reduce((obj, key) => {
      obj[key] = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
      return obj;
    }, {});

    schema.damageModifiers = new fields.SchemaField({
      vulnerability: new fields.SchemaField(buildDamageModifierSchema()),
      resistance: new fields.SchemaField(buildDamageModifierSchema()),
    });

    return schema;
  }

}