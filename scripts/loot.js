import { GeneratorUtils } from "./utils.js";

export class LootGenerator {
    
    /**
     * Path to the plain text file containing the loot tables.
     */
    static get tablePath() {
        return "modules/wfrp4e-generators/tables/loot.txt";
    }

    /**
     * Initiates the loot generation flow by opening the difficulty and quantity selection dialog.
     */
    static async start() {
        const dialogContent = `
        <form>
            <div class="form-group">
                <label><i class="fas fa-skull"></i> Encounter Difficulty:</label>
                <select id="encounter-difficulty" name="encounter-difficulty">
                    <option value="3">Very Easy</option>
                    <option value="4">Easy</option>
                    <option value="5" selected>Average</option>
                    <option value="6">Challenging</option>
                    <option value="7">Hard</option>
                    <option value="8">Very Hard</option>
                </select>
            </div>
            <div class="form-group">
                <label><i class="fas fa-boxes"></i> Number of Items:</label>
                <select id="loot-quantity" name="loot-quantity">
                    <option value="random" selected>Random (1d5)</option>
                    <option value="1">1 Item</option>
                    <option value="2">2 Items</option>
                    <option value="3">3 Items</option>
                    <option value="4">4 Items</option>
                    <option value="5">5 Items</option>
                </select>
            </div>
            <p class="notes" style="margin-top: 5px; font-size: 0.9em; color: #555;">
                Select the encounter difficulty and item count to determine the resolved loot.
            </p>
        </form>
        `;

        new Dialog({
            title: "Post-Encounter Loot",
            content: dialogContent,
            buttons: {
                roll: {
                    icon: "<i class='fas fa-dice'></i>",
                    label: "Roll & Generate",
                    callback: async (html) => {
                        const difficultyIndex = parseInt(html.find("#encounter-difficulty").val());
                        const difficultyText = html.find("#encounter-difficulty option:selected").text();
                        const quantityInput = html.find("#loot-quantity").val();
                        
                        await this.processLootType(difficultyIndex, difficultyText, quantityInput);
                    }
                },
                cancel: {
                    icon: "<i class='fas fa-times'></i>",
                    label: "Cancel"
                }
            },
            default: "roll"
        }).render(true);
    }

