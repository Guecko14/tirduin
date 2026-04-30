import TirduinRPSActorBase from "./base-actor.mjs";

export default class TirduinRPSNPC extends TirduinRPSActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.attributes = new fields.SchemaField({
      armorClass: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 10 })
      }),
      speed: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 20 })
      }),
      slotsExtra: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      }),
    });

    schema.details = new fields.SchemaField({
      size: new fields.StringField({
        required: true,
        nullable: false,
        initial: 'mediano',
        choices: ['diminuto', 'pequeno', 'mediano', 'grande', 'enorme', 'gargantuesco']
      }),
    });

    schema.money = new fields.SchemaField({
      gold: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      silver: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      copper: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    schema.abilities = new fields.SchemaField(Object.keys(CONFIG.TIRDUIN_RPS.abilities).reduce((obj, ability) => {
      obj[ability] = new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      });
      return obj;
    }, {}));

    const skillNames = [
      'atletismo', 'sigilo', 'juegoManos', 'acrobacias',
      'investigacion', 'artesania', 'historia', 'religion', 'aether', 'naturaleza', 'medicina',
      'tratoAnimales', 'percepcion', 'perspicacia', 'supervivencia',
      'persuasion', 'enganar', 'interpretacion', 'intimidacion'
    ];

    schema.skills = new fields.SchemaField(skillNames.reduce((obj, skill) => {
      obj[skill] = new fields.SchemaField({
        rank: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
        bonus: new fields.NumberField({ ...requiredInteger, initial: 0 })
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

    const skillAbilities = {
      atletismo: 'vig',
      sigilo: 'agil',
      juegoManos: 'agil',
      acrobacias: 'agil',
      tratoAnimales: 'inst',
      percepcion: 'inst',
      perspicacia: 'inst',
      supervivencia: 'inst',
      persuasion: 'pre',
      enganar: 'pre',
      interpretacion: 'pre',
      intimidacion: 'pre'
    };

    if (this.skills) {
      for (const key of Object.keys(this.skills)) {
        const skill = this.skills[key];
        skill.label = game.i18n.localize(CONFIG.TIRDUIN_RPS.skills[key]) || key;
        skill.ability = skillAbilities[key] ? skillAbilities[key].toUpperCase() : '-';
      }
    }

    const vig = Number(this.abilities?.vig?.value) || 0;
    const agil = Number(this.abilities?.agil?.value) || 0;
    const inst = Number(this.abilities?.inst?.value) || 0;
    const ment = Number(this.abilities?.ment?.value) || 0;
    const pre = Number(this.abilities?.pre?.value) || 0;

    this.saves = {
      fortaleza: {
        label: 'Fortaleza',
        value: (vig * 2),
      },
      reflejos: {
        label: 'Reflejos',
        value: (agil + inst),
      },
      voluntad: {
        label: 'Voluntad',
        value: (ment + pre),
      },
    };

  }

  getRollData() {
    const data = {};

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@vig.mod + 4`.
    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    return data
  }
}