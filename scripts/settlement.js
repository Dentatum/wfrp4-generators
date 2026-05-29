import { GeneratorUtils } from "./utils.js";

export class SettlementGenerator {
    static PLACES_PATH = 'modules/wfrp4e-generators/tables/settlement.txt';

    /**
     * Prompts the user for a settlement size and triggers the generation process.
     */
    static async promptAndGenerate() {
        const size = await this._promptSizeDialog();
        if (!size) {
            ui.notifications.info("Settlement generation cancelled.");
            return;
        }
        await this.generate(size);
    }

    /**
     * Handles the core logic for generating a settlement.
     * @param {string} selectedSize - "random", "Hamlet", "Village", "Town", or "City"
     */
    static async generate(selectedSize) {
        try {
            let sSize = selectedSize;

            if (sSize === "random") {
                const typeRoll = await GeneratorUtils.rollDice("1d100");
                if (typeRoll >= 1 && typeRoll <= 30) sSize = "Hamlet";
                else if (typeRoll >= 31 && typeRoll <= 75) sSize = "Village";
                else if (typeRoll >= 76 && typeRoll <= 90) sSize = "Town";
                else sSize = "City";
            }

            const placesLines = await GeneratorUtils.loadTableData(this.PLACES_PATH);
            if (!placesLines || placesLines.length === 0) return;

            // 1. GENERATE NAME
            const prefixLines = placesLines.filter(line => line.startsWith('name;'));
            const getPrefix = (roll) => prefixLines[roll - 1].split(';')[3];
            const getSuffix = (roll) => prefixLines[roll - 1].split(';')[4];

            let pRoll = await GeneratorUtils.rollDice("1d100");
            let sRoll = await GeneratorUtils.rollDice("1d100");
            let modifier = "";
            let sName = "";

            if (sRoll >= 95 && sRoll <= 99) {
                const modifiers = { 95: "Alte ", 96: "Bad ", 97: "Grosse ", 98: "Heilige ", 99: "Neue " };
                modifier = modifiers[sRoll];
                sRoll = await GeneratorUtils.rollDice("1d94");
            }

            if (sRoll === 100) {
                let p1 = getPrefix(await GeneratorUtils.rollDice("1d100"));
                let s1 = getSuffix(await GeneratorUtils.rollDice("1d94"));
                let p2 = getPrefix(await GeneratorUtils.rollDice("1d100"));
                let s2 = getSuffix(await GeneratorUtils.rollDice("1d94"));
                sName = `${p2}${s2} an der ${p1}${s1}`;
            } else {
                sName = `${getPrefix(pRoll)}${modifier}${getSuffix(sRoll)}`;
            }

            let sSizeInt = 0, sPopulation = 0, sWealthInt = 0;
            let sGarA = await GeneratorUtils.rollDice("1d10");
            let sGarB = await GeneratorUtils.rollDice("1d10");
            let sGarC = await GeneratorUtils.rollDice("1d10");

            // 2. CALCULATE POPULATION
            if (sSize === "Hamlet") { sPopulation = 20 * await GeneratorUtils.rollDice("1d10"); sSizeInt = 1; }
            else if (sSize === "Village") { sPopulation = 150 * await GeneratorUtils.rollDice("1d10"); sSizeInt = 2; }
            else if (sSize === "Town") { sPopulation = 1000 * await GeneratorUtils.rollDice("1d10"); sSizeInt = 3; }
            else if (sSize === "City") { sPopulation = (500 * await GeneratorUtils.rollDice("1d10")) + 10000; sSizeInt = 4; }

            // 3. GENERATE WEALTH LEVEL
            let wRoll = await GeneratorUtils.rollDice("1d100");
            wRoll += (sSizeInt === 1 || sSizeInt === 2) ? -5 : 5;
            wRoll = Math.max(1, Math.min(100, wRoll));

            if (wRoll <= 15) sWealthInt = 0;
            else if (wRoll <= 35) sWealthInt = 1;
            else if (wRoll <= 75) sWealthInt = 2;
            else if (wRoll <= 85) sWealthInt = 3;
            else sWealthInt = 4;

            const getWealthString = (val) => ["Squalid", "Poor", "Average", "Bustling", "Prosperous"][val];

            // 4. GENERATE BASE GARRISON
            if (sSizeInt === 1) { sGarA = 0; sGarB = 0; sGarC = (sGarC === 1) ? 0 : sGarC + 10; }
            else if (sSizeInt === 2) { sGarA = 0; sGarB = (sGarB === 1) ? 0 : Math.max(0, sGarB - 5); sGarC = (sGarC === 1) ? 0 : sGarC + 10; }
            else { sGarA = (sGarA === 1) ? 0 : Math.max(0, sGarA - 5); sGarB = (sGarB === 1) ? 0 : sGarB; sGarC = (sGarC === 1) ? 0 : sGarC + 5; }

            // 5. GENERATE FEATURES
            let fRollQt = await GeneratorUtils.rollDice("1d5");
            fRollQt -= (sSizeInt === 1) ? 3 : (sSizeInt === 2) ? 2 : (sSizeInt === 3) ? 1 : 0;
            fRollQt = Math.max(0, fRollQt);

            const featureLines = placesLines.filter(line => line.startsWith('features;'));
            let generatedFeatures = [];
            let producedGoodsSet = new Set();

            while (generatedFeatures.length < fRollQt) {
                let fRoll = await GeneratorUtils.rollDice("1d100");
                let fLine = featureLines.find(line => {
                    let parts = line.split(';');
                    return fRoll >= parseInt(parts[1]) && fRoll <= parseInt(parts[2]);
                });

                if (fLine) {
                    let parts = fLine.split(';');
                    let min = parseInt(parts[1]), max = parseInt(parts[2]);
                    let featureText = parts[3];
                    let produceText = parts[4] ? parts[4].trim() : "";

                    if (!generatedFeatures.includes(featureText)) {
                        if ((min >= 27 && max <= 28) || (min >= 65 && max <= 66)) {
                            let percRoll = await GeneratorUtils.rollDice("2d10");
                            let subPopNum = Math.floor(sPopulation * (percRoll / 100));
                            featureText = featureText.replace("(2d10 %)", `(${percRoll}%) [${subPopNum} citizens]`);
                        }
                        if (min >= 39 && max <= 40) { sGarA *= 2; sGarB *= 2; sGarC *= 2; }
                        if (min >= 41 && max <= 44) sWealthInt = Math.max(0, sWealthInt - 1);
                        if (min >= 47 && max <= 48) { sGarA *= 0.75; sGarB *= 0.75; sGarC *= 0.75; }
                        if (min >= 51 && max <= 52) sWealthInt = Math.min(4, sWealthInt + 1);
                        if (min >= 59 && max <= 60) sGarB *= 1.5;

                        generatedFeatures.push(featureText);
                        if (produceText) producedGoodsSet.add(produceText);
                    }
                }
            }

            let sWealth = getWealthString(sWealthInt);
            const garANum = Math.floor(sPopulation * (Math.round(sGarA) / 100));
            const garBNum = Math.floor(sPopulation * (Math.round(sGarB) / 100));
            const garCNum = Math.floor(sPopulation * (Math.round(sGarC) / 100));

            let sFeaturesDisplay = generatedFeatures.length > 0 
                ? `<ul style="margin: 0; padding-left: 20px;"><li>${generatedFeatures.join("</li><li>")}</li></ul>` 
                : "<p style='margin:0; font-style: italic;'>None of note.</p>";
                
            let sProduceDisplay = producedGoodsSet.size > 0 ? Array.from(producedGoodsSet).join(", ") : "Subsistence";

            // 6. BUILD HTML & OUTPUT
            const chatContent = `
            <div style="border: 2px solid #4a0d0d; padding: 10px; background-color: #fdf5e6; color: #2b1a10; font-family: 'Times New Roman', serif;">
                <h2 style="text-align: center; margin: 10px 0; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px;">${sName}</h2>
                <p style="font-style: italic; text-align: center; font-size: 0.95em; color: #5a3c22; margin-bottom: 15px;">"By the grace of Sigmar, a new settlement has been charted."</p>
                <div style="margin-top: 10px; border-top: 1px dashed #4a0d0d; padding-top: 10px;">
                    <p style="margin: 4px 0;"><strong>Classification:</strong> ${sSize} (${sSizeInt})</p>
                    <p style="margin: 4px 0;"><strong>Estimated Population:</strong> ${sPopulation}</p>
                    <p style="margin: 4px 0;"><strong>Wealth Level:</strong> ${sWealth} (${sWealthInt})</p>
                    <p style="margin: 4px 0;"><strong>Local Trade/Produce:</strong> ${sProduceDisplay}</p>
                </div>
                <div style="margin-top: 10px; border-top: 1px dashed #4a0d0d; padding-top: 10px;">
                    <h4 style="margin: 0 0 5px 0; color: #4a0d0d; font-variant: small-caps; font-size: 1.1em;">Notable Features</h4>
                    ${sFeaturesDisplay}
                </div>
                <div style="margin-top: 10px; border-top: 1px dashed #4a0d0d; padding-top: 10px;">
                    <h4 style="margin: 0 0 5px 0; color: #4a0d0d; font-variant: small-caps; font-size: 1.1em;">Garrison & Defenses</h4>
                    <p style="margin: 3px 0; font-size: 0.9em; display: flex; justify-content: space-between;"><span><strong>Elite/State Troops:</strong></span> <span>${garANum} forces</span></p>
                    <p style="margin: 3px 0; font-size: 0.9em; display: flex; justify-content: space-between;"><span><strong>Soldiers/Town Watch:</strong></span> <span>${garBNum} forces</span></p>
                    <p style="margin: 3px 0; font-size: 0.9em; display: flex; justify-content: space-between;"><span><strong>Militia/Levy:</strong></span> <span>${garCNum} forces</span></p>
                </div>
            </div>`;
            
            await GeneratorUtils.sendGMChatMessage(chatContent, "Imperial Cartographer");
            await GeneratorUtils.saveToJournal("WFRP4 - Generators", "Discovered settlements", `${sName} (${sSize})`, chatContent);
            
            ui.notifications.info(`WFRP4e Generators | ${sName} saved to the Imperial Archives!`);

        } catch (error) {
            ui.notifications.error(error.message);
            console.error("WFRP4e Generators Error:", error);
        }
    }

    /**
     * UI Helper: Prompts the GM for the settlement size.
     */
    static async _promptSizeDialog() {
        return new Promise((resolve) => {
            new Dialog({
                title: "Settlement Generator",
                content: `
                <form>
                    <div class="form-group">
                        <label>What size of settlement?</label>
                        <select id="settlement-size">
                            <option value="random" selected>Random</option>
                            <option value="Hamlet">1: Hamlet (pop 10-100)</option>
                            <option value="Village">2: Village (pop 100-1,000)</option>
                            <option value="Town">3: Town (pop 1,000-10,000)</option>
                            <option value="City">4: City (pop 10,500-15,000)</option>
                        </select>
                    </div>
                </form>`,
                buttons: {
                    generate: { icon: "<i class='fas fa-dice'></i>", label: "Generate", callback: (html) => resolve(html.find("#settlement-size").val()) },
                    cancel: { icon: "<i class='fas fa-times'></i>", label: "Cancel", callback: () => resolve(null) }
                },
                default: "generate",
                close: () => resolve(null)
            }).render(true);
        });
    }
}