import TirduinRPSItemBase from "./base-item.mjs";

/**
 * Modelo de datos para items de tipo arma.
 * Define categoría, subcategoría, dado de daño, alcance, grip, peso y propiedades.
 */
export default class TirduinRPSWeapon extends TirduinRPSItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    // Categoría principal del arma: simple, marcial o mágica.
    schema.category = new fields.StringField({
      required: true,
      blank: false,
      initial: 'simple',
      choices: ['simple', 'marcial', 'magica'],
    });

    // Subcategoría de uso: cuerpo a cuerpo o a distancia.
    schema.subcategory = new fields.StringField({
      required: true,
      blank: false,
      initial: 'melee',
      choices: ['melee', 'distancia'],
    });

    // Competencia del arma con la misma escala de las skills (0..5).
    schema.proficiency = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0,
      max: 5,
    });

    // Dado de daño del arma expresado como cadena (ej. "1d6", "2d8").
    schema.damageDie = new fields.StringField({
      required: true,
      blank: false,
      initial: '1d6',
    });

    // Tipo de daño del daño principal.
    schema.damageType = new fields.StringField({
      required: true,
      blank: false,
      initial: 'slashingPiercing',
    });

    // Segundo dado de daño opcional para armas con doble componente.
    schema.damageDie2 = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
    });

    // Tipo del segundo daño (opcional, ligado a damageDie2).
    schema.damageType2 = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
    });

    // Alcance del arma en formato libre (ej. "5 ft", "Toque", "20/60").
    schema.range = new fields.StringField({
      required: true,
      blank: false,
      initial: '5 ft',
    });

    // Munición/proyectiles restantes para armas a distancia.
    schema.projectiles = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0,
    });

    // Garras necesarias para empuñar el arma: "1" (una mano) o "2" (dos manos).
    schema.grip = new fields.StringField({
      required: true,
      blank: false,
      initial: '1',
      choices: ['1', '2'],
    });

    // Peso del arma en la unidad del sistema.
    schema.weight = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    // Propiedades especiales del arma (campo de texto, se ampliará más adelante).
    schema.properties = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
    });

    // Si está activo, el arma aparece como acción en el tab de Acciones.
    schema.actionEnabled = new fields.BooleanField({
      required: true,
      initial: false,
    });

    return schema;
  }

}
