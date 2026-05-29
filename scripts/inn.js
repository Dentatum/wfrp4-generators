import { GeneratorUtils } from "./utils.js";

export class InnGenerator {
    static PLACES_PATH = 'modules/wfrp4e-generators/tables/inn.txt';

    static async promptAndGenerate() {
        const dialogResult = await this._promptTypeAndModifiersDialog();
        if (!dialogResult) return; 
        
        let { type: innType, size: innSize, quality: innQuality, modifier: globalMod } = dialogResult;

        if (innType === "Random") {
            const roll = await GeneratorUtils.rollDice('1d100');
            if (roll <= 20) innType = "Brothel";
            else if (roll <= 40) innType = "Club";
            else if (roll <= 60) innType = "Coaching inn";
            else if (roll <= 80) innType = "Hostel";
            else innType = "Tavern";
        }

        let roomMult = 1.0;
        let amenityMod = 0;
        
        if (innSize === "Small") { roomMult = 0.5; amenityMod = -25; } 
        else if (innSize === "Large") { roomMult = 2.0; amenityMod = 25; }

        let roomSngl = await GeneratorUtils.rollDice('1d10');
        let roomDbl = await GeneratorUtils.rollDice('1d10');
        let roomLrg = await GeneratorUtils.rollDice('1d10');
        let roomDorm = await GeneratorUtils.rollDice('1d5+7');

        if (innType === "Brothel") { roomSngl += 6; roomDbl = 0; roomLrg = 0; roomDorm = 0; } 
        else if (innType === "Club") { roomSngl -= 2; roomDbl -= 2; roomLrg = 0; roomDorm -= 2; } 
        else if (innType === "Coaching inn") { roomSngl += 2; roomDbl += 2; roomLrg += 2; roomDorm += 4; } 
        else if (innType === "Tavern") { roomDbl -= 2; roomLrg -= 2; roomDorm -= 2; }
        
        roomSngl = Math.max(0, Math.round(roomSngl * roomMult));
        roomDbl = Math.max(0, Math.round(roomDbl * roomMult));
        roomLrg = Math.max(0, Math.round(roomLrg * roomMult));
        roomDorm = Math.max(0, Math.round(roomDorm * roomMult));

        const roomData = {
            sngl: await this._calculateAvailability(roomSngl, globalMod),
            dbl: await this._calculateAvailability(roomDbl, globalMod),
            lrg: await this._calculateAvailability(roomLrg, globalMod),
            dorm: await this._calculateAvailability(roomDorm, globalMod)
        };

        const rawLines = await GeneratorUtils.loadTableData(this.PLACES_PATH);
        if (rawLines.length > 0) {
            const parsedData = this._parseTableEntries(rawLines);
            await this._processInnNameAndBuild(parsedData, innType, innSize, innQuality, amenityMod, roomData);
        }
    }

    static _parseTableEntries(lines) {
        const data = { names: [], amenities: {}, prices: [], features: [] };
        for (let line of lines) {
            const parts = line.split(';');
            if (parts.length >= 4 && parts[0] === "name") {
                let min = parseInt(parts[1], 10), max = parseInt(parts[2], 10);
                if (min === 0) min = 100; if (max === 0) max = 100;
                data.names.push({ min, max, prefix: parts[3]?.trim() || "", suffix: parts[4]?.trim() || "" });
            } else if (parts.length >= 7 && parts[0] === "ammenities") {
                data.amenities[parts[1].trim().toLowerCase()] = {
                    baths: parseInt(parts[2], 10), gambling: parseInt(parts[3], 10),
                    snug: parseInt(parts[4], 10), stabling: parseInt(parts[5], 10),
                    illReputation: parseInt(parts[6], 10)
                };
            } else if (parts.length >= 3 && parts[0] === "price") {
                const rawPrice = parts[2].trim().split(',');
                data.prices.push({ product: parts[1].trim(), gc: parseInt(rawPrice[0], 10) || 0, ss: parseInt(rawPrice[1], 10) || 0, bp: parseInt(rawPrice[2], 10) || 0 });
            } else if (parts.length >= 5 && parts[0] === "features") {
                let min = parseInt(parts[1], 10), max = parseInt(parts[2], 10);
                if (min === 0) min = 100; if (max === 0) max = 100;
                data.features.push({ min, max, adj: parts[3].trim(), noun: parts[4].trim() });
            }
        }
        return data;
    }

