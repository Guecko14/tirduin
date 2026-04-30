import TirduinRPSDataModel from "./base-model.mjs";

export default class TirduinRPSItemBase extends TirduinRPSDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const damageTypeKeys = Object.keys(CONFIG.TIRDUIN_RPS?.damageTypes || {});
    const schema = {};

    schema.description = new fields.StringField({ required: true, blank: true });

    return schema;
  }

}