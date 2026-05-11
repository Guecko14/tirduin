import TirduinRPSActorBase from "./base-actor.mjs";

export default class TirduinRPSCharacter extends TirduinRPSActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.hope = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 2, min: 0, max: 6 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 6, min: 0, max: 6 })
    });

    schema.stress = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 6 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 6, min: 0, max: 6 })
    });

    schema.luck = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 3 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 3, min: 0, max: 3 })
    });

    schema.deathRoll = new fields.SchemaField({
      hope: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 3 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 3, min: 0, max: 3 })
      }),
      fear: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 3 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 3, min: 0, max: 3 })
      })
    });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.hope.value = Math.max(0, Math.min(6, Number(this.hope?.value) ?? 2));
    this.hope.max = 6;

    this.stress.value = Math.max(0, Math.min(6, Number(this.stress?.value) ?? 0));
    this.stress.max = 6;

    this.luck.value = Math.max(0, Math.min(3, Number(this.luck?.value) ?? 0));
    this.luck.max = 3;
  }

  getRollData() {
    return super.getRollData();
  }
}