    static async _processInnNameAndBuild(parsedData, innType, innSize, innQuality, amenityMod, roomData) {
        const tableEntries = parsedData.names;
        if (!tableEntries.length) return null;

        const rollForSuffix = async () => {
            let sRoll, sEntry;
            do {
                sRoll = await GeneratorUtils.rollDice('1d100');
                sEntry = tableEntries.find(e => sRoll >= e.min && sRoll <= e.max);
            } while (sEntry.min >= 99); 
            return { roll: sRoll, word: sEntry.suffix };
        };

        const roll1 = await GeneratorUtils.rollDice('1d100');
        const entry1 = tableEntries.find(e => roll1 >= e.min && roll1 <= e.max);
        let finalInnName = roll1 <= 98 
            ? `The ${entry1.prefix} ${(await rollForSuffix()).word}`
            : `The ${(await rollForSuffix()).word} and the ${(await rollForSuffix()).word}`;
        finalInnName = finalInnName.replace(/\s+/g, ' ').trim();

        const presentAmenities = [];
        const innTypeKey = innType.toLowerCase();
        const amChances = parsedData.amenities[innTypeKey];

        const checkAmenity = async (name, baseChance) => {
            let finalChance = (baseChance !== 0 && baseChance !== 100) ? baseChance + amenityMod : baseChance;
            if ((await GeneratorUtils.rollDice('1d100')) <= finalChance) presentAmenities.push(name);
        };

        if (amChances) {
            await checkAmenity("Baths", amChances.baths);
            await checkAmenity("Gambling", amChances.gambling);
            await checkAmenity("Snug", amChances.snug);
            await checkAmenity("Stabling", amChances.stabling);
            await checkAmenity("People of Ill Reputation", amChances.illReputation);
        }
        if (innTypeKey === "coaching inn") { await checkAmenity("Blacksmith", 80); await checkAmenity("Road/River Wardens House", 50); }

        let featureHtml = "", featPriceMod = 1.0, activeFeatureNoun = "";
        if (parsedData.features.length > 0) {
            let adjRoll = await GeneratorUtils.rollDice('1d100');
            let adjEntry = parsedData.features.find(f => adjRoll >= f.min && adjRoll <= f.max);
            
            if (adjRoll <= 5) featPriceMod = 0.75; else if (adjRoll <= 10) featPriceMod = 1.10;
            else if (adjRoll <= 15) featPriceMod = 1.25; else if (adjRoll <= 20) featPriceMod = 0.90;

            let nounEntry, validNoun = false;
            while (!validNoun) {
                let nounRoll = await GeneratorUtils.rollDice('1d100');
                nounEntry = parsedData.features.find(f => nounRoll >= f.min && nounRoll <= f.max);
                let n = nounEntry.noun.toLowerCase();
                if ((n === "baths" && !presentAmenities.includes("Baths")) || (n === "gambling" && !presentAmenities.includes("Gambling")) || (n === "stabling" && !presentAmenities.includes("Stabling")) || (n === "people of ill repute" && !presentAmenities.includes("People of Ill Reputation"))) continue;
                validNoun = true;
            }

            activeFeatureNoun = nounEntry.noun;
            featureHtml = `<div style="border-top: 1px solid #7a6a58; padding-top: 6px; margin-top: 6px; text-align: center;"><span style="font-size: 11px; text-transform: uppercase; color: #5a1111;">Notable Feature</span><p style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold; color: #231f20;">${adjEntry.adj} ${activeFeatureNoun}</p></div>`;
        }

        let priceMult = (innQuality === "Poor") ? 0.5 : (innQuality === "Good") ? 3.0 : (innQuality === "Best") ? 10.0 : 1.0;
        let pricesHtml = "";
        
        if (parsedData.prices.length > 0) {
            const validPrices = parsedData.prices.filter(p => {
                const prod = p.product.toLowerCase();
                if (prod === "room, single" && roomData.sngl.total === 0) return false;
                if (prod === "room, double" && roomData.dbl.total === 0) return false;
                if (prod === "room, large" && roomData.lrg.total === 0) return false;
                if (prod === "dorm, bed" && roomData.dorm.total === 0) return false;
                if (prod === "stabling, night" && !presentAmenities.includes("Stabling")) return false;
                return true;
            });

            if (validPrices.length > 0) {
                const priceRows = validPrices.map(p => {
                    let totalBp = Math.round((((p.gc * 240) + (p.ss * 12) + p.bp) * priceMult) * (this._isProductAffected(p.product, activeFeatureNoun) ? featPriceMod : 1.0));
                    let payCommand = "Free";
                    
                    if (totalBp > 0) {
                        let cGc = Math.floor(totalBp / 240), rem = totalBp % 240, cSs = Math.floor(rem / 12), cBp = rem % 12;
                        let bP = [], tP = [];
                        if (cGc > 0) { bP.push(`${cGc}gc`); tP.push(`${cGc} GC`); }
                        if (cSs > 0) { bP.push(`${cSs}ss`); tP.push(`${cSs} ss`); }
                        if (cBp > 0) { bP.push(`${cBp}bp`); tP.push(`${cBp} bp`); }
                        payCommand = `@Pay[${bP.join('')}]{${tP.join(' ')}}`;
                    }
                    return `<div style="display: flex; justify-content: space-between; border-bottom: 1px dotted #a89f91; padding: 2px 0;"><span>${p.product}</span><span>${payCommand}</span></div>`;
                }).join("");
                pricesHtml = `<div style="border-top: 1px solid #7a6a58; padding-top: 6px; margin-top: 6px;"><div style="text-align: center; margin-bottom: 4px;"><span style="font-size: 11px; text-transform: uppercase; color: #5a1111;">Price List</span></div><div style="font-size: 13px; color: #231f20;">${priceRows}</div></div>`;
            }
        }

        const chatContent = `
        <div style="font-family: 'Caslon Antique', 'Palatino Linotype', serif; border: 2px solid #231f20; padding: 8px; background-color: #f4ece3; color: #231f20; border-radius: 3px;">
            <header style="border-bottom: 2px solid #5a1111; margin-bottom: 5px; padding-bottom: 3px; text-align: center;"><h3 style="margin: 0; color: #5a1111; font-weight: bold; font-variant: small-caps;">Inn Generator</h3></header>
            <div style="text-align: center; margin-bottom: 8px;"><h2 style="margin: 3px 0 0 0; color: #231f20; font-weight: bold;">${finalInnName}</h2><span style="font-size: 11px; text-transform: uppercase; color: #5a1111;">${innSize} ${innQuality} ${innType}</span></div>
            <div style="border-top: 1px solid #7a6a58; padding-top: 6px; font-size: 13px; line-height: 1.5;">
                <p style="margin: 2px 0; display: flex; justify-content: space-between;"><strong>Single Rooms:</strong> <span>${roomData.sngl.available} / ${roomData.sngl.total} free</span></p>
                <p style="margin: 2px 0; display: flex; justify-content: space-between;"><strong>Double Rooms:</strong> <span>${roomData.dbl.available} / ${roomData.dbl.total} free</span></p>
                <p style="margin: 2px 0; display: flex; justify-content: space-between;"><strong>Large Rooms:</strong> <span>${roomData.lrg.available} / ${roomData.lrg.total} free</span></p>
                <p style="margin: 2px 0; display: flex; justify-content: space-between;"><strong>Dormitory Beds:</strong> <span>${roomData.dorm.available} / ${roomData.dorm.total} free</span></p>
            </div>
            <div style="border-top: 1px solid #7a6a58; padding-top: 6px; margin-top: 6px; text-align: center;"><span style="font-size: 11px; text-transform: uppercase; color: #5a1111;">Services & Amenities</span><p style="margin: 2px 0 0 0; font-size: 13px; font-style: italic; color: #231f20;">${presentAmenities.length > 0 ? presentAmenities.join(" • ") : "None"}</p></div>
            ${featureHtml} ${pricesHtml}
        </div>`;

        await GeneratorUtils.sendGMChatMessage(chatContent, "Innkeeper");
        await GeneratorUtils.saveToJournal("WFRP4 - Generators", "Discovered Inns", finalInnName, chatContent);
        ui.notifications.info(`Saved ${finalInnName} to Journal: Discovered Inns.`);
    }

