import { GeneratorUtils } from "./utils.js";

export class MorrsliebGenerator {
    static async generate() {
        // Restrict execution to Game Master to ensure complete privacy of the outputs
        if (!game.user.isGM) {
            ui.notifications.warn("Only the GM can invoke Morrslieb.");
            return;
        }

        // 1. Roll 1d100 using the shared utility class
        const result = await GeneratorUtils.rollDice("1d100");
        
        let message = "";
        let isFullMoon = false;

        // 2. Determine Morrslieb's state
        if (result >= 1 && result <= 65) {
            message = "Morrslieb is not visible at all.";
        } else if (result >= 66 && result <= 95) {
            message = "Morrslieb is growing stronger day by day...";
        } else if (result >= 96 && result <= 99) {
            message = "Morrslieb is full.";
            isFullMoon = true;
        } else if (result === 100) {
            message = "The sickly green hue of Morrslieb wanes, yet its malice lingers in the shadows.";
        }

        if (!canvas.scene) {
            ui.notifications.warn("No active scene found.");
            return;
        }

        // 3. Clean up any existing Morrslieb light from the current scene
        const existingLights = canvas.scene.lights.filter(l => l.name === "Morrslieb");
        if (existingLights.length > 0) {
            const idsToDelete = existingLights.map(l => l.id);
            await canvas.scene.deleteEmbeddedDocuments("AmbientLight", idsToDelete);
        }

        let lightStatusHtml = "";

        // 4. Create the green light only if it's a full moon
        if (isFullMoon) {
            const dims = canvas.dimensions;
            const centerX = dims.width / 2;
            const centerY = dims.height / 2;
            
            const radius = Math.max(dims.sceneWidth, dims.sceneHeight);

            const lightData = {
                name: "Morrslieb",
                x: centerX,
                y: centerY,
                config: {
                    dim: radius,
                    bright: 0,
                    angle: 360,
                    color: "#4a8b2c",
                    alpha: 0.4,
                    coloration: 10,
                    walls: true,
                    animation: {
                        type: "roiling",
                        speed: 1,
                        intensity: 2
                    }
                }
            };

            await canvas.scene.createEmbeddedDocuments("AmbientLight", [lightData]);
            lightStatusHtml = `<p style="margin-top: 8px; color: #3b7023; font-weight: bold; font-style: italic; border-top: 1px dotted #3b7023; padding-top: 4px;">Morrslieb's sickly light bathes the scene.</p>`;
        }

        // 5. Build and send the GM-only Chat Message
        const chatContent = `
        <div style="border: 2px solid #231f20; padding: 10px; background-color: #f4ece3; color: #231f20; font-family: 'Times New Roman', serif; border-radius: 3px;">
            <h3 style="margin: 0 0 5px 0; color: #5a1111; font-weight: bold; font-variant: small-caps; text-align: center;">Lunar Phase</h3>
            <p style="margin: 0; font-size: 13px;"><strong>Roll:</strong> ${result}</p>
            <p style="margin: 4px 0 0 0; font-size: 14px;">${message}</p>
            ${lightStatusHtml}
        </div>`;

        await GeneratorUtils.sendGMChatMessage(chatContent, "Morrslieb");
    }
}