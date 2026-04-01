import TirduinRPSItemBase from "./base-item.mjs";

export default class TirduinRPSFear extends TirduinRPSItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.cost = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0,
    });

    return schema;
  }

}