    /**
     * Fetches the CSV, determines categories, makes secondary rolls, handles special item rerolls,
     * evaluates inline math, and dynamically assigns value to valuable items based on difficulty.
     */
    static async processLootType(difficultyIndex, difficultyText, quantityInput) {
        // 1. Fetch data from the text file
        const rawLines = await GeneratorUtils.loadTableData(this.tablePath);
        
        if (!rawLines || rawLines.length === 0) {
            ui.notifications.error("Loot Generator: Could not load data from loot.txt.");
            return;
        }

        // 2. Parse the different tables into memory
        const typeTable = [];
        const disjunkTable = [];
        const itemTable = [];
        const valuableTable = [];

        rawLines.forEach(line => {
            // Remove source tags if they exist (e.g., "") to avoid parsing issues
            const cleanLine = line.replace(/\\s*/g, '').trim();
            if (!cleanLine) return;

            const parts = cleanLine.split(';');
            const rowType = parts[0];

            if (rowType === "type") {
                typeTable.push(parts);
            } else if (rowType === "disjunk") {
                disjunkTable.push({ min: parseInt(parts[1]), max: parseInt(parts[2]), disgusting: parts[3], junk: parts[4] });
            } else if (rowType === "item") {
                itemTable.push({ min: parseInt(parts[1]), max: parseInt(parts[2]), item: parts[3] });
            } else if (rowType === "valuable") {
                // Parsed similarly to items: valuable;min;max;itemText
                valuableTable.push({ min: parseInt(parts[1]), max: parseInt(parts[2]), item: parts[3] });
            }
        });

        // 3. Determine exact number of primary rolls required
        let numRolls = 0;
        let quantityLogText = "";

        if (quantityInput === "random") {
            numRolls = await GeneratorUtils.rollDice("1d5");
            quantityLogText = `Random 1d5 (${numRolls} Items)`;
        } else {
            numRolls = parseInt(quantityInput);
            quantityLogText = `${numRolls} Fixed Item${numRolls > 1 ? 's' : ''}`;
        }

        const rolledResults = [];
        const specialItemRolls = [26, 60, 87, 94];

        // 4. Process the matrix iteratively
        for (let i = 0; i < numRolls; i++) {
            // Primary roll to determine type
            const typeRoll = await GeneratorUtils.rollDice("1d10");
            const typeRow = typeTable.find(row => typeRoll >= parseInt(row[1]) && typeRoll <= parseInt(row[2]));

            if (!typeRow) {
                console.warn(`WFRP4e Loot Generator | No type row found for 1d10 roll: ${typeRoll}`);
                continue;
            }

            const lootCategory = typeRow[difficultyIndex];
            let subRoll = null;
            let finalItemText = "";

            // Secondary lookup based on category
            if (lootCategory === "disgusting" || lootCategory === "junk") {
                subRoll = await GeneratorUtils.rollDice("1d100");
                const row = disjunkTable.find(r => subRoll >= r.min && subRoll <= r.max);
                if (row) {
                    finalItemText = (lootCategory === "disgusting") ? row.disgusting : row.junk;
                } else {
                    finalItemText = "Unknown " + lootCategory;
                }
            } 
            else if (lootCategory === "item") {
                subRoll = await GeneratorUtils.rollDice("1d100");
                
                // Handle Special Item Qualities / Flaws
                if (specialItemRolls.includes(subRoll)) {
                    let originalSubRoll = subRoll;
                    let reRoll = subRoll;
                    
                    // Reroll until it's a standard item
                    while (specialItemRolls.includes(reRoll)) {
                        reRoll = await GeneratorUtils.rollDice("1d100");
                    }
                    
                    const row = itemTable.find(r => reRoll >= r.min && reRoll <= r.max);
                    let baseItemText = row ? row.item : "Unknown Item";
                    
                    // Apply modifiers based on original roll
                    if (originalSubRoll === 26) {
                        finalItemText = `<i>Shoddy</i> ${baseItemText}`;
                    } else if (originalSubRoll === 60) {
                        finalItemText = `<i>Practical</i> ${baseItemText}`;
                    } else if (originalSubRoll === 87) {
                        finalItemText = `<i>Shoddy</i> ${baseItemText} (Worth half price)`;
                    } else if (originalSubRoll === 94) {
                        finalItemText = `<i>Practical</i> ${baseItemText} (Worth double price)`;
                    }
                } else {
                    const row = itemTable.find(r => subRoll >= r.min && subRoll <= r.max);
                    finalItemText = row ? row.item : "Unknown Item";
                }
            } 
            else if (lootCategory === "valuable") {
                subRoll = await GeneratorUtils.rollDice("1d100");
                const row = valuableTable.find(r => subRoll >= r.min && subRoll <= r.max);
                let baseValuableText = row ? row.item : "Unknown Valuable";

                // Determine value formula and currency based on encounter difficulty
                let valueFormula = "1d10"; 
                let currencyStr = "gc"; 

                if (difficultyText === "Very Easy" || difficultyText === "Easy") {
                    valueFormula = "1d10";
                    currencyStr = "ss";
                } else if (difficultyText === "Average") {
                    valueFormula = "1d10";
                    currencyStr = "gc";
                } else if (difficultyText === "Challenging") {
                    valueFormula = "1d10 * 2";
                    currencyStr = "gc";
                } else if (difficultyText === "Hard") {
                    valueFormula = "1d10 * 5";
                    currencyStr = "gc";
                } else if (difficultyText === "Very Hard") {
                    valueFormula = "1d10 * 10";
                    currencyStr = "gc";
                }

                try {
                    const valueRoll = await GeneratorUtils.rollDice(valueFormula);
                    const finalValue = Math.max(1, Math.floor(valueRoll));
                    finalItemText = `${baseValuableText} (${finalValue} ${currencyStr})`;
                } catch (e) {
                    console.error(`WFRP4e Loot Generator | Failed to evaluate valuable roll: ${valueFormula}`, e);
                    finalItemText = `${baseValuableText} (Value unknown)`;
                }
            } 
            else if (lootCategory === "magic") {
                finalItemText = "Magic Item (Table Pending)";
            }

            // 5. Cleanup UUID brackets and evaluate inline dice formulas for standard items
            if (finalItemText) {
                // Strip custom curly brace text from UUIDs if it exists: @UUID[...]{Text} -> @UUID[...]
                finalItemText = finalItemText.replace(/\{[^}]+\}/g, "");

                // Evaluate inline [[/r XdY]] formulas
                const inlineRollRegex = /\[\[\/r\s+([^\]]+)\]\]/g;
                let match;
                while ((match = inlineRollRegex.exec(finalItemText)) !== null) {
                    const formula = match[1];
                    try {
                        const inlineRollResult = await GeneratorUtils.rollDice(formula);
                        const formattedResult = Math.max(1, Math.floor(inlineRollResult)); 
                        finalItemText = finalItemText.replace(match[0], formattedResult);
                    } catch (e) {
                        console.error(`WFRP4e Loot Generator | Failed to evaluate inline roll: ${formula}`, e);
                    }
                    inlineRollRegex.lastIndex = 0; // Reset regex index after modifying the string
                }
            }