    static async _calculateAvailability(totalRooms, modifier) {
        if (totalRooms === 0) return { total: 0, available: 0, pct: 0 };
        let pctFree = Math.max(0, Math.min(100, (await GeneratorUtils.rollDice('1d100')) + modifier));
        return { total: totalRooms, available: Math.round((totalRooms * pctFree) / 100), pct: pctFree };
    }

    static _isProductAffected(productName, featureNoun) {
        const p = productName.toLowerCase(), n = featureNoun.toLowerCase();
        if ((n === "breakfast" || n === "supper") && p.includes("food")) return true;
        if (n === "ales, beers or ciders" && (p.includes("ale") || p.includes("beer") || p.includes("cider"))) return true;
        if (n === "wines" && p.includes("wine")) return true;
        if (n === "private rooms" && (p.includes("room, single") || p.includes("room, double"))) return true;
        if (n === "common room" && (p.includes("room, large") || p.includes("dorm"))) return true;
        if (n === "stabling" && p.includes("stabling")) return true;
        return false;
    }

    static async _promptTypeAndModifiersDialog() {
        return new Promise((resolve) => {
            const content = `
                <form>
                    <div class="form-group" style="margin-bottom: 8px;"><label style="font-weight: bold;">Type of inn:</label><select id="inn-type-select"><option value="Random">Random</option><option value="Brothel">Brothel</option><option value="Club">Club</option><option value="Coaching inn">Coaching inn</option><option value="Hostel">Hostel</option><option value="Tavern">Tavern</option></select></div>
                    <div class="form-group" style="margin-bottom: 8px;"><label style="font-weight: bold;">Size of inn:</label><select id="inn-size-select"><option value="Small">Small</option><option value="Medium" selected>Medium</option><option value="Large">Large</option></select></div>
                    <div class="form-group" style="margin-bottom: 12px;"><label style="font-weight: bold;">Quality of inn:</label><select id="inn-quality-select"><option value="Poor">Poor</option><option value="Common" selected>Common</option><option value="Good">Good</option><option value="Best">Best</option></select></div>
                    <hr><h4 style="margin-bottom: 8px; font-weight: bold;">Special Situations</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><label>Establishment has a good reputation</label><input type="checkbox" class="room-modifier" value="-10"></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><label>Inn with a particularly bad reputation</label><input type="checkbox" class="room-modifier" value="10"></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><label>Arrives before noon</label><input type="checkbox" class="room-modifier" value="20"></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><label>Arrives late in the evening</label><input type="checkbox" class="room-modifier" value="-20"></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;"><label>Special event in settlement</label><input type="checkbox" class="room-modifier" value="-30"></div>
                </form>`;
            new Dialog({
                title: "Inn Generator",
                content: content,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-dice-d20"></i>', label: "Generate",
                        callback: (html) => {
                            let mod = 0; html.find('.room-modifier:checked').each(function() { mod += parseInt($(this).val(), 10); });
                            resolve({ type: html.find('#inn-type-select').val(), size: html.find('#inn-size-select').val(), quality: html.find('#inn-quality-select').val(), modifier: mod });
                        }
                    },
                    cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) }
                }, default: "ok", close: () => resolve(null)
            }).render(true);
        });
    }
}