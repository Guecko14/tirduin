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

    // CA que proporciona la armadura cuando está rota.
    schema.caBroken = new fields.NumberField({
      ...requiredInteger,
      initial: 10,
      min: 0,
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

    // Peso de la armadura en la unidad del sistema.
    schema.weight = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    return schema;
  }

}