            rolledResults.push({
                index: i + 1,
                category: lootCategory,
                resultText: finalItemText
            });
        }

        if (rolledResults.length === 0) {
            ui.notifications.warn("Loot Generator: No standard loot found (or formula failed).");
            return;
        }

        // 6. Construct the HTML dynamic table layout
        let tableRowsHTML = "";
        rolledResults.forEach(res => {
            // Determine text color based on loot category
            let typeColor = "#000000"; // Default: Item (Black)
            
            if (res.category === "valuable") {
                typeColor = "#b8860b"; // Ochre
            } else if (res.category === "disgusting") {
                typeColor = "#2e4a23"; // Dark Green
            } else if (res.category === "junk") {
                typeColor = "#808080"; // Medium Gray
            } else if (res.category === "magic") {
                typeColor = "#800080"; // Purple
            }

            tableRowsHTML += `
                <tr style="border-bottom: 1px solid #ccc; background: rgba(255,255,255,0.4);">
                    <td style="padding: 6px; text-transform: capitalize; font-weight: bold; color: ${typeColor}; width: 80px; border-right: 1px dashed #ccc;">
                        ${res.category}
                    </td>
                    <td style="padding: 6px; font-style: italic; color: #222;">
                        ${res.resultText}
                    </td>
                </tr>
            `;
        });

        // 7. Finalize the compiled GM Chat layout (Grimdark Warhammer Styling)
        const chatContent = `
            <div class="wfrp4e chat-card" style="font-family: 'Times New Roman', serif;">
                <header class="card-header" style="background: #2c0e0e; color: #fff; padding: 6px; text-align: center; border-radius: 3px;">
                    <b style="font-size: 1.1em;"><i class="fas fa-treasure-chest"></i> LOOT RESOLUTION</b>
                </header>
                <div class="card-content" style="margin-top: 8px;">
                    <div style="margin-bottom: 8px; font-size: 0.95em; line-height: 1.3; border-bottom: 2px solid #2c0e0e; padding-bottom: 4px;">
                        <b>Difficulty:</b> ${difficultyText}<br>
                        <b>Total Checks:</b> ${quantityLogText}
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                        <thead>
                            <tr style="background: #dcd1b4; border-bottom: 2px solid #2c0e0e;">
                                <th style="padding: 4px; text-align: left; width: 80px;">Type</th>
                                <th style="padding: 4px; text-align: left;">Resolved Loot</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHTML}
                        </tbody>
                    </table>
                </div>
                <footer class="card-footer" style="margin-top: 8px; text-align: right; font-size: 0.8em; color: #666;">
                    Generated by WFRP4e Loot Generator
                </footer>
            </div>
        `;

        // 8. Send the whispered summary to the Game Master
        await GeneratorUtils.sendGMChatMessage(chatContent, "Old World Loot");
    }
}