import TirduinRPSItemBase from "./base-item.mjs";

/**
 * Modelo de datos para items de tipo armadura.
 * Incluye CA, CA rota, VD, RA (con contador actual), Resistencia, Vigor, sigilo y peso.
 */
export default class TirduinRPSArmor extends TirduinRPSItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    // Categoría de la armadura: sin armadura, ligera, media, pesada o escudo.
    schema.category = new fields.StringField({
      required: true,
      blank: false,
      initial: 'ligera',
      choices: ['sinArmadura', 'ligera', 'media', 'pesada', 'escudo'],
    });

    // CA (Armor Class) que proporciona esta armadura cuando está intacta.
    schema.ca = new fields.NumberField({
      ...requiredInteger,
      initial: 10,
      min: 0,
    });

    // Bonificador de escudo: se suma a la CA cuando el escudo esta equipado y no roto.
    schema.bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    // Agilidad maxima permitida por la armadura cuando esta intacta.
    schema.maxAgility = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: -5,
      max: 5,
    });

    // CA que proporciona la armadura cuando está rota.
    schema.caBroken = new fields.NumberField({
      ...requiredInteger,
      initial: 10,
      min: 0,
    });

    // Agilidad maxima permitida por la armadura cuando esta rota.
    schema.maxAgilityBroken = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: -5,
      max: 5,
    });

    // VD (Valor Defensivo): representado como tirada de dados (ej. "1d6").
    schema.vd = new fields.StringField({
      required: true,
      blank: false,
      initial: '1d6',
    });

    // RA (Resistencia de Armadura) máxima: valor numérico.
    schema.ra = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    // RA actual: contador independiente de la RA máxima para el desgaste en combate.
    schema.raCurrent = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    // R (Resistencia): valor numérico más tipo de daño al que aplica.
    schema.resistance = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      // Clave de tipo de daño de CONFIG.TIRDUIN_RPS.damageTypes.
      damageType: new fields.StringField({ required: false, blank: true, initial: '' }),
    });

    // V (Vigor): valor mínimo de Vigor necesario para poder equipar la armadura.
    schema.vigor = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    // Sigilo: marcador booleano que indica si la armadura penaliza sigilo.
    schema.stealth = new fields.BooleanField({ initial: false });

    // Estado de rotura de la armadura.
    schema.broken = new fields.BooleanField({ initial: false });

    // Marca si la armadura esta equipada actualmente.
    schema.equipped = new fields.BooleanField({ initial: false });

    // Peso de la armadura en la unidad del sistema.
    schema.weight = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    return schema;
  }

  prepareDerivedData() {
    const maxRa = Math.max(0, Number(this.ra) || 0);
    const currentRa = Math.max(0, Math.min(Number(this.raCurrent) || 0, maxRa));
    const maxAgility = Math.max(-5, Math.min(5, Number(this.maxAgility) || 0));
    const maxAgilityBroken = Math.max(-5, Math.min(5, Number(this.maxAgilityBroken) || 0));

    this.ra = maxRa;
    this.raCurrent = currentRa;
    this.maxAgility = maxAgility;
    this.maxAgilityBroken = maxAgilityBroken;

    // Al alcanzar el maximo de RA, la armadura se marca automaticamente como rota.
    if (maxRa > 0 && currentRa >= maxRa) {
      this.broken = true;
    }
  }

}
