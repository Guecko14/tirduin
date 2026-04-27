import TirduinRPSDataModel from "./base-model.mjs";

export default class TirduinRPSActorBase extends TirduinRPSDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const damageTypeKeys = Object.keys(CONFIG.TIRDUIN_RPS?.damageTypes || {});
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 10 }),
      temp: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 })
    });

    schema.biography = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields

    // Generic damage modifiers for creatures (vulnerability/resistance by damage type).
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