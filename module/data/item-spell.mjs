import TirduinRPSItemBase from "./base-item.mjs";

export default class TirduinRPSSpell extends TirduinRPSItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.spellType = new fields.StringField({
      required: true,
      blank: false,
      initial: 'conj',
      choices: ['conj', 'apt'],
    });

    schema.spellLevel = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 1,
      min: 1,
      max: 10,
    });

    schema.actionCost = new fields.StringField({
      required: true,
      blank: false,
      initial: '1',
      choices: ['1', '2', 'reaction'],
    });

    schema.costResource = new fields.StringField({
      required: true,
      blank: false,
      initial: 'hope',
      choices: ['hope', 'stress'],
    });

    schema.costValue = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 1,
      min: 0,
    });

    schema.rangeType = new fields.StringField({
      required: true,
      blank: false,
      initial: 'melee',
      choices: ['melee', 'ranged'],
    });

    schema.rangeFeet = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0,
    });

    schema.areaFeet = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0,
    });

    schema.components = new fields.SchemaField({
      verbal: new fields.BooleanField({ required: true, initial: false }),
      somatic: new fields.BooleanField({ required: true, initial: false }),
    });

    schema.durationType = new fields.StringField({
      required: true,
      blank: false,
      initial: 'instant',
      choices: ['instant', 'turns', 'minutes'],
    });

    schema.durationValue = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0,
    });

    return schema;
  }
}