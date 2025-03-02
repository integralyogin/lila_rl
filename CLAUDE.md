# Claude Reference Guide for lila_rl

This document provides essential context for Claude instances working on this project, especially those without full codebase access.

## Project Overview

lila_rl is a browser-based roguelike game built with JavaScript using an Entity Component System (ECS) architecture. The game is heavily focused on data-driven design with game content defined in JSON files. Inspired by classic roguelikes like ADOM, TOME, Cataclysm RL, and games like Diablo.

### Core Features
- Turn-based combat with stats and damage calculation
- Extensive spell system with various spell types and effects
- Procedurally generated dungeons, persistent town maps
- NPC interaction with dialogue and shops
- Inventory and equipment system with limb-based equipping
- Monster AI with behavior types defined in data
- Field of view and exploration mechanics

## Data-Driven Architecture

The project's primary architectural philosophy is to be data-driven, with game content and behavior defined in JSON files:

### Data Files
- **monsters.json**: Defines monster types with stats, AI behaviors, spells, and equipment
- **items.json**: Defines weapons, armor, potions, and other usable items
- **spellbooks.json**: Defines magical spells and their effects, costs, and targeting
- **player.json**: Defines player starting stats, inventory, and known spells
- **maps/**: Contains map layouts and definitions
  - **town.json**: Defines town layout with NPCs, shops, and exits
  - **dungeon.json**: Parameters for procedural dungeon generation
  - **arena.json**: Combat arena configuration

### Entity Templates

The game uses a template-based entity system where:
1. Base definitions are stored in JSON (monsters.json, items.json)
2. Entities reference these templates by ID
3. The entity factory instantiates entities from templates with possible modifications

For example, a spell defined in spellbooks.json:
```json
{
  "id": "fireball",
  "name": "Fireball Spellbook",
  "spellId": "fireball",
  "manaCost": 12,
  "baseDamage": 14,
  "range": 6,
  "aoeRadius": 2,
  "effects": ["damage", "area_effect"],
  "tags": ["attack", "fire", "area", "target"]
}
```

## Component-Entity System Architecture

The game uses a component-based entity system where:

- **Entities** are unique objects (players, monsters, items) identified by an ID
- **Components** are data containers attached to entities (Position, Health, Combat, etc.)
- **Systems** process entities with specific components (RenderSystem, CombatSystem, etc.)

### Key Systems

| System | Purpose |
|--------|---------|
| **Game Controller** | Main coordination and game loop |
| **Input System** | Handle player input and actions |
| **Combat System** | Process attacks, damage, death |
| **AI System** | Control monster behavior and decisions |
| **Spell System** | Handle spell casting and effects |
| **FOV System** | Calculate field of view and vision |
| **Rendering System** | Display all game elements |

## Future Development Goals

The TODO.md file indicates these primary development goals:
1. Alchemy and crafting systems
2. In-game content creation (create monsters, objects, spells, items)
3. Limb damage with practical effects in combat
4. Resource harvesting and skill advancement
5. Complex spell effects like polymorph
6. Missing features: save/load, character progression, quest system

## Common Tasks and Code Patterns

### Adding a New Spell

1. Add the spell definition to `data/spellbooks.json`
2. Add the spell implementation to `src/spells/spell_logic.js` or appropriate file in `spells/implementations/`

### Creating a New Monster

1. Add monster definition to `data/monsters.json` with stats and AI behavior
2. For complex behaviors, add behavior logic in `entities/ai/`
3. Test in arena mode or in specific map

### Extending Map Areas

1. Create a new JSON file in `data/maps/` 
2. Define the map layout, NPCs, exits, and item/monster references
3. Connect it to existing maps through exit points

## Code Structure

The codebase utilizes multiple architectural patterns:
- **Entity Component System**: Core game architecture
- **Observer Pattern**: Via EventEmitter for decoupled communication
- **Factory Pattern**: EntityFactory creates entities from templates
- **State Machine**: For game states and AI behaviors
- **Data-Driven Design**: Content defined externally in JSON

### Key Files to Understand

- `src/game.js`: Main game initialization and coordination
- `src/entities/entity.js`: Base entity class implementation
- `src/entities/components/`: Component definitions
- `src/spells/spell_logic.js`: Core spell system
- `src/systems/`: Game systems that process entities
- `src/core/eventEmitter.js`: Event system for communications

## User Context

User has experience with game development but needs detailed understanding of this codebase's architecture. User's goals:

1. Better understand the ECS implementation to make more advanced changes
2. Implement in-game content creation (monsters, spells, items)
3. Work on missing systems (alchemy, crafting, resource harvesting)
4. Learn how to extend the data-driven aspects of the game

## Coding Style Guidelines

- Use camelCase for variables and functions
- Use PascalCase for classes
- Add components to entities through factory methods
- Keep systems focused on single responsibilities
- Use the event system for cross-system communication
- Leverage the data-driven approach - add data to JSON files rather than hardcoding values

## Essential File Reference

See SRC_FILES_INFO.md for detailed descriptions of all source files.