export class TirduinDice {
    /**
     * Ejecuta una tirada d20 con soporte para ventaja/desventaja.
     */
    static async d20Roll({ label, formula, actor, advantage = 0 }) {
        let rollFormula = "1d20";

        if (advantage === 1) rollFormula = "2d20kh";
        else if (advantage === -1) rollFormula = "2d20kl";

        const fullFormula = `${rollFormula} + ${formula}`;
        const roll = new Roll(fullFormula, actor.getRollData());
        await roll.evaluate();

        // Lógica para detectar Críticos y Pifias (basado en el primer d20)
        const d20 = roll.dice[0];
        const isCritical = d20.total === 20;
        const isFumble = d20.total === 1;

        // Construcción de clases dinámicas para el flavor
        let flavorClasses = ["tirduin-roll-flavor"];
        if (isCritical) flavorClasses.push("is-critical");
        if (isFumble) flavorClasses.push("is-fumble");

        // Generar el mensaje de chat usando las clases CSS de roll-dialog.css
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `<div class="${flavorClasses.join(" ")}"><div class="tirduin-roll-title">${label}</div></div>`,
            flags: {
                "tirduin.rollType": "d20",
                "tirduin.isCritical": isCritical,
                "tirduin.isFumble": isFumble
            }
        });
    }
}