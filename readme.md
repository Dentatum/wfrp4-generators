# WFRP4e Random Generators

This module provides a collection of macros designed to generate randomized elements for **Warhammer Fantasy Roleplay 4th Edition (WFRP4e)**. It incudes settlements, books, inns, and more. It has also some utilities that could help making your games more immersive, like a Morrslieb phase generator.

The module is inspired by the *Liber Fanatica* Series for WFRP2. You can find the original, full documents inside, in a compendium called *Source*.

## Manual installation

You can install this module manually in Foundry VTT by using the manifest link.

1. Open your Foundry VTT application and navigate to the **Add-on Modules** tab.
2. Click the **Install Module** button at the bottom left.
3. Paste the following link into the **Manifest URL** field at the bottom of the window:
   `https://raw.githubusercontent.com/Dentatum/wfrp4-generators/refs/heads/main/module.json`
4. Click **Install**.
5. Once inside your world, go to the **Manage Modules** settings and enable the module.

## How to use

The module will load a compendium called *Generators*. All you have to do is opening it, clicking on any of the macros it contains and click on *Execute Macro*. You can also drag and drop the macro into the hotbar and use it from there.

### Inn and settlement generators

When macros are executed, a window will pop, with some options that can be selected or randomized. As soon as the button *Generate* is clicked, a message will be sent to the GM with the related information. Additionally, a journal object will store the output each time it's created. This journal is located inside a folder called *WFRP4 - Generators* (journals).

Further detailed information can be found in *Liber Fanatica III*.

### Book generator

This macro will result in a chat message with information about a random book. Additionally, an miscellaneous item will be created with the resulted info. This item can be found inside a folder called *WFRP4 - Generators* (items).

Further detailed information can be found in *Liber Fanatica III*.

### Morrslieb phase

This macro is intended to represent the erratic phase of Morrslieb. There is a 4% chance of getting the result 'full'. When that occurs, the macro identifies the scene and creates a green lightsource at the exact center of it. **Note**: If you use this macro when the light is present, this light will be be deleted.

Further detailed information can be found in *Liber Fanatica IV*.

### Loot generator (Work in progress)

This macro will generate loot based on the difficulty of a combat, under GM criteria. The result will be posted as a chat message and also will be created in a journal page.