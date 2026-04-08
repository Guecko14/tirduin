export const TIRDUIN_RPS = {};

/**
 * The set of Ability Scores used within the system.
 * @type {Object}
 */
TIRDUIN_RPS.abilities = {
  vig: 'TIRDUIN_RPS.Ability.Vig.long',
  agil: 'TIRDUIN_RPS.Ability.Agil.long',
  ment: 'TIRDUIN_RPS.Ability.Ment.long',
  inst: 'TIRDUIN_RPS.Ability.Inst.long',
  pre: 'TIRDUIN_RPS.Ability.Pre.long',
};

TIRDUIN_RPS.abilityAbbreviations = {
  vig: 'TIRDUIN_RPS.Ability.Vig.abbr',
  agil: 'TIRDUIN_RPS.Ability.Agil.abbr',
  ment: 'TIRDUIN_RPS.Ability.Ment.abbr',
  inst: 'TIRDUIN_RPS.Ability.Inst.abbr',
  pre: 'TIRDUIN_RPS.Ability.Pre.abbr',
};

TIRDUIN_RPS.attributes = {
  level: 'TIRDUIN_RPS.attributes.level.long',
  armorClass: 'TIRDUIN_RPS.attributes.armorClass.long',
  speed: 'TIRDUIN_RPS.attributes.speed.long',
  exp: 'TIRDUIN_RPS.attributes.exp.long'
};

TIRDUIN_RPS.skills = {
  atletismo: 'TIRDUIN_RPS.Skills.atletismo',
  sigilo: 'TIRDUIN_RPS.Skills.sigilo',
  juegoManos: 'TIRDUIN_RPS.Skills.juegoManos',
  acrobacias: 'TIRDUIN_RPS.Skills.acrobacias',
  investigacion: 'TIRDUIN_RPS.Skills.investigacion',
  artesania: 'TIRDUIN_RPS.Skills.artesania',
  historia: 'TIRDUIN_RPS.Skills.historia',
  religion: 'TIRDUIN_RPS.Skills.religion',
  aether: 'TIRDUIN_RPS.Skills.aether',
  naturaleza: 'TIRDUIN_RPS.Skills.naturaleza',
  medicina: 'TIRDUIN_RPS.Skills.medicina',
  tratoAnimales: 'TIRDUIN_RPS.Skills.tratoAnimales',
  percepcion: 'TIRDUIN_RPS.Skills.percepcion',
  perspicacia: 'TIRDUIN_RPS.Skills.perspicacia',
  supervivencia: 'TIRDUIN_RPS.Skills.supervivencia',
  persuasion: 'TIRDUIN_RPS.Skills.persuasion',
  enganar: 'TIRDUIN_RPS.Skills.enganar',
  interpretacion: 'TIRDUIN_RPS.Skills.interpretacion',
  intimidacion: 'TIRDUIN_RPS.Skills.intimidacion'
};

/**
 * Spell domains catalog used by spell-related selects.
 * @type {Object<string, string>}
 */
TIRDUIN_RPS.spellDomains = {
  conocimiento: 'TIRDUIN_RPS.Item.Spell.Domains.conocimiento',
  piromancia: 'TIRDUIN_RPS.Item.Spell.Domains.piromancia',
  naturaleza: 'TIRDUIN_RPS.Item.Spell.Domains.naturaleza',
  tirador: 'TIRDUIN_RPS.Item.Spell.Domains.tirador',
  espiritus: 'TIRDUIN_RPS.Item.Spell.Domains.espiritus',
  sombra: 'TIRDUIN_RPS.Item.Spell.Domains.sombra',
  valor: 'TIRDUIN_RPS.Item.Spell.Domains.valor',
  filo: 'TIRDUIN_RPS.Item.Spell.Domains.filo',
  arte: 'TIRDUIN_RPS.Item.Spell.Domains.arte',
  guerra: 'TIRDUIN_RPS.Item.Spell.Domains.guerra',
  oscuridad: 'TIRDUIN_RPS.Item.Spell.Domains.oscuridad',
  muerte: 'TIRDUIN_RPS.Item.Spell.Domains.muerte',
};

/**
 * Generic grouped damage types for items, spells, effects and states.
 * Keep this centralized so every screen references the same vocabulary.
 * @type {Object<string, string>}
 */
TIRDUIN_RPS.damageTypeGroups = {
  physical: 'TIRDUIN_RPS.Damage.Group.physical',
  elemental: 'TIRDUIN_RPS.Damage.Group.elemental',
  uncategorized: 'TIRDUIN_RPS.Damage.Group.uncategorized',
};

