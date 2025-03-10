# Lila RL Development Status
### THE IDEAL


### GOALS
- alchemy
- crafting
- skills
- harvesting resources
- build monsters in game.
- proper stat advancement (exercise/abuse stats)

### ROADMAP
alpha 0 - main structure, could make most of a roguelike from this through data change alone via llm gen or procedural gen.
alpha 1 - integrate philosophy and religion, Savitri [masters]
alpha 2 - hide philosophy and religion
alpha 3 - full structure and data for any and all [school] (could make any roguelike from it)
alpha 4 - 

## CREATE  [ createUI -- item, spell, monster, tile, map ]
- the creation of objects/tiles, beings, enemies, items, spells, maps being done in game forces components to be data driven
- create magic wand with charges test
- create object, place, edit obj
- create spell
- create item
- create tree that grows
- add item load to createItem, 
- 

## TODO
- time and day

## is WORKING?
- equipment on monsters that drops on death
- enemy magic?
- is summon magic working

## FIX / BROKEN
- arena broken.  arena to use behaviourai

### COMPLEX MISSING
- lich vs wizard proper in arena
- item that grants aura on equip etc
- phantom limb spell that grants inventory slot
- wizard shopkeeper robbing and dying from test
- create a dragon in game with fire breath, create knight in game
- grass > seed > plant > tree > fruit + plant = potion


### SPELLS
- cone for breath
- beam


### COMBAT
- limb damage and practical implications

### FROM GAMES
SC - campaign editor


## DONE
- polymorph

### TODO-DONE


| Feature | Status | Description |
|---------|--------|-------------|
| Basic Movement | ✅ Complete | Player can move around maps using keyboard and mouse |
| Map Generation | ✅ Complete | Multiple map types (town, dungeon, forest) |
| Combat System | ✅ Complete | Turn-based combat with stats and damage calculation |
| Inventory System | ✅ Complete | Items can be picked up, equipped, and used |
| Item Effects | ✅ Complete | Items have various effects when used |
| Spell System | ✅ Complete | Player can learn and cast spells |
| Targeting System | ✅ Complete | Area and single-target spell support |
| FOV and LOS | ✅ Complete | Field of view and line of sight systems |
| Basic AI | ✅ Complete | Monsters can navigate and attack player |
| Spellcasting AI | ✅ Complete | Monsters can cast spells at player |
| Data-Driven AI | ✅ Complete | AI behavior defined in data files |
| Ally System | ✅ Complete | Summoned creatures follow and assist player |
| UI Systems | ✅ Complete | Inventory, character sheet, spellbook interfaces |
| Dialog System | ✅ Complete | NPCs can have conversations with player |
| Shop System | ✅ Complete | Basic buying/selling functionality |
| Quest System | ❌ Incomplete | Quest tracking and completion rewards |
| Character Progression | ❌ Incomplete | Leveling and skill advancement |
| Dungeon Generation | ✅ Complete | Random dungeons with rooms and corridors |
| Save/Load System | ❌ Incomplete | Persistence between play sessions |
| Game Balance | ❌ Incomplete | Overall difficulty and progression tuning |
| Sound Effects | ❌ Incomplete | Audio feedback for actions and events |
| Visual Effects | ✅ Complete | Spell effects and combat animations |
| More Monster Types | ❌ Incomplete | Greater variety of enemies and behaviors |
| Boss Encounters | ❌ Incomplete | Special challenging combat encounters |
| Environmental Effects | ❌ Incomplete | Terrain that affects gameplay (water, lava, etc.) |
| Tutorial | ❌ Incomplete | Introduction to game mechanics |

## Current Focus

- ✅ Monster spell casting - Implemented data-driven AI behavior system enabling monsters to cast spells including the Fire Mage
- ❌ Save/Load system - Serialize game state to allow saving and loading games
- ❌ Character progression - Implement experience points and leveling
- ❌ Balance town encounters - Ensure town NPCs are properly non-hostile

## Known Issues

- Gladiator in arena has buggy AI (temporarily disabled)
- Targeting system sometimes allows targeting through walls
- Some spell effects may not properly target or visualize
- Monster threat assessment could be improved
- UI for player health/mana could be more prominent
- Console may contain excessive debug messages

## Refactoring Needs

- ✅ Clean up monster spell casting system
- ❌ Better separation of rendering and game logic
- ❌ Event system improvements
- ❌ Normalize data handling across game systems





