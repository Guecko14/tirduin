import TirduinRPSItemBase from "./base-item.mjs";

export default class TirduinRPSFeature extends TirduinRPSItemBase {

	static defineSchema() {
		const fields = foundry.data.fields;
		const schema = super.defineSchema();

		schema.category = new fields.StringField({ required: true, blank: true, initial: "" });
		schema.origin = new fields.StringField({
			required: true,
			blank: false,
			initial: 'class',
			choices: ['class', 'race', 'background'],
		});
		schema.level = new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			initial: 1,
			min: 1,
		});
		schema.cost = new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			initial: 0,
			min: 0,
		});

		// Campos para acciones mágicas de NPC.
		schema.damageDie = new fields.StringField({
			required: false,
			blank: true,
			initial: '1d6',
		});

		schema.saveType = new fields.StringField({
			required: false,
			blank: false,
			initial: 'fortaleza',
			choices: ['fortaleza', 'reflejos', 'voluntad'],
		});

		schema.cd = new fields.NumberField({
			required: false,
			nullable: false,
			integer: true,
			initial: 10,
			min: 1,
		});

		schema.onSaveSuccess = new fields.StringField({
			required: false,
			blank: false,
			initial: 'half',
			choices: ['half', 'negate'],
		});

		return schema;
	}

}