/**
 * Flat map for generic selectors where only the final damage type matters.
 * @type {Object<string, string>}
 */
TIRDUIN_RPS.damageTypes = {
  slashingPiercing: 'TIRDUIN_RPS.Damage.Type.slashingPiercing',
  slashing: 'TIRDUIN_RPS.Damage.Type.slashing',
  piercing: 'TIRDUIN_RPS.Damage.Type.piercing',
  bludgeoning: 'TIRDUIN_RPS.Damage.Type.bludgeoning',
  acid: 'TIRDUIN_RPS.Damage.Type.acid',
  cold: 'TIRDUIN_RPS.Damage.Type.cold',
  fire: 'TIRDUIN_RPS.Damage.Type.fire',
  lightning: 'TIRDUIN_RPS.Damage.Type.lightning',
  sonic: 'TIRDUIN_RPS.Damage.Type.sonic',
  psychic: 'TIRDUIN_RPS.Damage.Type.psychic',
  necrotic: 'TIRDUIN_RPS.Damage.Type.necrotic',
  poison: 'TIRDUIN_RPS.Damage.Type.poison',
  aetherMagic: 'TIRDUIN_RPS.Damage.Type.aetherMagic',
};

/**
 * Grouped definition to build categorized UIs without duplicating keys.
 * @type {Object<string, string[]>}
 */
TIRDUIN_RPS.damageTypesByGroup = {
  physical: ['slashingPiercing', 'slashing', 'piercing', 'bludgeoning'],
  elemental: ['acid', 'cold', 'fire', 'lightning'],
  uncategorized: ['sonic', 'psychic', 'necrotic', 'poison', 'aetherMagic'],
};

/**
 * Generic altered states catalog.
 * For now this only defines name/description and does not apply combat logic.
 * @type {Object<string, {label: string, description: string}>}
 */
TIRDUIN_RPS.alteredStates = {
  blinded: {
    label: 'TIRDUIN_RPS.AlteredState.blinded.label',
    description: 'TIRDUIN_RPS.AlteredState.blinded.description',
  },
  deafened: {
    label: 'TIRDUIN_RPS.AlteredState.deafened.label',
    description: 'TIRDUIN_RPS.AlteredState.deafened.description',
  },
  silenced: {
    label: 'TIRDUIN_RPS.AlteredState.silenced.label',
    description: 'TIRDUIN_RPS.AlteredState.silenced.description',
  },
  confused: {
    label: 'TIRDUIN_RPS.AlteredState.confused.label',
    description: 'TIRDUIN_RPS.AlteredState.confused.description',
  },
  frightened: {
    label: 'TIRDUIN_RPS.AlteredState.frightened.label',
    description: 'TIRDUIN_RPS.AlteredState.frightened.description',
  },
  paralyzed: {
    label: 'TIRDUIN_RPS.AlteredState.paralyzed.label',
    description: 'TIRDUIN_RPS.AlteredState.paralyzed.description',
  },
  restrained: {
    label: 'TIRDUIN_RPS.AlteredState.restrained.label',
    description: 'TIRDUIN_RPS.AlteredState.restrained.description',
  },
  poisoned: {
    label: 'TIRDUIN_RPS.AlteredState.poisoned.label',
    description: 'TIRDUIN_RPS.AlteredState.poisoned.description',
  },
  vulnerable: {
    label: 'TIRDUIN_RPS.AlteredState.vulnerable.label',
    description: 'TIRDUIN_RPS.AlteredState.vulnerable.description',
  },
  charmed: {
    label: 'TIRDUIN_RPS.AlteredState.charmed.label',
    description: 'TIRDUIN_RPS.AlteredState.charmed.description',
  },
  prone: {
    label: 'TIRDUIN_RPS.AlteredState.prone.label',
    description: 'TIRDUIN_RPS.AlteredState.prone.description',
  },
  stunned: {
    label: 'TIRDUIN_RPS.AlteredState.stunned.label',
    description: 'TIRDUIN_RPS.AlteredState.stunned.description',
  },
  bleeding: {
    label: 'TIRDUIN_RPS.AlteredState.bleeding.label',
    description: 'TIRDUIN_RPS.AlteredState.bleeding.description',
  },
  fatigue: {
    label: 'TIRDUIN_RPS.AlteredState.fatigue.label',
    description: 'TIRDUIN_RPS.AlteredState.fatigue.description',
  },
};