import { GAME_WIDTH, GAME_HEIGHT, TILE_TYPES } from './constants.js';
import gameState from './core/gameState.js';
import eventBus from './core/eventEmitter.js';
import EntityFactory from './entities/entityFactory.js';
import FOVSystem from './systems/fovSystem.js';
import RenderSystem from './systems/renderSystem.js';
import inputSystem from './systems/inputSystem.js';
import mouseSystem from './systems/mouseSystem.js';
import pathfindingSystem from './systems/pathfindingSystem.js';
import ActionSystem from './systems/actionSystem.js';
import arenaSystem from './systems/arenaSystem.js';
import InventoryUI from './ui/inventoryUI.js';
import SpellbookUI from './ui/spellbookUI.js';
import DialogueUI from './ui/dialogueUI.js';
import CharacterUI from './ui/characterUI.js';
import ArenaUI from './ui/arenaUI.js';
import SummoningUI from './ui/summoningUI.js';
import GameLoader from './core/gameLoader.js';
import LevelGenerator from './world/levelGenerator.js';
import MapLoader from './world/mapLoader.js';

/**
 * Main Game class that coordinates game systems and manages game state
 */
class Game {
    constructor() {
        // Core game components
        this.entityFactory = new EntityFactory();
        this.systems = [];
        this.ui = {};
        
        // Game data
        this.gameData = {};
        
        // Module loaders
        this.gameLoader = new GameLoader();
        this.mapLoader = new MapLoader();
        
        // Initialize game
        this.initialize();
        
        // Emergency reset handler for debugging
        eventBus.on('emergencyReset', () => this.handleEmergencyReset());
        
        // Add event listener for log messages
        eventBus.on('logMessage', (messageData) => {
            console.log("Log message received:", messageData);
            gameState.addMessage(messageData.message, messageData.type);
        });
    }
    
    /**
     * Emergency reset handler - resets UI state for debugging
     */
    handleEmergencyReset() {
        console.log("EMERGENCY RESET: Resetting UI state");
        
        // Close all UI windows
        eventBus.emit('inventoryClosed');
        eventBus.emit('spellbookClosed');
        eventBus.emit('characterClosed');
        eventBus.emit('dialogueClosed');
        eventBus.emit('shopClosed');
        eventBus.emit('summoningClose');
        
        // Return to exploration mode
        gameState.gameMode = 'exploration';
        
        console.log("Game state reset to exploration mode");
    }
    
    /**
     * Initialize the game
     */
    async initialize() {
        console.log("Initializing game...");
        
        try {
            // Load all game data
            this.gameData = await this.gameLoader.loadGameData();
            
            // Preload maps
            await this.mapLoader.preloadMaps();
            
            // Initialize entity factory with data
            this.entityFactory.initialize(this.gameData);
            
            // Create level generator
            this.levelGenerator = new LevelGenerator(this.entityFactory);
            
            // Create game systems
            this.initializeSystems();
            
            // Create UI components
            this.initializeUI();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start a new game
            this.newGame();
            
            // Notify that game is initialized
            eventBus.emit('gameInitialized');
            
            // Update spell logic with game data (for summoning spells)
            this.updateSpellLogic();
            
            // Store monster templates for AI system
            this.storeMonsterTemplates();
            
        } catch (error) {
            console.error("Failed to initialize game:", error);
        }
    }
    
    /**
     * Initialize game systems
     */
    initializeSystems() {
        const renderSystem = new RenderSystem();
        const fovSystem = new FOVSystem();
        const actionSystem = new ActionSystem();
        
        // Note: inputSystem, mouseSystem, pathfindingSystem, and arenaSystem 
        // are already initialized as they export singleton instances
        
        this.systems = [renderSystem, fovSystem, actionSystem];
        
        // Register systems with game state
        gameState.registerSystem('RenderSystem', renderSystem);
        gameState.renderSystem = renderSystem; // Store a direct reference for spell effects
        gameState.registerSystem('FOVSystem', fovSystem);
        gameState.registerSystem('InputSystem', inputSystem);
        gameState.registerSystem('MouseSystem', mouseSystem);
        gameState.registerSystem('PathfindingSystem', pathfindingSystem);
        gameState.registerSystem('ActionSystem', actionSystem);
        gameState.registerSystem('ArenaSystem', arenaSystem);
        
        // Listen for player movement events from mouse system and pathfinding system
        eventBus.on('movePlayer', ({dx, dy}) => {
            // Forward to movement method in input system
            inputSystem.tryMove(dx, dy);
        });
        
        // Listen for pickup item events from mouse system
        eventBus.on('pickupItem', () => {
            inputSystem.tryPickupItem();
        });
    }
    
