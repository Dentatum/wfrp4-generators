// File: modules/wfrp4e-generators/scripts/utils.js

export class GeneratorUtils {
    
    /**
     * Evaluates a dice formula in Foundry VTT and returns the numeric total.
     */
    static async rollDice(formula) {
        const roll = new Roll(formula);
        await roll.evaluate();
        return roll.total;
    }

    /**
     * Fetches a text file from a given path, reads it, and splits it into an array of lines.
     * Automatically filters out empty or whitespace-only lines to prevent parsing errors.
     */
    static async loadTableData(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Table not found at ${path}`);
            
            const text = await response.text();
            // Split by line and filter out empty strings
            return text.split('\n').filter(line => line && line.trim() !== "");
        } catch (error) {
            ui.notifications.error(`Generators Error: Failed to fetch table data. Check console.`);
            console.error(`WFRP4e Macro Error | Data Fetch Exception for path ${path}:`, error);
            return [];
        }
    }

    /**
     * Finds an existing folder by name and type, or creates a new one if it doesn't exist.
     * Useful for both Items (Books) and JournalEntries (Inns, Settlements).
     */
    static async getOrCreateFolder(folderName, type) {
        let folder = game.folders.find(f => f.name === folderName && f.type === type);
        
        if (!folder) {
            folder = await Folder.create({ 
                name: folderName, 
                type: type,
                sorting: "a" // Alphabetical sorting by default
            });
        }
        
        return folder;
    }

    /**
     * Saves generated HTML content as a new page inside a specific Journal Entry.
     * Automatically handles the creation of the folder and the journal itself if they are missing.
     * Sets ownership to GM only by default to keep generated locations secret.
     * * @param {string} folderName - Folder where the journal lives
     * @param {string} journalName - Name of the Journal Entry (e.g., "Discovered Inns")
     * @param {string} pageName - Name of the specific page (e.g., "The Prancing Pony")
     * @param {string} htmlContent - The compiled HTML content to save
     */
    static async saveToJournal(folderName, journalName, pageName, htmlContent) {
        const folder = await this.getOrCreateFolder(folderName, "JournalEntry");
        
        // Find or create the target journal
        let journal = game.journal.find(j => j.name === journalName && j.folder?.id === folder.id);
        if (!journal) {
            journal = await JournalEntry.create({ 
                name: journalName, 
                folder: folder.id,
                ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE } // GM only
            });
        }

        // Create a new page inside the journal
        await JournalEntryPage.create({
            name: pageName,
            type: "text",
            text: { format: 1, content: htmlContent } // 1 represents HTML format in Foundry
        }, { parent: journal });
    }

    /**
     * Sends a whispered chat message to the Game Master.
     * * @param {string} content - HTML content of the message
     * @param {string} [alias="WFRP4e Generator"] - Optional custom alias for the speaker
     */
    static async sendGMChatMessage(content, alias = "WFRP4e Generator") {
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ alias: alias }),
            content: content,
            whisper: ChatMessage.getWhisperRecipients("GM")
        });
    }

    /**
     * Helper to return the correct grammatical article for a word.
     * Extracted from the book generator.
     * * @param {string} word - The target word
     * @returns {string} "A" or "An"
     */
    static getAorAn(word) {
        return /^[aeiou]/i.test(word) ? "An" : "A";
    }
}