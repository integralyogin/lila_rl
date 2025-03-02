# Source Files Information
This document provides descriptions for all source files in the lila_rl game project to help with understanding the codebase structure and functionality.

## CORE FILES
./constants.js ::: Global game constants including movement speeds, game states, action types, damage types, entity types, and UI configurations.
./game.js ::: Main game entry point that initializes game systems, manages the game loop, and coordinates between different game systems and states.

## CORE DIRECTORY
./core/eventEmitter.js ::: Implementation of the observer pattern that allows game components to communicate through events without direct coupling.
./core/gameLoader.js ::: Handles loading game data from JSON files including maps, items, monsters, and player data.
./core/gameState.js ::: Manages the current state of the game including player information, game mode, current map, and global game variables.

## ENTITIES DIRECTORY
./entities/entity.js ::: Base Entity class that implements the component-entity system, allowing entities to have components attached for specific behaviors.
./entities/entityFactory.js ::: Factory functions for creating various game entities (players, monsters, items, etc.) with proper components.
./entities/components.js ::: Legacy file containing component definitions before they were split into separate files.
./entities/ally_logic.js ::: Contains logic for ally NPCs, including decision making, follow behavior, and combat assistance.
./entities/components/index.js ::: Exports all component types from individual files to provide a unified import mechanism.
./entities/components/baseComponents.js ::: Basic components that can be attached to any entity such as Position, Renderable, and Name.
./entities/components/combatComponents.js ::: Combat-related components including Health, Damage, Combat Stats, and Status Effects.
./entities/components/itemComponents.js ::: Components for item entities such as Equippable, Consumable, and Container.
./entities/components/magicComponents.js ::: Magic-related components like ManaPool, SpellBook, and SpellEffect.
./entities/components/socialComponents.js ::: Components for social interactions including Dialogue, Reputation, and Faction.
./entities/components/aiComponents.js ::: AI behavior components for NPCs and monsters including Aggression, Patrol, and Flee behaviors.
./entities/ai/aiBehaviorManager.js ::: Central manager for AI behaviors that coordinates behavior selection and execution for entities.
./entities/ai/monsterSpellcaster.js ::: Handles spell selection and casting logic for monster entities with magical abilities.
./entities/ai/behaviorDefinition.js ::: Defines the structure and interface for AI behavior patterns.
./entities/ai/behaviorLoader.js ::: Loads and instantiates AI behaviors from configuration files.

## SYSTEMS Directory
./systems/actionSystem.js ::: Processes and executes game actions like movement, attacks, and item usage.
./systems/aiSystem.js ::: Updates AI behaviors for all entities with AI components, managing decision making and action execution.
./systems/arenaSystem.js ::: Manages arena combat encounters including spawning enemies, tracking combat progress, and rewards.
./systems/combatSystem.js ::: Handles combat calculations including hit chance, damage calculation, critical hits, and death.
./systems/fovSystem.js ::: Field of view calculations that determine what entities can see based on map layout and lighting.
./systems/inputSystem.js ::: Processes keyboard and other input devices, translating them into game actions.
./systems/mouseSystem.js ::: Handles mouse interactions including hover effects, clicks, and drag operations.
./systems/pathfindingSystem.js ::: Calculates paths for entities to navigate the game map, avoiding obstacles.
./systems/renderSystem.js ::: Renders game elements to the screen including map, entities, effects, and UI elements.
./systems/targetingSystem.js ::: Manages target selection for attacks, spells, and other targeted actions.

## SPELLS Directory
./spells/spell_logic.js ::: Core spell system that defines how spells work, spell casting process, and manages spell effects.
./spells/helpers.js ::: Utility functions for spell effects including targetting, damage calculations, and effect application.
./spells/implementations/aoeSpells.js ::: Area of effect spell implementations including fireballs, frost novas, and area healing.
./spells/implementations/auraSpells.js ::: Persistent effect spells that apply buffs or debuffs over time to affected entities.
./spells/implementations/boltSpells.js ::: Direct damage and effect spells that target single entities like magic missile and healing touch.
./spells/implementations/summoning.js ::: Spell implementations for summoning temporary allies and creating persistent constructs.
./spells/implementations/utilitySpells.js ::: Non-combat spell effects like teleportation, invisibility, and detect magic.

## UI Directory
./ui/arenaUI.js ::: User interface for arena combat mode showing enemies, combat status, and arena controls.
./ui/characterUI.js ::: Character information display including stats, level, experience, and equipped items.
./ui/contextMenuUI.js ::: Right-click context menu system for entities providing contextual actions.
./ui/dialogueUI.js ::: Dialogue system interface for NPC conversations, quest information, and narrative elements.
./ui/inventoryUI.js ::: Player inventory interface showing items, equipment, and providing item manipulation.
./ui/mouse_handler.js ::: Low-level mouse input processing including clicks, movement, and scroll events.
./ui/shopUI.js ::: Shop interface for buying and selling items with merchant NPCs.
./ui/spellbookUI.js ::: Interface for viewing, organizing, and casting spells from the players spellbook.
./ui/summoningUI.js ::: Interface for summoning and managing summoned creatures and constructs.
./ui/tooltipSystem.js ::: System for displaying contextual information tooltips for game elements.

## Utils Directory
./utils/entityUtils.js ::: Utility functions for working with entities including filtering, finding, and manipulating entity collections.
./utils/pathfinding.js ::: Pathfinding algorithms implementation (A*) used by entities to navigate the game world.

## World Directory
./world/map.js ::: Map data structure and operations including tile management, collision detection, and map manipulation.
./world/levelGenerator.js ::: Base class for procedural level generation with common functionality.
./world/dungeonGenerator.js ::: Procedural generation for dungeon levels with rooms, corridors, treasures, and monsters.
./world/townGenerator.js ::: Town generation with buildings, NPCs, shops, and quest givers.
./world/mapLoader.js ::: Loads map data from JSON files and converts it into the games internal map format.