    /**
     * Initialize UI components
     */
    initializeUI() {
        this.ui.inventory = new InventoryUI();
        this.ui.spellbook = new SpellbookUI();
        this.ui.dialogue = new DialogueUI();
        this.ui.character = new CharacterUI();
        this.ui.arena = new ArenaUI();
        this.ui.summoning = SummoningUI; // Already instantiated as a singleton
        
        // Note: mouseSystem is already initialized as a singleton
        // No need to initialize MouseHandler separately
        
        // Load context menu UI
        import('./ui/contextMenuUI.js').then(module => {
            // Context menu is already initialized as a singleton
            console.log("Context menu UI loaded");
        });
        
        // Load ShopUI dynamically
        import('./ui/shopUI.js').then(module => {
            const ShopUI = module.default;
            this.ui.shop = new ShopUI();
            this.ui.shop.entityFactory = this.entityFactory;
            
            // Make the shop UI available globally for direct access
            window.game = window.game || {};
            window.game.shopUI = this.ui.shop;
            window.game.summoningUI = this.ui.summoning;
            console.log("UI components initialized and attached to window.game for direct access");
        });
    }
    
    /**
     * Update spell logic with game data
     */
    updateSpellLogic() {
        // Use dynamic import for browser compatibility
        import('./spells/spell_logic.js').then(module => {
            const spellLogic = module.default;
            spellLogic.updateGameData(this.gameData);
            
            // Store for global reference to avoid reimporting
            window.gameSpellLogic = spellLogic;
            gameState.spellLogic = spellLogic;
            
            console.log("Updated spellLogic with game data:", Object.keys(this.gameData));
            console.log("SpellLogic is now available at window.gameSpellLogic");
            
            // Log available spells for debugging
            console.log("Available spell implementations:", 
                        Array.from(spellLogic.spellEffects.keys()));
        }).catch(error => {
            console.error("Error loading spell_logic.js:", error);
        });
    }
    
    /**
     * Store monster templates for AI system to use
     */
    storeMonsterTemplates() {
        if (this.gameData && this.gameData.monsters) {
            // Store monsters in game state for AI system to reference
            gameState.monsterTemplates = this.gameData.monsters;
            console.log("Stored monster templates for AI system:", gameState.monsterTemplates.length);
            
            // Import the monsterSpellcaster and configure monsters with the proper spells
            import('./entities/ai/monsterSpellcaster.js').then(module => {
                const monsterSpellcaster = module.default;
                console.log("Successfully imported monsterSpellcaster");
                
                // Use Array.from to ensure we have an array to filter
                if (gameState.entities && typeof gameState.entities.values === 'function') {
                    const entitiesList = Array.from(gameState.entities.values());
                    
                    
                } else {
                    console.log("No entities or entities is not a valid Map in gameState", gameState.entities);
                }
                
                console.log("Configured monsters for real spell casting");
            }).catch(error => {
                console.error("Error importing monsterSpellcaster:", error);
            });
        }
    }
    
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Player movement events
        eventBus.on('playerMoved', () => {
            this.systems[1].update();  // Update FOV
            this.checkTransitions();   // Check for level transitions
            this.checkDialogueShouldClose();  // Check if dialogue should close
        });
        
        // Turn processing
        eventBus.on('turnProcessed', () => {
            this.systems[1].update();  // Update FOV
            
            // Get ActionSystem directly from gameState rather than using index
            const actionSystem = gameState.getSystem('ActionSystem');
            if (actionSystem) {
                actionSystem.update();
            }
        });
        
