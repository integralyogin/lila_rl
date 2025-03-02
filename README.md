# Lila RL - Modular Roguelike Game

A browser-based roguelike game built with modern JavaScript using a component-based entity system and a data-driven approach inspired by ADOM, UO, DF/Rimworld, D1, D2, CoQ, TOME, Catacylsm:DDA / 7D2D, Pokemon/DemonRL, MTG, FF Tactics and ADND 

## Keywords

`#roguelike` `#javascript` `#browser-game` `#procedural-generation` `#component-based` `#data-driven` `#turn-based` `#dungeon-crawler` `#permadeath` `#rpg` `#ascii`

## Licence 
Creative Commons Attribution-NonCommercial 4.0 International License
This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License](LICENSE.md).
https://github.com/integralyogin/lila_rl/blob/master/LICENSE.md

## Screenshot
<div align="center">
  <a href="/SCREENSHOTS/magic.png">
    <img src="/SCREENSHOTS/magic.png" alt="Magic" width="200"/>
  </a>
  <a href="/SCREENSHOTS/spellbook.png">
    <img src="/SCREENSHOTS/spellbook.png" alt="Spellbook" width="200"/>
  </a>
  <a href="/SCREENSHOTS/shop.png">
    <img src="/SCREENSHOTS/shop.png" alt="Shop" width="200"/>
  </a>
  <a href="/SCREENSHOTS/viewdata.png">
    <img src="/SCREENSHOTS/viewdata.png" alt="ViewDataUI" width="200"/>
  </a>

</div>

