import TirduinRPSActorBase from "./base-actor.mjs";

export default class TirduinRPSCharacter extends TirduinRPSActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.attributes = new fields.SchemaField({
      level: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 })
      }),
      armorClass: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 })
      }),
      speed: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 20, min: 0 }),
        extra: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      }),
      fatigue: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 })
      }),
      slotsExtra: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      }),
    });

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

    schema.details = new fields.SchemaField({
      race: new fields.StringField({ required: true, nullable: false, initial: '' }),
      className: new fields.StringField({
        required: true,
        nullable: false,
        initial: 'combatiente',
        choices: ['combatiente', 'especialista', 'canalizador']
      }),
      background: new fields.StringField({ required: true, nullable: false, initial: '' }),
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

    // Iterate over ability names and create a new SchemaField for each.
    schema.abilities = new fields.SchemaField(Object.keys(CONFIG.TIRDUIN_RPS.abilities).reduce((obj, ability) => {
      obj[ability] = new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: -5, max: 5 }),
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

    return schema;
  }

  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
    for (const key in this.abilities) {
      // Calculate the modifier using d20 rules.
      this.abilities[key].mod = this.abilities[key].value;
      // Handle ability label localization.
      this.abilities[key].label = game.i18n.localize(CONFIG.TIRDUIN_RPS.abilities[key]) ?? key;
    }

    this.attributes.level.label = game.i18n.localize(CONFIG.TIRDUIN_RPS.attributes.level);
    this.attributes.armorClass.label = game.i18n.localize(CONFIG.TIRDUIN_RPS.attributes.armorClass);
    this.attributes.speed.label = game.i18n.localize(CONFIG.TIRDUIN_RPS.attributes.speed);

    const skillAbilities = {
      atletismo: 'vig',
      sigilo: 'agil',
      juegoManos: 'agil',
      acrobacias: 'agil',
      investigacion: 'ment',
      artesania: 'ment',
      historia: 'ment',
      religion: 'ment',
      aether: 'ment',
      naturaleza: 'ment',
      medicina: 'ment',
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
    const fatigueLevel = Math.max(0, Math.min(5, Number(this.attributes?.fatigue?.value) || 0));
    // Fatiga usa una progresión no lineal definida por las reglas del sistema.
    const fatigueEffects = {
      0: { rollPenalty: 0, speedPenalty: 0 },
      1: { rollPenalty: -2, speedPenalty: -5 },
      2: { rollPenalty: -3, speedPenalty: -10 },
      3: { rollPenalty: -4, speedPenalty: -15 },
      4: { rollPenalty: -5, speedPenalty: -20 },
      5: { rollPenalty: -5, speedPenalty: -20, isDeadly: true },
    };
    const fatigueEffect = fatigueEffects[fatigueLevel] || fatigueEffects[0];

    this.attributes.fatigue.value = fatigueLevel;
    this.attributes.fatigue.label = game.i18n.localize('TIRDUIN_RPS.AlteredState.fatigue.label');
    this.attributes.fatigue.rollPenalty = fatigueEffect.rollPenalty;
    this.attributes.fatigue.dcPenalty = fatigueEffect.rollPenalty;
    this.attributes.fatigue.speedPenalty = fatigueEffect.speedPenalty;
    this.attributes.fatigue.isDeadly = Boolean(fatigueEffect.isDeadly);

    const sourceHasHope = foundry.utils.hasProperty(this._source ?? {}, 'system.hope');
    const legacyPowerValue = Number(this.power?.value) || 0;
    const currentHope = sourceHasHope
      ? (Number(this.hope?.value) || 0)
      : legacyPowerValue;
    // Rehidrata Esperanza desde power en actores previos a la migración del recurso.
    this.hope.value = Math.max(0, Math.min(6, currentHope));
    this.hope.max = 6;

    this.stress.value = Math.max(0, Math.min(6, Number(this.stress?.value) || 0));
    this.stress.max = 6;

    this.luck.value = Math.max(0, Math.min(3, Number(this.luck?.value) || 0));
    this.luck.max = 3;

    // Character speed is derived from agility using the system progression table.
    const speedByAgility = {
      1: 25,
      2: 30,
      3: 35,
      4: 35,
      5: 40,
    };
    const baseSpeed = agil <= 0
      ? 20
      : agil >= 5
        ? 40
        : (speedByAgility[agil] ?? 20);
    const extraSpeed = Math.max(0, Number(this.attributes?.speed?.extra) || 0);
    this.attributes.speed.extra = extraSpeed;
    this.attributes.speed.value = Math.max(0, baseSpeed + this.attributes.fatigue.speedPenalty + extraSpeed);

    this.saves = {
      fortaleza: {
        label: game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Saves.Fortaleza'),
        value: (vig * 2) + this.attributes.fatigue.rollPenalty,
      },
      reflejos: {
        label: game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Saves.Reflejos'),
        value: (agil + inst) + this.attributes.fatigue.rollPenalty,
      },
      voluntad: {
        label: game.i18n.localize('TIRDUIN_RPS.CharacterSheet.Saves.Voluntad'),
        value: (ment + pre) + this.attributes.fatigue.rollPenalty,
      },
    };

  }

  getRollData() {
    const data = {};
    const fatigueRollPenalty = Number(this.attributes?.fatigue?.rollPenalty) || 0;

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@vig.mod + 4`.
    if (this.abilities) {
      for (let [k,v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
        data[k].mod = (Number(data[k].mod) || 0) + fatigueRollPenalty;
      }

      // Sobrescribe también el árbol de abilities para las fórmulas que usan
      // rutas del tipo @abilities.agil.mod dentro de plantillas y macros.
      data.abilities = foundry.utils.deepClone(this.abilities);
      for (const ability of Object.values(data.abilities)) {
        ability.mod = (Number(ability.mod) || 0) + fatigueRollPenalty;
      }
    }

    data.lvl = this.attributes.level.value;
    data.fatigue = {
      value: Number(this.attributes?.fatigue?.value) || 0,
      rollPenalty: fatigueRollPenalty,
      dcPenalty: Number(this.attributes?.fatigue?.dcPenalty) || 0,
    };

    return data
  }
}