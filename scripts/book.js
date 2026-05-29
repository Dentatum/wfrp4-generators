import { GeneratorUtils } from "./utils.js";

export class BookGenerator {
    static BASICS_PATH = "modules/wfrp4e-generators/tables/book-basics.txt";
    static TITLES_PATH = "modules/wfrp4e-generators/tables/book-title.txt";

    static async generate() {
        try {
            const basicsLines = await GeneratorUtils.loadTableData(this.BASICS_PATH);
            const titlesLines = await GeneratorUtils.loadTableData(this.TITLES_PATH);

            if (!basicsLines.length || !titlesLines.length) return;

            let priceBase = 0, priceMod = 0, encumbrance = 0;
            let bFeatures = "", bPeculiarities = "", bTitle = "", subtitle = "", footNote = "";

            // Helper functions bound to the loaded data
            const getGenreData = (res) => {
                for (let line of basicsLines) {
                    let parts = line.split(';'); 
                    if (parts[0].trim() === "genre" && res >= parseInt(parts[1]) && res <= parseInt(parts[2])) {
                        return { genre: parts[3].trim(), price: parseFloat(parts[4]) || 0 };
                    }
                }
                return { genre: "Unknown", price: 0 };
            };

            const getBasic = (param, res) => {
                for (let line of basicsLines) {
                    let parts = line.split(';'); 
                    if (parts[0].trim() === param && res >= parseInt(parts[1]) && res <= parseInt(parts[2])) {
                        let mod = parseInt(parts[4]);
                        if (!isNaN(mod)) priceMod += mod;
                        return parts[3].trim();
                    }
                }
                return "";
            };

            const countTitleElements = (genre) => titlesLines.filter(line => line.split(';')[0].trim() === genre)[0]?.split(';').length || 0;
            
            const getTitlePart = (genre, res, colIndex) => {
                for (let line of titlesLines) {
                    let parts = line.split(';'); 
                    if (parts[0].trim() === genre && res >= parseInt(parts[1]) && res <= parseInt(parts[2])) {
                        return parts[colIndex] ? parts[colIndex].trim() : "";            
                    }
                }
                return "";
            };

            // 1. Basics
            const genreData = getGenreData(await GeneratorUtils.rollDice("1d100"));
            const bGenre = genreData.genre;
            priceBase = genreData.price;
            
            const bQuality = getBasic("quality", await GeneratorUtils.rollDice("1d100"));
            const bType = getBasic("type", await GeneratorUtils.rollDice("1d100"));

            // 2. Pages & Encumbrance
            let pagesRoll = await GeneratorUtils.rollDice("1d10");
            encumbrance = Math.trunc(pagesRoll / 4);
            let countPages = pagesRoll * 50;
            let sizeDesc = (pagesRoll === 1) ? " (amounting to little more than a glued booklet)" : (pagesRoll === 10) ? "—a magnificent and remarkably bulky tome" : "";

            // 3. Age
            const bAge = getBasic("age", await GeneratorUtils.rollDice("1d100"));
            let ageRoll = await GeneratorUtils.rollDice("1d10"); 
            let bAgeTime = "";
            switch (bAge) {
                case "New":          bAgeTime = ageRoll === 1 ? "1 month old" : ageRoll + " months old"; break;
                case "Contemporary": bAgeTime = ageRoll === 1 ? "1 year old" : ageRoll + " years old"; break;
                case "Recent":       bAgeTime = (ageRoll * 5) + " years old"; break;
                case "Old":          bAgeTime = (ageRoll * 25) + " years old"; break;
                case "Ancient":      bAgeTime = (ageRoll * 100) + " years old"; break;
            }

            // 4. Condition
            let condRoll = await GeneratorUtils.rollDice("1d100");
            let bCondition = getBasic("condition", condRoll) + ".";
            let totalLostPages = 0; 
            
            if (condRoll >= 81) {
                let badPages = Math.trunc(((await GeneratorUtils.rollDice("1d100")) / 100) * countPages);
                totalLostPages += badPages;
                bCondition += ` The copy is stained, torn, or charred enough that ${badPages} pages are completely illegible.`;
            }
            if (condRoll === 22) bCondition += " The book emits an odd, lingering smell.";
            else if (condRoll === 33) bCondition += " There are frantic notes scribbled on the margins of several pages.";
            else if (condRoll === 77) { let t = await GeneratorUtils.rollDice("1d10"); totalLostPages += t; bCondition += ` Exactly ${t} pages have been deliberately torn out.`; }
            else if (condRoll === 88) bCondition += " The spine is entirely broken.";
            else if (condRoll === 99) { let m = await GeneratorUtils.rollDice("3d10"); totalLostPages += m; bCondition += ` Furthermore, ${m} pages are missing.`; }
            else if (condRoll === 100) bCondition += " The cover is completely missing.";

            let usablePages = Math.max(0, countPages - totalLostPages);

            // 5. Features
            let roll;
            do {
                roll = await GeneratorUtils.rollDice("1d100");
                if (roll < 96) { bFeatures += getBasic("features", roll) + ". "; if (roll >= 56 && roll <= 70) encumbrance++; }
            } while (roll >= 96);

            do {
                roll = await GeneratorUtils.rollDice("1d100");
                if (roll < 96) bPeculiarities += getBasic("peculiarities", roll) + ". ";
            } while (roll >= 96);

            const bOrigin = getBasic("origin", await GeneratorUtils.rollDice("1d100"));
            const bLanguage = getBasic("language", await GeneratorUtils.rollDice("1d100"));

            // 7. TITLE GENERATION
            let countElements = countTitleElements(bGenre); 
            for (let aux = 3; aux < countElements; aux++) {
                let part = getTitlePart(bGenre, await GeneratorUtils.rollDice("1d100"), aux);
                if (part) bTitle += (bTitle ? " " : "") + part; 
            }

            // 8. Subtitles
            if (bGenre === "Biography") {
                subtitle = getTitlePart("biocontent", await GeneratorUtils.rollDice("1d100"), 3);
                footNote = getTitlePart("biocontent", await GeneratorUtils.rollDice("1d100"), 4);
            } else if (bGenre === "Bestiary") {
                subtitle = getTitlePart("bestcontent2", await GeneratorUtils.rollDice("1d100"), 3);
                footNote = "The bestiary is specialized in the study of " + getTitlePart("bestcontent", await GeneratorUtils.rollDice("1d100"), 3) + " " + getTitlePart("bestcontent2", await GeneratorUtils.rollDice("1d100"), 4) + ".";
            } else if (bGenre === "Cook Book") {
                bTitle += " " + getBasic("origin", await GeneratorUtils.rollDice("1d100"));
                let rC = await GeneratorUtils.rollDice("1d100");
                if (rC >= 51 && rC <= 55) subtitle = await GeneratorUtils.rollDice("4d10") + " Mouth-watering Recipes";
                else if (rC >= 56 && rC <= 60) bTitle = await GeneratorUtils.rollDice("3d10") + " " + bTitle;
                else if (rC >= 71) subtitle = getTitlePart("cbcontent", rC, 3) + " " + getBasic("origin", await GeneratorUtils.rollDice("1d100"));
                else subtitle = getTitlePart("cbcontent", rC, 3);
            } else if (bGenre === "Guidebook or Travel Account") {
                bTitle += " " + getBasic("origin", await GeneratorUtils.rollDice("1d100"));
                subtitle = getTitlePart("guidecontent", await GeneratorUtils.rollDice("1d100"), 3);
            } else if (bGenre === "Fiction") {
                if (await GeneratorUtils.rollDice("1d100") % 2 === 0) bTitle += "s";
                footNote = getTitlePart("ficontent", await GeneratorUtils.rollDice("1d100"), 3);
            } else if (bGenre === "Scholarly Work") {
                if (bTitle.endsWith("the Culture and History of")) bTitle += " " + getBasic("origin", await GeneratorUtils.rollDice("1d100"));
                else if (bTitle.endsWith("Lexicons and Foreign Tongues")) bTitle += ": " + getBasic("language", await GeneratorUtils.rollDice("1d100"));
            } else if (bGenre === "Forbidden, Exotic or Heretical Topic") {
                let rF = await GeneratorUtils.rollDice("1d100");
                footNote = getTitlePart("forcontent", rF, 3);
                if (rF >= 57) footNote += ` ${Math.ceil(await GeneratorUtils.rollDice("1d10") / 3)} spells.`;
            }

            let studyTime = Math.floor(usablePages / 20);
            let skimTime = Math.floor(usablePages / 50);

            // Appraisal
            let totalBp = Math.max(0, Math.round((priceBase * (1 + (priceMod / 100))) * 240)); 
            let outGc = Math.floor(totalBp / 240), outRemainder = totalBp % 240;
            let outSs = Math.floor(outRemainder / 12), outBp = outRemainder % 12;
            
            let priceStringArray = [];
            if (outGc > 0) priceStringArray.push(`${outGc} GC`);
            if (outSs > 0) priceStringArray.push(`${outSs} ss`);
            if (outBp > 0 || priceStringArray.length === 0) priceStringArray.push(`${outBp} bp`);

            let availability = (bGenre === "Forbidden, Exotic or Heretical Topic") ? "exotic" : "rare"; 
            if (bQuality.toLowerCase().includes("poor")) availability = (availability === "exotic") ? "rare" : "scarce";

            let finalTitle = bTitle || "Unknown Tome";

            let gmNotesHTML = `<p><em>${subtitle}</em></p><p><strong>Overview:</strong> ${GeneratorUtils.getAorAn(bAge)} <strong>${bAge.toLowerCase()}</strong> ${bType.toLowerCase()} from <strong>${bOrigin}</strong>, dating back approximately ${bAgeTime}. It is a recognized work of <strong>${bGenre}</strong>.</p><p><strong>Physical State:</strong> It contains around ${countPages} pages, penned in <strong>${bLanguage}</strong>${sizeDesc}. ${bCondition} ${bFeatures.trim()}</p><p><strong>Contents & Style:</strong> A cursory skim reveals prose of <strong>${bQuality.toLowerCase()}</strong> quality. ${bPeculiarities.trim()}</p>${footNote ? `<blockquote><strong>Notes:</strong> ${footNote}</blockquote>` : ""}<hr><p><strong>Study Time:</strong> ${studyTime} hours<br><strong>Skim Time:</strong> ${skimTime} hours</p>`;

            // Create Item utilizing the utils library for folder access
            const folder = await GeneratorUtils.getOrCreateFolder("WFRP4 - Generators", "Item");
            let newItem = await Item.create({
                name: finalTitle, type: "trapping", folder: folder.id, img: "icons/sundries/books/book-embossed-bound-brown.webp",
                system: { description: { value: "" }, gmdescription: { value: gmNotesHTML }, price: { gc: outGc, ss: outSs, bp: outBp }, encumbrance: { value: encumbrance }, availability: { value: availability }, trappingType: { value: "misc" } }
            });

            let message = `
            <div style="background: #e8e4d8; border: 2px solid #2b2b2b; padding: 12px; font-family: 'Times New Roman', serif; color: #1a1a1a;">
                <header style="text-align: center; border-bottom: 2px solid #2b2b2b; margin-bottom: 10px; padding-bottom: 6px;"><h3 style="margin: 0; font-weight: bold; font-variant: small-caps; font-size: 1.3em;">${finalTitle}</h3>${subtitle ? `<em style="font-size: 0.9em; color: #3a3a3a; display: block; margin-top: 4px;">${subtitle}</em>` : ""}</header>
                <div style="font-size: 13px; line-height: 1.5;">
                    <p style="margin: 0 0 8px 0;"><strong>Overview:</strong> ${GeneratorUtils.getAorAn(bAge)} <strong>${bAge.toLowerCase()}</strong> ${bType.toLowerCase()} from <strong>${bOrigin}</strong>, dating back approximately ${bAgeTime}. It is a recognized work of <strong>${bGenre}</strong>.</p>
                    <p style="margin: 0 0 8px 0;"><strong>Physical State:</strong> It contains around ${countPages} pages, written in <strong>${bLanguage}</strong>${sizeDesc}. ${bCondition} ${bFeatures.trim()}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Contents & Style:</strong> A cursory skim reveals prose of <strong>${bQuality.toLowerCase()}</strong> quality. ${bPeculiarities.trim()}</p>
                    ${footNote ? `<div style="background: #d8d3c4; border-left: 4px solid #5a1212; padding: 6px 10px; margin: 10px 0; font-style: italic;">${footNote}</div>` : ""}
                </div>
                <footer style="border-top: 1px dashed #777; margin-top: 10px; padding-top: 6px; font-size: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span><strong>Study Time:</strong> ${studyTime}h</span><span><strong>Skim Time:</strong> ${skimTime}h</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span><strong>Appraisal:</strong> ${priceStringArray.join(' ')}</span><span><strong>Enc:</strong> ${encumbrance}</span></div>
                    <div style="text-align: center; background: #2b2b2b; color: white; padding: 4px; border-radius: 3px;"><strong>@UUID[Item.${newItem.id}]{Drag & Drop: ${finalTitle}}</strong></div>
                </footer>
            </div>`;
            
            await GeneratorUtils.sendGMChatMessage(message, "Verena's Scholar");

        } catch (error) {
            ui.notifications.error(error.message);
            console.error("WFRP4e Generators Error:", error);
        }
    }
}