## Play Online
Play Lila RL at: [The Infinite Library](http://theinfinitelibrary.net/games/lila_rl/)


## Features

- Procedurally generated dungeons
- Data-driven world design using JSON configuration
- Turn-based gameplay
- Field of view and exploration
- Combat system
- Items and inventory management
- Monsters with basic AI
- Experience and leveling
- NPCs with dialogue
- Shops and trading

## Architecture

The game is built using a component-based entity system with a modular, data-driven architecture:

- **Entity Component System**: Entities are composed of reusable components
- **Event System**: Modules communicate via events
- **Systems**: Logic is separated into independent systems (rendering, input, FOV, etc.)
- **State Management**: Centralized game state
- **Data-Driven Design**: Game content is defined in JSON files for easy modification

### Core Systems

The game functionality is divided into the following key systems:

| System | File | Responsibility |
|--------|------|----------------|
| **Game Controller** | `game.js` | Main game loop, initialization, and coordination between systems |
| **Input System** | `inputSystem.js` | Processes keyboard/mouse input, handles player actions and movement |
| **Render System** | `renderSystem.js` | Draws the game map, entities, and UI elements including player stats |
| **FOV System** | `fovSystem.js` | Calculates field-of-view for exploration and visibility |
| **Action System** | `actionSystem.js` | Manages turn-based actions like combat, movement, and item use |
| **Targeting System** | `targetingSystem.js` | Handles selecting targets for spells and ranged abilities |
| **Entity Factory** | `entityFactory.js` | Creates entities from templates defined in data files |
| **Mouse Handler** | `mouse_handler.js` | Processes mouse interactions for UI and map navigation |

### UI Components

The game has several UI screens for different game functions:

| UI Component | File | Purpose |
|--------------|------|---------|
| **Inventory UI** | `inventoryUI.js` | Display and interact with player inventory |
| **Spellbook UI** | `spellbookUI.js` | Manage and cast spells |
| **Shop UI** | `shopUI.js` | Buy/sell items with merchants |
| **Character UI** | `characterUI.js` | View and upgrade player stats |
| **Dialogue UI** | `dialogueUI.js` | NPC conversations |

## Directory Structure

```
/rogue2/
├── data/                # Game data as JSON
│   ├── maps/            # Map definitions and configurations  
│   │   ├── town.json      # Town map layout and NPCs
│   │   ├── dungeon.json   # Dungeon generation parameters
│   │   ├── forest.json    # Forest area definition
│   │   └── ...            # Other map areas
│   ├── items.json       # Item definitions
│   ├── monsters.json    # Monster definitions
│   ├── player.json      # Player starting stats
│   ├── shops/           # Shop inventories
│   └── spellbooks.json  # Magic spell definitions
├── src/
│   ├── core/            # Core game engine code
│   │   ├── eventEmitter.js   # Event system
│   │   └── gameState.js      # Global state management
│   ├── entities/        # Entity-related code
│   │   ├── entity.js         # Base entity class
│   │   ├── entityFactory.js  # Factory for creating entities
│   │   └── components.js     # Entity components
│   ├── systems/         # Game systems
│   │   ├── fovSystem.js      # Field of view calculations
│   │   ├── inputSystem.js    # Input handling
│   │   └── renderSystem.js   # Rendering
│   ├── ui/              # User interface components
│   │   ├── inventoryUI.js    # Inventory screen
│   │   ├── shopUI.js         # Shop interface
│   │   └── ...               # Other UI components
│   ├── world/           # World generation
│   │   ├── map.js            # Map data structure
│   │   ├── dungeonGenerator.js # Procedural dungeon generation
│   │   └── townGenerator.js  # Town generation
│   ├── constants.js     # Game constants and configuration
│   └── game.js          # Main game initialization
├── index.html           # Entry point HTML
└── style.css            # Global styles
```

## Controls

### Keyboard Controls
- **Arrow keys** or **WASD**: Move/attack in cardinal directions (or interrupt automatic pathfinding)
- **Home/End/PgUp/PgDn**: Move/attack diagonally (or interrupt automatic pathfinding)
- **i**: Open inventory
- **e** or **g** or **,**: Pick up item
- **>**: Use stairs (when standing on them)
- **.** or **5** or **Space**: Wait a turn
- **b**: Open spellbook
- **c**: Open character screen
- **t**: Talk to nearby NPC
- **f**: Toggle pause/resume automatic pathfinding
- **Alt+p**: Toggle pathfinding mode
- **ESC**: Close menus or cancel pathfinding

### Mouse Controls
- **Left-click** on map: Move to location (pathfinding)
- **Left-click** on enemy: Attack enemy (when adjacent)
- **Left-click** on items/doors/stairs: Interact when in range
- **Left-click** in inventory: Select and use items
- **Left-click** in spellbook: Select and cast spells
- **Mouse hover**: Display tooltips for entities and tile information
- **Shift+click**: Invert pathfinding behavior (single step if pathfinding enabled, full path if disabled)
- **Right-click** or **ESC**: Cancel current pathfinding

## Running the Game

Open `index.html` in a web browser to play the game.

## Data-Driven Design

The game uses a data-driven approach with JSON files that define game content:

### Map System

Maps are defined in JSON files in the `data/maps/` directory:

- **Town maps** (like `town.json`): Define buildings, NPCs, shops, and exit points
- **Dungeon configuration** (`dungeon.json`): Define parameters for procedural dungeon generation
- **Area maps** (like `forest.json`, `hills.json`): Define specialized areas with their own NPCs and items

### Entity Templates

Entities are defined in JSON files:

- **monsters.json**: Defines monster types, stats, and loot
- **items.json**: Defines weapons, armor, potions, and other items
- **spellbooks.json**: Defines magical spells and their effects

### Modular Entity System

The game uses a modular entity system where:

- Entity templates are defined centrally in the respective JSON files (`monsters.json`, `items.json`)
- Maps can reference these entities by ID without duplicating the entity data
- The entity factory handles instantiation based on the template data

For example, a map can define monster spawns like this:

```json
"monsters": [
  { "id": "goblin", "weight": 70 },
  { "id": "orc", "weight": 20 },
  { "id": "troll", "weight": 10 }
]
```

This references the monster definitions in `monsters.json` instead of duplicating the monster data. The game will automatically look up the full monster template when needed.

### Adding Content

To add new content to the game:

1. **New map area**: Create a new JSON file in `data/maps/` defining the area's layout, NPCs, exits, and entity references
2. **New monster**: Add a new monster definition to `monsters.json`
3. **New item**: Add a new item definition to `items.json`
4. **Reference in maps**: Use the ID from your monster/item definitions when adding them to maps

## Code Architecture

### Code Refactoring

The codebase follows a modular architecture and has been refactored to improve maintainability:

1. **Splitting Large Files**: Larger files have been split into more focused modules:
   - Combat system extracted from `inputSystem.js` to `combatSystem.js`
   - AI logic extracted from `inputSystem.js` to `aiSystem.js`
   - UI tooltips extracted from `inputSystem.js` to `tooltipSystem.js`
   
2. **Recent Bug Fixes**:
   - Fixed entity storage (now consistently using Map instead of Array)
   - Added compatibility layer for array operations on the Map with `_entitiesArray` getter
   - Fixed mouse movement and hover functionality 
   - Repaired tooltips and entity inspection on hover
   - Added emergency reset functionality (backtick key) to recover from stuck states
   - Implemented A* pathfinding for mouse movement with automatic step-by-step path following
   - Added path visualization with highlighted tiles and step numbers
   - Added a delay between movement steps for smooth, visible movement
   - Implemented pathfinding toggle (Alt+P) and manual cancellation (ESC/right-click)
   - Added automatic pathfinding interruption when taking damage
   - Maintained turn-based energy system with step-by-step movement

3. **Planned Refactoring**:
   - Further modularize `game.js` into data management and map generation
   - Break `spell_logic.js` into core spell system, damage spells, utility spells, and summoning spells

4. **Improved Separation of Concerns**: Each module has a clearly defined responsibility:
   - System files handle game mechanics (AI, combat, movement)
   - UI files handle user interface components
   - Core files handle state management and coordination

### File Sizes

The codebase consists of several JavaScript files, with the largest ones being:

| File | Size | Description |
|------|------|-------------|
| game.js | 65K | Main game orchestration, initialization, and game loop |
| inputSystem.js | 69K | Handles user input processing, keybindings, and game actions |
| spell_logic.js | 48K | Implementation of spell mechanics and effects |
| components.js | 35K | Entity component definitions for the ECS architecture |
| shopUI.js | 25K | Shop interface and transaction handling |
| entityFactory.js | 23K | Factory for creating game entities from templates |
| renderSystem.js | 19K | Handles all game rendering, UI elements, and display |
| inventoryUI.js | 17K | Inventory management interface |
| characterUI.js | 15K | Character stats and progression UI |
| spellbookUI.js | 15K | Spell selection and casting interface |

## Extending the Game Code

New features can be added by:

1. Adding new components to `components.js` to enable new entity behaviors
2. Creating new entity types in `entityFactory.js`
3. Adding new systems or extending existing ones
4. Adding new JSON data files to define game content

### Adding New Spells

The spell system is modular and data-driven. To add a new spell:

1. Add a new spell definition to `data/spellbooks.json` with appropriate properties
2. Register the spell implementation in `src/spells/spell_logic.js`

Example spell JSON structure:
```json
{
  "id": "fireball",
  "name": "Fireball Spellbook",
  "char": "+",
  "color": "#ff4500",
  "type": "spellbook",
  "spellId": "fireball",
  "spellName": "Fireball",
  "description": "A powerful fire spell that damages multiple enemies.",
  "element": "fire",
  "manaCost": 12,
  "baseDamage": 14,
  "range": 6,
  "aoeRadius": 2,
  "price": 150,
  "effects": ["damage", "area_effect"],
  "tags": ["attack", "fire", "area", "target"]
}
```

The spell_logic.js file handles all the logic for targeting and casting spells, so you only need to implement the spell's effects there without modifying the UI code.

