import { SettlementGenerator } from "./settlement.js";
import { InnGenerator } from "./inn.js";
import { BookGenerator } from "./book.js";
import { MorrsliebGenerator } from "./morrslieb.js";
import { LootGenerator } from "./loot.js";

Hooks.once('init', () => {
    console.log("WFRP4e Generators | Initializing module and exposing API");

    // Expose the API to the global 'game' object.
    // We bind the methods to their respective classes to ensure 'this' refers 
    // to the class context (giving them access to their static paths).
    game.wfrp4eGenerators = {
        generateSettlement: SettlementGenerator.promptAndGenerate.bind(SettlementGenerator),
        generateInn: InnGenerator.promptAndGenerate.bind(InnGenerator),
        generateBook: BookGenerator.generate.bind(BookGenerator),
		generateMorrslieb: MorrsliebGenerator.generate.bind(MorrsliebGenerator),
		generateLoot: LootGenerator.start.bind(LootGenerator)
    };
});

Hooks.once('ready', () => {
    console.log("WFRP4e Generators | Ready to roll!");
});