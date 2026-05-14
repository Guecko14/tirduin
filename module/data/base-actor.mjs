import TirduinRPSDataModel from "./base-model.mjs";

export default class TirduinRPSActorBase extends TirduinRPSDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 10 }),
      temp: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 })
    });

    schema.attributes = new fields.SchemaField({
      armorClass: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 })
      }),
      speed: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 20, min: 0 }),
        extra: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      }),
      slotsExtra: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      }),
      fatigue: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 })
      }),
      level: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 })
      }),
    });

    schema.details = new fields.SchemaField({
      size: new fields.StringField({
        required: true,
        nullable: false,
        initial: 'mediano',
        choices: ['diminuto', 'pequeno', 'mediano', 'grande', 'enorme', 'gargantuesco']
      }),
      spellAttribute: new fields.StringField({
        required: true,
        nullable: false,
        initial: 'ment',
        choices: ['ment', 'inst', 'pre']
      }),
    });

    const spellDomains = Object.keys(CONFIG.TIRDUIN_RPS.spellDomains || {});
    schema.spellcasting = new fields.SchemaField({
      primaryDomain: new fields.StringField({ required: false, nullable: false, blank: true, initial: '', choices: ['', ...spellDomains] }),
      secondaryDomain: new fields.StringField({ required: false, nullable: false, blank: true, initial: '', choices: ['', ...spellDomains] }),
      domainBenefit: new fields.StringField({ required: true, nullable: false, blank: true, initial: '' }),
      proficiency: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
      spellAbilityValue: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      attackBonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      attackExtra: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      cdComputed: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      cdExtra: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.money = new fields.SchemaField({
      gold: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      silver: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      copper: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    schema.biography = new fields.StringField({ required: true, blank: true });

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

    return schema;
  }

  prepareDerivedData() {
    const vig = Number(this.abilities?.vig?.value) || 0;
    const agil = Number(this.abilities?.agil?.value) || 0;
    const inst = Number(this.abilities?.inst?.value) || 0;
    const ment = Number(this.abilities?.ment?.value) || 0;
    const pre = Number(this.abilities?.pre?.value) || 0;

    for (const key in this.abilities) {
      this.abilities[key].mod = this.abilities[key].value;
      this.abilities[key].label = game.i18n.localize(CONFIG.TIRDUIN_RPS.abilities[key]) ?? key;
    }

    // Localizaciones básicas
    this.attributes.armorClass.label = game.i18n.localize(CONFIG.TIRDUIN_RPS.attributes.armorClass);
    this.attributes.speed.label = game.i18n.localize(CONFIG.TIRDUIN_RPS.attributes.speed);
    this.attributes.level.label = game.i18n.localize(CONFIG.TIRDUIN_RPS.attributes.level);

    // Lógica de Fatiga común
    const fatigueLevel = Math.max(0, Math.min(5, Number(this.attributes.fatigue.value) || 0));
    const fatigueEffects = {
      0: { rollPenalty: 0, speedPenalty: 0 },
      1: { rollPenalty: -2, speedPenalty: -5 },
      2: { rollPenalty: -3, speedPenalty: -10 },
      3: { rollPenalty: -4, speedPenalty: -15 },
      4: { rollPenalty: -5, speedPenalty: -20 },
      5: { rollPenalty: -5, speedPenalty: -20, isDeadly: true },
    };
    const fatigueEffect = fatigueEffects[fatigueLevel] || fatigueEffects[0];

    this.attributes.fatigue.label = game.i18n.localize('TIRDUIN_RPS.AlteredState.fatigue.label');
    this.attributes.fatigue.rollPenalty = fatigueEffect.rollPenalty;
    this.attributes.fatigue.speedPenalty = fatigueEffect.speedPenalty;
    this.attributes.fatigue.isDeadly = Boolean(fatigueEffect.isDeadly);

    // Aplicar penalizador de fatiga a los modificadores de tirada de atributos
    for (const key in this.abilities) {
      this.abilities[key].rollMod = this.abilities[key].value + this.attributes.fatigue.rollPenalty;
    }

    // Salvaciones comunes
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

    // Lógica de Magia común
    const spellAttrName = this.details?.spellAttribute || 'inst';
    const spellAbilityValue = (Number(this.abilities?.[spellAttrName]?.value) ?? 0) + this.attributes.fatigue.rollPenalty;

    this.spellcasting.spellAbilityValue = spellAbilityValue;
    this.spellcasting.spellAbilityLabel = game.i18n.localize(CONFIG.TIRDUIN_RPS.abilities[spellAttrName]) || spellAttrName;
    this.spellcasting.attackAbility = spellAttrName;
    this.spellcasting.attackBonus = (Number(this.spellcasting.proficiency) || 0) + spellAbilityValue + (Number(this.spellcasting.attackExtra) || 0);
    this.spellcasting.cdComputed = 10 + spellAbilityValue + (Number(this.attributes.level.value) || 1) + (Number(this.spellcasting.cdExtra) || 0);

    // Lógica de Velocidad unificada:
    // Para personajes se deriva de la agilidad, para otros tipos se usa el valor base del _source.
    // Al usar el valor original como ancla, permitimos que la velocidad se restaure al bajar la fatiga.
    let baseSpeed = 20;
    if (this.parent.type === "character") {
      const speedByAgility = { 1: 25, 2: 30, 3: 35, 4: 35, 5: 40 };
      baseSpeed = agil <= 0 ? 20 : agil >= 5 ? 40 : (speedByAgility[agil] ?? 20);
    } else {
      baseSpeed = Number(this._source.attributes?.speed?.value ?? 20);
    }

    const extraSpeed = Number(this.attributes.speed.extra ?? 0);
    this.attributes.speed.value = Math.max(0, baseSpeed + extraSpeed + fatigueEffect.speedPenalty);

    // Lógica de Habilidades
    const skillAbilitiesMapping = {
      atletismo: 'vig', sigilo: 'agil', juegoManos: 'agil', acrobacias: 'agil',
      investigacion: 'ment', artesania: 'ment', historia: 'ment', religion: 'ment', aether: 'ment', naturaleza: 'ment', medicina: 'ment',
      tratoAnimales: 'inst', percepcion: 'inst', perspicacia: 'inst', supervivencia: 'inst',
      persuasion: 'pre', enganar: 'pre', interpretacion: 'pre', intimidacion: 'pre'
    };

    // Preparar lista de habilidades (skillList) procesada
    const npcSkillKeys = ['atletismo', 'sigilo', 'juegoManos', 'acrobacias', 'tratoAnimales', 'percepcion', 'perspicacia', 'supervivencia', 'persuasion', 'enganar', 'interpretacion', 'intimidacion'];
    const isNPC = this.parent.type === 'npc';
    const skillKeys = isNPC ? npcSkillKeys : Object.keys(CONFIG.TIRDUIN_RPS.skills || {});

    if (this.skills) {
      this.skillList = skillKeys.map(key => {
        const skill = this.skills[key] || {};
        const abilityKey = skillAbilitiesMapping[key];
        const abilityVal = Number(this.abilities[abilityKey]?.value) || 0;
        const label = game.i18n.localize(CONFIG.TIRDUIN_RPS.skills[key]) || key;
        return {
          key,
          label,
          labelShort: label.length > 18 ? `${label.slice(0, 15)}…` : label,
          ability: abilityKey?.toUpperCase() || '-',
          rank: Number(skill.rank) || 0,
          bonus: Number(skill.bonus) || 0,
          total: abilityVal + (Number(skill.rank) || 0) + (Number(skill.bonus) || 0) + this.attributes.fatigue.rollPenalty
        };
      }).sort((a, b) => a.label.localeCompare(b.label));
    }
  }

  getRollData() {
    const data = {};
    const penalty = this.attributes?.fatigue?.rollPenalty || 0;
    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
        data[k].mod = (Number(v.value) || 0) + penalty;
      }
      // Añadir árbol de abilities para fórmulas @abilities.vig.mod
      data.abilities = foundry.utils.deepClone(this.abilities);
      for (const ability of Object.values(data.abilities)) {
        ability.mod = (Number(ability.value) || 0) + penalty;
      }
    }
    data.lvl = this.attributes?.level?.value || 1;
    return data;
  }

}