        // Stairs and transitions
        eventBus.on('useStairs', async () => {
            if (gameState.map) {
                const x = gameState.player.position.x;
                const y = gameState.player.position.y;
                const tile = gameState.map.getTile(x, y);
                
                // Area exit
                if (tile?.type === TILE_TYPES.AREA_EXIT && tile.exitInfo) {
                    await this.changeArea(tile.exitInfo.name);
                    return;
                }
                
                // Dungeon/town transitions
                if (gameState.location === 'dungeon') {
                    await this.nextLevel();
                } else if (gameState.location === 'town') {
                    this.enterDungeon();
                }
            }
        });
        
        // Town portal spell
        eventBus.on('returnToTown', async () => {
            await this.returnToTown();
        });
        
        // Debug commands
        eventBus.on('messageAdded', (msg) => {
            if (msg.text === "debug") {
                this.debugSpawnSpellbooks();
            }
        });
    }
    
    /**
     * Start a new game
     */
    newGame() {
        console.log("Starting new game...");
        
        // Reset game state
        gameState.currentLevel = 1;
        gameState.score = 0;
        gameState.turn = 0;
        gameState.messages = [];
        gameState.gameMode = 'exploration';
        gameState.location = 'town';
        
        // Generate town
        this.generateTown();
        
        // Initial message
        gameState.addMessage("Welcome to town! Use arrow keys to move. Find the dungeon entrance.", "important");
    }
    
    /**
     * Generate town level
     */
    generateTown() {
        console.log("Generating town...");
        
        // Generate town using level generator
        const result = this.levelGenerator.generateTown(this.gameData.townData);
        
        if (!result || !result.map) {
            console.error("Failed to generate town!");
            return null;
        }
        
        const { map, startPosition } = result;
        
        // Set map in game state
        gameState.map = map;
        gameState.entities = new Map();
        
        // Position player
        let playerX = startPosition[0];
        let playerY = startPosition[1];
        
        // Use spawn point from town data if available
        if (this.gameData.townData && this.gameData.townData.spawn_point) {
            const centerX = Math.floor(GAME_WIDTH / 2);
            const centerY = Math.floor(GAME_HEIGHT / 2);
            playerX = centerX + (this.gameData.townData.spawn_point.x_offset || 0);
            playerY = centerY + (this.gameData.townData.spawn_point.y_offset || 0);
        }
        
        // Create or position player
        if (!gameState.player) {
            const player = this.entityFactory.createPlayer(playerX, playerY);
            gameState.player = player;
            gameState.addEntity(player);
        } else {
            gameState.player.position.moveTo(playerX, playerY);
            gameState.addEntity(gameState.player);
        }
        
        // Populate town with NPCs and items
        this.levelGenerator.populateTown(map, this.gameData.townData);
        
        // Update FOV and render
        this.systems[1].update(); // FOV system
        eventBus.emit('fovUpdated');
        
        return result;
    }
    
    /**
     * Enter the dungeon
     */
    enterDungeon() {
        console.log("Entering dungeon...");
        
        // Save entrance info
        const entranceInfo = this.getCurrentExit();
        
        // Set location to dungeon
        gameState.location = 'dungeon';
        gameState.currentLevel = 1;
        
        // Generate dungeon level
        const result = this.levelGenerator.generateDungeon(this.gameData.dungeonConfig);
        
        if (!result || !result.map) {
            console.error("Failed to generate dungeon!");
            return;
        }
        
        const { map, startPosition } = result;
        
        // Set map in game state
        gameState.map = map;
        gameState.entities = new Map();
        
        // Position player
        if (entranceInfo && entranceInfo.destination_x !== undefined && entranceInfo.destination_y !== undefined) {
            const centerX = Math.floor(GAME_WIDTH / 2);
            const centerY = Math.floor(GAME_HEIGHT / 2);
            const playerX = centerX + entranceInfo.destination_x;
            const playerY = centerY + entranceInfo.destination_y;
            gameState.player.position.moveTo(playerX, playerY);
        } else {
            gameState.player.position.moveTo(...startPosition);
        }
        
        // Add player to entities
        gameState.addEntity(gameState.player);
        
        // Add stairs at entrance (for first level only)
        if (map && startPosition) {
            const entranceX = startPosition[0];
            const entranceY = startPosition[1] + 1;
            map.setTile(entranceX, entranceY, TILE_TYPES.STAIRS_UP);
            map.tiles[entranceY][entranceX].exitInfo = {
                name: 'town',
                signMessage: "Return to town",
                destination_x: 0,
                destination_y: 3
            };
        }
        
        // Populate dungeon
        this.levelGenerator.populateDungeon(map, this.gameData.dungeonConfig, gameState.currentLevel);
        
        // Update FOV and render
        this.systems[1].update();
        eventBus.emit('fovUpdated');
        
        // Notify about map change to reapply auras and other effects
        eventBus.emit('mapChanged');
        
        // Display message
        gameState.addMessage("You enter the dark dungeon. Be careful!", "important");
    }
    
    /**
     * Go to next dungeon level
     */
    async nextLevel() {
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        const tile = gameState.map.getTile(x, y);
        
        // Check stair type
        if (tile) {
            // Stairs up - go back to town or previous level
            if (tile.type === TILE_TYPES.STAIRS_UP) {
                if (gameState.currentLevel === 1 && tile.exitInfo && tile.exitInfo.name === 'town') {
                    await this.returnToTown();
                    return;
                } else if (gameState.currentLevel > 1) {
                    // Go up a level
                    gameState.currentLevel--;
                    const result = this.levelGenerator.generateDungeon(this.gameData.dungeonConfig);
                    
                    if (result && result.map) {
                        gameState.map = result.map;
                        gameState.entities = new Map();
                        gameState.player.position.moveTo(...result.startPosition);
                        gameState.addEntity(gameState.player);
                        
                        // Populate the level
                        this.levelGenerator.populateDungeon(result.map, this.gameData.dungeonConfig, gameState.currentLevel);
                        
                        // Update FOV and render
                        this.systems[1].update();
                        eventBus.emit('fovUpdated');
                        
                        // Notify about map change to reapply auras and other effects
                        eventBus.emit('mapChanged');
                        
                        gameState.addMessage(`You ascend to level ${gameState.currentLevel} of the dungeon.`, "important");
                    }
                    return;
                }
            }
            // Stairs down - go deeper
            else if (tile.type === TILE_TYPES.STAIRS_DOWN) {
                // Increment level
                gameState.currentLevel++;
                
                // Generate new level
                const result = this.levelGenerator.generateDungeon(this.gameData.dungeonConfig);
                
                if (result && result.map) {
                    gameState.map = result.map;
                    gameState.entities = new Map();
                    gameState.player.position.moveTo(...result.startPosition);
                    gameState.addEntity(gameState.player);
                    
                    // Populate the level
                    this.levelGenerator.populateDungeon(result.map, this.gameData.dungeonConfig, gameState.currentLevel);
                    
                    // Update FOV and render
                    this.systems[1].update();
                    eventBus.emit('fovUpdated');
                    
                    // Notify about map change to reapply auras and other effects
                    eventBus.emit('mapChanged');
                    
                    gameState.addMessage(`You descend to level ${gameState.currentLevel} of the dungeon.`, "important");
                }
                return;
            }
        }
        
        // No valid stairs
        gameState.addMessage("There are no stairs here to use.", "error");
    }
    
    /**
     * Return to town from any area
     */
    async returnToTown(currentExit = null) {
        console.log("Returning to town...");
        
        // Set location to town
        gameState.location = 'town';
        
        // Generate town
        const result = this.generateTown();
        
        if (result && result.map) {
            // If we have a source exit with destination coordinates
            if (currentExit && currentExit.destination_x !== undefined && currentExit.destination_y !== undefined) {
                const centerX = Math.floor(GAME_WIDTH / 2);
                const centerY = Math.floor(GAME_HEIGHT / 2);
                const playerX = centerX + currentExit.destination_x;
                const playerY = centerY + currentExit.destination_y;
                gameState.player.position.moveTo(playerX, playerY);
            } else if (currentExit && currentExit.name && this.gameData.townData && this.gameData.townData.exits) {
                // Find the exit in town that led to this area
                for (const exit of this.gameData.townData.exits) {
                    if (exit.name === currentExit.name) {
                        const centerX = Math.floor(GAME_WIDTH / 2);
                        const centerY = Math.floor(GAME_HEIGHT / 2);
                        const playerX = centerX + (exit.x_offset || 0);
                        const playerY = centerY + (exit.y_offset || 0);
                        gameState.player.position.moveTo(playerX, playerY);
                        break;
                    }
                }
            }
        }
        
        // Make sure player is in entities
        if (!gameState.entities.has(gameState.player.id)) {
            gameState.addEntity(gameState.player);
        }
        
        // Update FOV and render
        
        // Notify about map change to reapply auras and other effects
        eventBus.emit('mapChanged');
        this.systems[1].update();
        eventBus.emit('fovUpdated');
        
        // Display message
        gameState.addMessage("You return to the safety of town.", "important");
    }
    
    /**
     * Change to a different area
     */
    async changeArea(areaName) {
        console.log(`Changing area to: ${areaName}`);
        
        // Save exit info
        const currentExit = this.getCurrentExit();
        
        // If returning to town, use existing method
        if (areaName === 'town') {
            await this.returnToTown(currentExit);
            return;
        }
        
        try {
            // Get map name
            const mapName = currentExit?.mapFile ? 
                currentExit.mapFile.replace('.json', '') : areaName;
            
            // Load map data
            const areaData = await this.mapLoader.loadMapData(mapName);
            if (!areaData) {
                throw new Error(`Failed to load map data for ${mapName}`);
            }
            
            // Set location
            gameState.location = areaName;
            
            // Generate area - choose between dungeon and town style
            let result;
            const isDungeonStyle = areaData.roomMinSize !== undefined && areaData.roomMaxSize !== undefined;
            
            if (isDungeonStyle) {
                // Use dungeon generator
                result = this.levelGenerator.generateDungeon(areaData);
            } else {
                // Use town generator
                result = this.levelGenerator.generateTown(areaData);
            }
            
            if (!result || !result.map) {
                throw new Error(`Failed to generate ${areaName} map!`);
            }
            
            // Update game state
            const { map, startPosition } = result;
            gameState.map = map;
            gameState.entities = new Map();
            
            // Position player
            let playerX = startPosition[0], playerY = startPosition[1];
            
            // Position based on exit info
            if (currentExit?.destination_x !== undefined && currentExit?.destination_y !== undefined) {
                const centerX = Math.floor(GAME_WIDTH / 2);
                const centerY = Math.floor(GAME_HEIGHT / 2);
                playerX = centerX + currentExit.destination_x;
                playerY = centerY + currentExit.destination_y;
            }
            
            // Move player
            gameState.player.position.moveTo(playerX, playerY);
            gameState.addEntity(gameState.player);
            
            // Populate area
            if (isDungeonStyle) {
                if (areaData.monsters && areaData.monsters.length > 0) {
                    // TODO: Implement custom monster population
                }
                
                if (areaData.items && areaData.items.length > 0) {
                    // TODO: Implement custom item population
                }
            } else {
                // Use town population
                this.levelGenerator.populateTown(map, areaData);
            }
            
            // Update FOV and render
            this.systems[1].update();
            eventBus.emit('fovUpdated');
            
            // Notify about map change to reapply auras and other effects
            eventBus.emit('mapChanged');
            
            // Display message
            gameState.addMessage(`You enter ${areaName}.`, "important");
            
        } catch (error) {
            console.error(`Error changing to area ${areaName}:`, error);
            gameState.addMessage(`Unable to travel to ${areaName}. The path seems blocked.`, "error");
        }
    }
    
    /**
     * Get info about exit player is standing on
     */
    getCurrentExit() {
        if (!gameState.player || !gameState.map) return null;
        
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        const tile = gameState.map.getTile(x, y);
        
        if (tile && tile.type === TILE_TYPES.AREA_EXIT && tile.exitInfo) {
            return {
                name: gameState.location,
                x: x,
                y: y,
                ...tile.exitInfo
            };
        }
        
        return null;
    }
    
    /**
     * Check for transitions at player position
     */
    checkTransitions() {
        if (!gameState.player || !gameState.map) return;
        
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        const tile = gameState.map.getTile(x, y);
        
        if (!tile) return;
        
        // Check for items at position
        if (gameState.entities) {
            const items = Array.from(gameState.entities.values()).filter(
                entity => entity.hasComponent && entity.hasComponent('ItemComponent') &&
                          entity.hasComponent('PositionComponent') &&
                          entity.position.x === x && entity.position.y === y
            );
            
            if (items.length === 1) {
                gameState.addMessage(`You see a ${items[0].name}. Press 'g' to pick it up.`, "item");
            } else if (items.length > 1) {
                gameState.addMessage(`You see ${items.length} items here. Press 'g' to pick one up.`, "item");
            }
        }
        
        // Special tile messages
        if (tile.signMessage) {
            gameState.addMessage(`Sign: "${tile.signMessage}"`, "sign");
        }
        
        // Show prompt based on tile type
        switch (tile.type) {
            case TILE_TYPES.DUNGEON_ENTRANCE:
                gameState.addMessage("Press '>' to enter the dungeon.", "info");
                break;
                
            case TILE_TYPES.DOOR:
                gameState.addMessage("You see a door.", "info");
                break;
                
            case TILE_TYPES.AREA_EXIT:
                if (tile.exitInfo) {
                    gameState.addMessage(`Press '>' to go to ${tile.exitInfo.name}.`, "info");
                }
                break;
                
            case TILE_TYPES.STAIRS_DOWN:
                const downMsg = gameState.location === 'dungeon' && gameState.currentLevel === 1 
                    ? "Press '>' to return to town."
                    : "Press '>' to descend deeper into the dungeon.";
                gameState.addMessage(downMsg, "info");
                break;
                
            case TILE_TYPES.STAIRS_UP:
                const upMsg = gameState.location === 'dungeon' && gameState.currentLevel === 1
                    ? "Press '<' to return to town."
                    : "Press '<' to ascend to the previous level.";
                gameState.addMessage(upMsg, "info");
                break;
        }
    }
    
    /**
     * Check if dialogue should close based on distance
     */
    checkDialogueShouldClose() {
        if (gameState.gameMode === 'dialogue' && this.ui.dialogue && this.ui.dialogue.visible) {
            const currentNPC = this.ui.dialogue.currentNPC;
            if (!currentNPC || !gameState.player) return;
            
            // Calculate distance between player and NPC
            const dx = Math.abs(gameState.player.position.x - currentNPC.position.x);
            const dy = Math.abs(gameState.player.position.y - currentNPC.position.y);
            const distanceSquared = dx * dx + dy * dy;
            
            // Close dialogue if player is too far away
            if (distanceSquared > 2) {
                this.ui.dialogue.hideDialogue();
                gameState.addMessage(`You walk away from ${currentNPC.name}.`);
            }
        }
    }
    
    /**
     * Debug function to spawn spellbooks
     */
    debugSpawnSpellbooks() {
        if (!gameState.player || !this.entityFactory) return;
        
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        
        const spellbookTypes = Object.keys(this.entityFactory.spellbookTemplates || {});
        console.log("Available spellbook types:", spellbookTypes);
        
        if (spellbookTypes.length === 0) {
            console.log("No spellbook templates available");
            gameState.addMessage("Debug: No spellbooks available", "error");
            return;
        }
        
        // Create spellbooks around player
        let offset = 0;
        for (const type of spellbookTypes) {
            const spellbook = this.entityFactory.createSpellbook(type, x + offset, y + 1);
            if (spellbook) {
                gameState.addEntity(spellbook);
                gameState.addMessage(`Debug: Spawned ${type} spellbook at ${x + offset},${y + 1}`);
                offset++;
            }
        }
    }
}

// Start the game when DOM is loaded
function startGame() {
    console.log("Starting game...");
    const game = new Game();
    
    // Make game instance accessible globally
    window.game = game;
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
} else {
    // DOM already loaded, start game immediately
    startGame();
}

export default Game;
