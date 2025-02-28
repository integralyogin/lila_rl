import { GAME_WIDTH, GAME_HEIGHT, TILE_TYPES } from './constants.js';
import gameState from './core/gameState.js';
import eventBus from './core/eventEmitter.js';
import Entity from './entities/entity.js';
import EntityFactory from './entities/entityFactory.js';
import { 
    PositionComponent, RenderableComponent, ItemComponent,
    EquippableComponent, UsableComponent, BlocksMovementComponent, DialogueComponent,
    HealthComponent, StatsComponent, ManaComponent
} from './entities/components.js';
import DungeonGenerator from './world/dungeonGenerator.js';
import TownGenerator from './world/townGenerator.js';
import FOVSystem from './systems/fovSystem.js';
import RenderSystem from './systems/renderSystem.js';
import InputSystem from './systems/inputSystem.js';
import ActionSystem from './systems/actionSystem.js';
import { 
    CombatComponent, AIComponent 
} from './entities/components.js';
import InventoryUI from './ui/inventoryUI.js';
import SpellbookUI from './ui/spellbookUI.js';
import DialogueUI from './ui/dialogueUI.js';
import CharacterUI from './ui/characterUI.js';
import { allyLogic } from './entities/ally_logic.js';

class Game {
    constructor() {
        // Core game components
        this.entityFactory = new EntityFactory();
        this.systems = [];
        this.ui = {};
        
        // World generators
        this.dungeonGenerator = null;
        this.townGenerator = null;
        
        // Game data containers
        this.gameData = {
            dungeonConfig: null,
            playerData: null,
            monsters: null,
            items: null,
            townData: null,
            spellbooks: null
        };
        
        // Map cache to store preloaded maps
        this.mapCache = new Map();
        
        // Initialize game
        this.initialize();
    }
    
    /**
     * Initialize the game by loading data, creating systems, and setting up event handlers
     */
    async initialize() {
        console.log("Initializing game...");
        
        try {
            // Step 1: Load all game data first
            await this.loadGameData();
            
            // Step 2: Preload commonly used maps
            await this.preloadMaps();
            
            // Step 3: Create core game systems
            const renderSystem = new RenderSystem();
            const fovSystem = new FOVSystem();
            const inputSystem = new InputSystem();
            const actionSystem = new ActionSystem();
            
            this.systems = [renderSystem, fovSystem, inputSystem, actionSystem];
            
            // Register systems with the game state for easy access
            gameState.registerSystem('RenderSystem', renderSystem);
            gameState.registerSystem('FOVSystem', fovSystem);
            gameState.registerSystem('InputSystem', inputSystem);
            gameState.registerSystem('ActionSystem', actionSystem);
            
            // Step 4: Create UI components
            this.ui.inventory = new InventoryUI();
            this.ui.spellbook = new SpellbookUI();
            this.ui.dialogue = new DialogueUI();
            this.ui.character = new CharacterUI();
            
            // Import and initialize ShopUI
            import('./ui/shopUI.js').then(module => {
                const ShopUI = module.default;
                this.ui.shop = new ShopUI();
                this.ui.shop.entityFactory = this.entityFactory;
            });
            
            // Step 5: Setup event listeners
            this.setupEventListeners();
            
            // Step 6: Start a new game
            this.newGame();
            
        } catch (error) {
            console.error("Failed to initialize game:", error);
        }
    }
    
    /**
     * Load all game data from JSON files
     */
    async loadGameData() {
        console.log("Loading game data...");
        
        // Show loading message
        const messageElement = document.getElementById('message-log');
        if (messageElement) {
            messageElement.innerHTML = '<div class="message message-important">Loading game data...</div>';
        }
        
        try {
            // Define files to load with their paths
            const files = [
                { path: 'maps/dungeon.json', prop: 'dungeonConfig' },
                { path: 'player.json', prop: 'playerData' },
                { path: 'monsters.json', prop: 'monsters' },
                { path: 'items.json', prop: 'items' },
                { path: 'maps/town.json', prop: 'townData' },
                { path: 'spellbooks.json', prop: 'spellbooks' }
            ];
            
            // Load each file with parallel fetches
            const promises = files.map(file => fetch(`data/${file.path}`).then(res => 
                res.ok ? 
                    res.json().then(data => ({ prop: file.prop, data })) : 
                    Promise.reject(`Failed to load ${file.path}: ${res.status}`)
            ));
            
            // Get results and handle any errors
            const results = await Promise.allSettled(promises);
            
            // Process results
            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    this.gameData[result.value.prop] = result.value.data;
                } else {
                    console.error(`Error loading: ${result.reason}`);
                    // Missing data will be handled by the entity factory
                }
            });
            
            // Initialize entity factory with loaded data
            this.entityFactory.initialize(this.gameData);
            
            // Also update spell logic with game data for summoning spells
            import('./spells/spell_logic.js').then(module => {
                const spellLogic = module.default;
                spellLogic.updateGameData(this.gameData);
                console.log("Updated spellLogic with game data:", Object.keys(this.gameData));
                
                // Check if monsters are properly loaded
                if (this.gameData.monsters) {
                    console.log("Loaded monster templates for spell system:", 
                        this.gameData.monsters.map(m => m.id).join(", "));
                }
            }).catch(error => {
                console.error("Error loading spell_logic.js:", error);
            });
            
        } catch (error) {
            console.error("Error loading game data:", error);
            // Continue with minimal data
            this.entityFactory.initialize({});
        }
    }
    
    /**
     * Load a map from the data/maps directory
     * @param {string} mapName - Name of the map (without .json extension)
     * @returns {Promise<Object|null>} - The map data or null if loading failed
     */
    async loadMapData(mapName) {
        try {
            // Check if the map is already in cache
            if (this.mapCache.has(mapName)) {
                console.log(`Using cached map data for ${mapName}`);
                return this.mapCache.get(mapName);
            }
            
            // Make sure the mapName has no path traversal
            const safeName = mapName.replace(/[^a-z0-9_-]/gi, '');
            if (safeName !== mapName) {
                console.error(`Invalid map name: ${mapName}`);
                return null;
            }
            
            // Load the map data
            const response = await fetch(`data/maps/${safeName}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load map: ${response.status}`);
            }
            
            const mapData = await response.json();
            
            // Cache the map data
            this.mapCache.set(mapName, mapData);
            
            return mapData;
        } catch (error) {
            console.error(`Error loading map ${mapName}:`, error);
            return null;
        }
    }
    
    /**
     * Preload commonly used maps into the cache to improve performance
     * @returns {Promise<void>}
     */
    async preloadMaps() {
        console.log("Preloading maps...");
        
        // List of maps to preload
        const mapsToPreload = ['town', 'dungeon', 'forest', 'hills', 'test_map'];
        
        // Load maps in parallel
        const promises = mapsToPreload.map(mapName => this.loadMapData(mapName));
        
        try {
            await Promise.allSettled(promises);
            console.log("Maps preloaded successfully");
        } catch (error) {
            console.error("Error preloading maps:", error);
        }
    }
    
    // Setup all event listeners
    setupEventListeners() {
        // Player movement
        eventBus.on('playerMoved', () => {
            this.systems[1].update();  // Update FOV
            this.checkTransitions();   // Check for transitions
            this.checkDialogueShouldClose();  // Check dialogue
        });
        
        // Turn processing
        eventBus.on('turnProcessed', () => {
            this.systems[1].update();  // Update FOV
            this.systems[3].update();  // Update ActionSystem
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
    
    // Check for interactive elements at player's position
    checkTransitions() {
        if (!gameState.player || !gameState.map) return;
        
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        const tile = gameState.map.getTile(x, y);
        
        if (!tile) return;
        
        // Check for items
        const items = this.getItemsAtPosition(x, y);
        if (items.length === 1) {
            gameState.addMessage(`You see a ${items[0].name}. Press 'e' to pick it up.`, "item");
        } else if (items.length > 1) {
            gameState.addMessage(`You see ${items.length} items here. Press 'e' to pick one up.`, "item");
        }
        
        // Check for NPCs
        this.getNPCsNearby(x, y).forEach(npc => {
            const dx = npc.position.x - x;
            const dy = npc.position.y - y;
            
            // Get direction
            let direction = "";
            if (dy < 0) direction += "north";
            else if (dy > 0) direction += "south";
            if (dx < 0) direction += direction ? "-west" : "west";
            else if (dx > 0) direction += direction ? "-east" : "east";
            
            // Show message
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                gameState.addMessage(`${npc.name} is right next to you.`, "npc");
            } else {
                gameState.addMessage(`You see ${npc.name} to the ${direction}.`, "npc");
            }
        });
        
        // Check for special tiles
        if (tile.signMessage) {
            gameState.addMessage(`Sign: "${tile.signMessage}"`, "sign");
        }
        
        // Show appropriate prompt based on tile type
        switch (tile.type) {
            case TILE_TYPES.DUNGEON_ENTRANCE:
                gameState.addMessage("Press '>' to enter the dungeon.", "info");
                break;
                
            case TILE_TYPES.DOOR:
                gameState.addMessage("You see a door. Press Enter to open it.", "info");
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
    
    checkDialogueShouldClose() {
        // Check if we're in dialogue mode
        if (gameState.gameMode === 'dialogue' && this.ui.dialogue && this.ui.dialogue.visible) {
            const currentNPC = this.ui.dialogue.currentNPC;
            if (!currentNPC || !gameState.player) return;
            
            // Calculate distance between player and NPC
            const dx = Math.abs(gameState.player.position.x - currentNPC.position.x);
            const dy = Math.abs(gameState.player.position.y - currentNPC.position.y);
            const distanceSquared = dx * dx + dy * dy;
            
            // Close dialogue if player is too far away (more than 1.5 tiles away)
            if (distanceSquared > 2) {
                this.ui.dialogue.hideDialogue();
                gameState.addMessage(`You walk away from ${currentNPC.name}.`);
            }
        }
    }
    
    /**
     * Get all items at a specific position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Array} - Array of item entities at the position
     */
    getItemsAtPosition(x, y) {
        const items = [];
        
        // Check all entities to find items at the given position
        gameState.entities.forEach(entity => {
            if (entity.hasComponent('ItemComponent') && 
                entity.hasComponent('PositionComponent') &&
                entity.position.x === x && 
                entity.position.y === y) {
                items.push(entity);
            }
        });
        
        return items;
    }
    
    /**
     * Get all NPCs within a radius of a position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} radius - Search radius (default: 5)
     * @returns {Array} - Array of NPC entities within radius and in FOV
     */
    getNPCsNearby(x, y, radius = 5) {
        const npcs = [];
        
        // Check all entities to find NPCs within the given radius
        gameState.entities.forEach(entity => {
            if (entity.hasComponent('PositionComponent') && 
                !entity.hasComponent('ItemComponent') &&
                entity !== gameState.player) {
                
                const dx = Math.abs(entity.position.x - x);
                const dy = Math.abs(entity.position.y - y);
                
                // Check if the entity is within the visible radius and within player's FOV
                if (dx <= radius && dy <= radius && 
                    gameState.map.isInPlayerFOV(entity.position.x, entity.position.y)) {
                    npcs.push(entity);
                }
            }
        });
        
        return npcs;
    }
    
    newGame() {
        console.log("Starting new game...");
        
        // Reset game state
        gameState.currentLevel = 1;
        gameState.score = 0;
        gameState.turn = 0;
        gameState.messages = [];
        gameState.gameMode = 'exploration';
        gameState.location = 'town';
        
        // Generate town first
        this.generateTown();
        
        // Initial message
        gameState.addMessage("Welcome to town! Use arrow keys to move. Find the dungeon entrance.", "important");
    }
    
    generateTown() {
        console.log("Generating town...");
        
        // Create a town generator with town data
        const townData = this.gameData.townData || {
            buildings: [],
            dungeonEntrance: { x_offset: 0, y_offset: 5 }
        };
        
        this.townGenerator = new TownGenerator(
            GAME_WIDTH,
            GAME_HEIGHT,
            townData
        );
        
        // Generate the town
        const result = this.townGenerator.generate();
        
        if (!result || !result.map) {
            console.error("Failed to generate town map!");
            return null;
        }
        
        const { map, startPosition } = result;
        console.log("Town generated, start position:", startPosition);
        
        // Set the map in game state
        gameState.map = map;
        
        // Clear entities
        gameState.entities = new Map();
        
        // Use spawn_point from town data if available
        let playerX = startPosition[0];
        let playerY = startPosition[1];
        
        if (townData.spawn_point) {
            const centerX = Math.floor(GAME_WIDTH / 2);
            const centerY = Math.floor(GAME_HEIGHT / 2);
            playerX = centerX + (townData.spawn_point.x_offset || 0);
            playerY = centerY + (townData.spawn_point.y_offset || 0);
            console.log("Using spawn_point from town data:", playerX, playerY);
        }
        
        // Create player if needed
        if (!gameState.player) {
            console.log("Creating new player at", playerX, playerY);
            const player = this.entityFactory.createPlayer(playerX, playerY);
            gameState.player = player;
            gameState.addEntity(player);
        } else {
            console.log("Moving player to", playerX, playerY);
            // Move existing player to new start position
            gameState.player.position.moveTo(playerX, playerY);
            // Re-add player to entities
            gameState.addEntity(gameState.player);
        }
        
        // Add NPCs from town data
        this.populateTown(map);
        
        // Calculate initial FOV
        if (this.systems[1]) {
            console.log("Updating FOV");
            this.systems[1].update();
        } else {
            console.error("FOV system not initialized!");
        }
        
        // Force a render
        eventBus.emit('fovUpdated');
        
        // Return the result for further processing
        return result;
    }
    
    populateTown(map) {
        // Add NPCs and items from town.json
        if (this.gameData.townData && this.gameData.townData.npcs) {
            for (const npc of this.gameData.townData.npcs) {
                // Create a simple NPC entity
                const npcEntity = new Entity(npc.name);
                npcEntity.addComponent(new PositionComponent(npc.x, npc.y));
                npcEntity.addComponent(new RenderableComponent(npc.char, npc.color, null, 50));
                npcEntity.addComponent(new BlocksMovementComponent());
                
                // Check if this NPC has a corresponding monster entry in monsters.json
                const monsterData = this.gameData.monsters.find(m => m.id === npc.name.toLowerCase());
                
                // If this NPC has combat data directly in the town data, use that
                if (npc.combat) {
                    // Add health component with immortality if specified
                    const immortal = npc.combat.immortal || false;
                    npcEntity.addComponent(new HealthComponent(npc.combat.maxHp || npc.combat.hp || 10, immortal));
                    
                    // Add stats component
                    const strength = npc.combat.strength || 0;
                    const defense = npc.combat.defense || 0;
                    const intelligence = npc.combat.intelligence || 5;
                    npcEntity.addComponent(new StatsComponent(strength, defense, intelligence));
                    
                    // Add mana if needed
                    if (npc.combat.mana) {
                        npcEntity.addComponent(new ManaComponent(npc.combat.mana));
                    }
                    
                    // Add AI component if not immortal (immortal entities like training dummies don't need AI)
                    if (!immortal) {
                        const npcAI = new AIComponent('defensive');
                        npcAI.state = 'idle'; // Start peaceful
                        npcEntity.addComponent(npcAI);
                    }
                    
                    console.log(`Added combat stats to ${npc.name} with HP: ${npc.combat.maxHp || npc.combat.hp}, Immortal: ${immortal}`);
                }
                // Otherwise, check if this NPC has a corresponding monster entry in monsters.json
                else if (monsterData) {
                    // Add health component
                    npcEntity.addComponent(new HealthComponent(monsterData.hp));
                    
                    // Add stats component with intelligence for spell damage calculation
                    const intelligence = monsterData.intelligence || 5;
                    npcEntity.addComponent(new StatsComponent(monsterData.strength, monsterData.defense, intelligence));
                    
                    // Add mana for NPCs that might cast spells
                    npcEntity.addComponent(new ManaComponent(monsterData.mana || 50));
                    
                    // Add AI component in passive state - will only activate when attacked
                    const npcAI = new AIComponent('defensive');
                    npcAI.state = 'idle'; // Start peaceful
                    npcEntity.addComponent(npcAI);
                    
                    console.log(`Added combat stats to ${npc.name} with HP: ${monsterData.hp}, Intelligence: ${intelligence}`);
                }
                
                // Add dialogue component if the NPC has dialogue data
                if (npc.dialogue && Array.isArray(npc.dialogue) && npc.dialogue.length > 0) {
                    // Check if this NPC is a shopkeeper
                    const isShopkeeper = npc.isShopkeeper || false;
                    
                    // Pass inventory directly to the DialogueComponent for shopkeepers
                    if (isShopkeeper && npc.inventory) {
                        // Force explicit item-by-item deep copy to avoid reference issues
                        const inventoryCopy = npc.inventory.map(item => ({...item}));
                        console.log(`Game: Creating shopkeeper ${npc.name} with ${inventoryCopy.length} items in inventory. First item: ${inventoryCopy[0]?.name}`);
                        npcEntity.addComponent(new DialogueComponent(npc.dialogue, isShopkeeper, inventoryCopy));
                    } else {
                        console.log(`Game: Creating NPC ${npc.name}, isShopkeeper:`, isShopkeeper);
                        npcEntity.addComponent(new DialogueComponent(npc.dialogue, isShopkeeper));
                    }
                }
                
                gameState.addEntity(npcEntity);
            }
        }
        
        // Add fixed items if present in town data
        if (this.gameData.townData && this.gameData.townData.hardcoded_items) {
            for (const item of this.gameData.townData.hardcoded_items) {
                // Calculate position based on offsets and center of town
                const centerX = Math.floor(GAME_WIDTH / 2);
                const centerY = Math.floor(GAME_HEIGHT / 2);
                const x = centerX + (item.x_offset || 0);
                const y = centerY + (item.y_offset || 0);
                
                // Special handling for spellbooks
                if (item.type === 'spellbook') {
                    // Create a spellbook with our special method
                    const spellbook = this.entityFactory.createSpellbook(item.spellId, x, y);
                    if (spellbook) {
                        gameState.addEntity(spellbook);
                        console.log(`Added spellbook: ${item.name} at ${x},${y}`);
                    }
                    continue;
                }
                
                // Create a basic item entity
                const itemEntity = new Entity(item.name);
                itemEntity.addComponent(new PositionComponent(x, y));
                itemEntity.addComponent(new RenderableComponent(item.char, item.color, null, 20));
                itemEntity.addComponent(new ItemComponent(item.type, item.value || 0));
                
                if (item.type === 'potion') {
                    itemEntity.addComponent(new UsableComponent(item.effect, item.power));
                } else if (item.type === 'weapon') {
                    itemEntity.addComponent(new EquippableComponent('weapon', { strength: item.damage || 0 }));
                } else if (item.type === 'armor') {
                    itemEntity.addComponent(new EquippableComponent('armor', { defense: item.defense || 0 }));
                }
                
                gameState.addEntity(itemEntity);
            }
        }
        
        // Force add at least one spellbook from our loaded spellbooks
        if (this.gameData.spellbooks && this.gameData.spellbooks.length > 0) {
            const centerX = Math.floor(GAME_WIDTH / 2);
            const centerY = Math.floor(GAME_HEIGHT / 2);
            
            // Place firebolt spellbook near player
            const fireboltBook = this.entityFactory.createSpellbook('firebolt', centerX + 1, centerY - 1);
            if (fireboltBook) {
                gameState.addEntity(fireboltBook);
                console.log("Added firebolt spellbook near player");
            }
            
            // Place town portal spellbook near player
            const portalBook = this.entityFactory.createSpellbook('townportal', centerX - 1, centerY - 1);
            if (portalBook) {
                gameState.addEntity(portalBook);
                console.log("Added town portal spellbook near player");
            }
        }
    }
    
    enterDungeon() {
        console.log("Entering dungeon...");
        
        // Save the entrance's info before entering dungeon
        const entranceInfo = this.getCurrentExit();
        
        // Set location to dungeon
        gameState.location = 'dungeon';
        
        // Reset dungeon level
        gameState.currentLevel = 1;
        
        // Generate first dungeon level
        const result = this.generateLevel();
        
        // If we have entrance info with destination coordinates,
        // place the player at those coordinates in the dungeon
        if (entranceInfo && entranceInfo.destination_x !== undefined && entranceInfo.destination_y !== undefined) {
            // Calculate center of dungeon
            const centerX = Math.floor(GAME_WIDTH / 2);
            const centerY = Math.floor(GAME_HEIGHT / 2);
            
            // Set player position based on entrance's destination
            const playerX = centerX + entranceInfo.destination_x;
            const playerY = centerY + entranceInfo.destination_y;
            
            // Move player to entrance's destination position
            gameState.player.position.moveTo(playerX, playerY);
            console.log(`Positioning player at dungeon entrance:`, playerX, playerY);
        }
        
        // Force updating FOV and rendering
        this.systems[1].update(); // FOV system
        eventBus.emit('fovUpdated'); // Force render
        
        // Display message
        gameState.addMessage("You enter the dark dungeon. Be careful!", "important");
        
        // Debug output
        console.log("Player entity after entering dungeon:", gameState.player);
        console.log("Is player in entities map:", gameState.entities.has(gameState.player.id));
        console.log("Total entities:", gameState.entities.size);
    }
    
    generateLevel() {
        console.log("Generating new dungeon level...");
        
        // Create a dungeon generator with configuration from loaded data
        const config = this.gameData.dungeonConfig || {
            roomMinSize: 4,
            roomMaxSize: 10,
            maxRooms: 15
        };
        
        this.dungeonGenerator = new DungeonGenerator(
            GAME_WIDTH, 
            GAME_HEIGHT, 
            {
                roomMinSize: config.roomMinSize || 4,
                roomMaxSize: config.roomMaxSize || 10,
                maxRooms: config.maxRooms || 15
            }
        );
        
        // Generate a new dungeon
        const result = this.dungeonGenerator.generate();
        
        if (!result || !result.map) {
            console.error("Failed to generate dungeon map!");
            return null;
        }
        
        const { map, startPosition } = result;
        console.log("Dungeon generated, start position:", startPosition);
        
        // Set the map in game state
        gameState.map = map;
        
        // Clear entities
        gameState.entities = new Map();
        
        // Create player if needed
        if (!gameState.player) {
            console.log("Creating new player at", startPosition);
            const player = this.entityFactory.createPlayer(...startPosition);
            gameState.player = player;
            gameState.addEntity(player);
        } else {
            console.log("Moving player to", startPosition);
            // Move existing player to new start position
            gameState.player.position.moveTo(...startPosition);
            // Re-add player to entities since we cleared them
            gameState.addEntity(gameState.player);
        }
        
        // Add stairs at the entrance to level 1 (only for first level)
        if (gameState.currentLevel === 1) {
            const entranceX = startPosition[0];
            const entranceY = startPosition[1] + 1; // Just below player start
            map.setTile(entranceX, entranceY, TILE_TYPES.STAIRS_UP);
            map.tiles[entranceY][entranceX].exitInfo = {
                name: 'town',
                signMessage: "Return to town",
                destination_x: 0, 
                destination_y: 3  // Just below the town dungeon entrance
            };
            console.log("Added stairs up at", entranceX, entranceY);
        }
        
        // Populate the dungeon with monsters and items
        this.populateDungeon(map);
        
        // Calculate initial FOV
        if (this.systems[1]) {
            console.log("Updating FOV");
            this.systems[1].update();
        } else {
            console.error("FOV system not initialized!");
        }
        
        return result;
    }
    
    populateDungeon(map) {
        // Use monster/item density from config
        const config = this.gameData.dungeonConfig;
        const monsterDensity = config.monsterDensity || 0.3;
        const itemDensity = config.itemDensity || 0.2;
        
        // Add monsters and items to rooms, but skip the first room (player start)
        for (let i = 1; i < map.rooms.length; i++) {
            const room = map.rooms[i];
            
            // Add random number of monsters based on dungeon level and room size
            const roomArea = room.width * room.height;
            const monsterCount = Math.floor(roomArea * monsterDensity * (1 + 0.1 * gameState.currentLevel));
            
            for (let j = 0; j < monsterCount; j++) {
                // Get a random position in the room
                const x = Math.floor(Math.random() * (room.width - 2)) + room.x1 + 1;
                const y = Math.floor(Math.random() * (room.height - 2)) + room.y1 + 1;
                
                // Create random monster based on dungeon level
                const monster = this.entityFactory.createRandomMonster(x, y, gameState.currentLevel);
                if (monster) {
                    gameState.addEntity(monster);
                }
            }
            
            // Add items based on density and room size
            const itemCount = Math.floor(roomArea * itemDensity);
            
            for (let j = 0; j < itemCount; j++) {
                // Add item with probability based on config
                if (Math.random() < itemDensity) {
                    // Get a random position in the room
                    const x = Math.floor(Math.random() * (room.width - 2)) + room.x1 + 1;
                    const y = Math.floor(Math.random() * (room.height - 2)) + room.y1 + 1;
                    
                    // Create random item based on dungeon level
                    const item = this.entityFactory.createRandomItem(x, y, gameState.currentLevel);
                    if (item) {
                        gameState.addEntity(item);
                    }
                }
            }
        }
    }
    
    async nextLevel() {
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        const tile = gameState.map.getTile(x, y);
        
        // Check what kind of stairs the player is on
        if (tile) {
            // Stairs up - go back to town or previous level
            if (tile.type === TILE_TYPES.STAIRS_UP) {
                if (gameState.currentLevel === 1 && tile.exitInfo && tile.exitInfo.name === 'town') {
                    await this.returnToTown();
                    return;
                } else if (gameState.currentLevel > 1) {
                    // Go up a level (not yet implemented)
                    gameState.currentLevel--;
                    this.generateLevel();
                    gameState.addMessage(`You ascend to level ${gameState.currentLevel} of the dungeon.`, "important");
                    return;
                }
            }
            // Stairs down - go deeper
            else if (tile.type === TILE_TYPES.STAIRS_DOWN) {
                // Increment level
                gameState.currentLevel++;
                
                // Generate new level
                this.generateLevel();
                
                // Display message
                gameState.addMessage(`You descend to level ${gameState.currentLevel} of the dungeon.`, "important");
                return;
            }
        }
        
        // If we get here, something's wrong with the stairs
        gameState.addMessage("There are no stairs here to use.", "error");
    }
    
    async returnToTown(currentExit = null) {
        console.log("Returning to town...");
        
        // Set location to town
        gameState.location = 'town';
        
        // Make sure town data is loaded
        if (!this.gameData.townData) {
            const townData = await this.loadMapData('town');
            if (townData) {
                this.gameData.townData = townData;
            }
        }
        
        // Generate town and get start position
        const result = this.generateTown();
        
        if (result && result.map) {
            // Position player based on town spawn point (which is already applied in generateTown)
            let playerX = gameState.player.position.x;
            let playerY = gameState.player.position.y;
            
            // If we have a source exit with destination coordinates
            if (currentExit) {
                if (currentExit.destination_x !== undefined && currentExit.destination_y !== undefined) {
                    // Calculate center of town
                    const centerX = Math.floor(GAME_WIDTH / 2);
                    const centerY = Math.floor(GAME_HEIGHT / 2);
                    
                    // Use the explicit destination coordinates from the exit
                    playerX = centerX + currentExit.destination_x;
                    playerY = centerY + currentExit.destination_y;
                    console.log(`Using explicit destination coordinates from exit:`, playerX, playerY);
                    
                    // Move player to exit's destination position
                    gameState.player.position.moveTo(playerX, playerY);
                }
                // Fall back to old approach if no destination coordinates
                else if (currentExit.name) {
                    // Find the exit in town that led to this area
                    for (const exit of this.gameData.townData.exits || []) {
                        if (exit.name === currentExit.name) {
                            // Calculate center of town
                            const centerX = Math.floor(GAME_WIDTH / 2);
                            const centerY = Math.floor(GAME_HEIGHT / 2);
                            
                            // Place player at this exit's location
                            playerX = centerX + (exit.x_offset || 0);
                            playerY = centerY + (exit.y_offset || 0);
                            
                            console.log(`Placing player at town entrance from ${currentExit.name}:`, playerX, playerY);
                            
                            // Move player to entrance position
                            gameState.player.position.moveTo(playerX, playerY);
                            break;
                        }
                    }
                }
            }
            
            // Make sure player is in entities collection
            if (!gameState.entities.has(gameState.player.id)) {
                gameState.addEntity(gameState.player);
            }
        }
        
        // Force updating FOV and rendering
        this.systems[1].update(); // FOV system
        eventBus.emit('fovUpdated'); // Force render
        
        // Display message
        gameState.addMessage("You return to the safety of town.", "important");
        
        // Debug output
        console.log("Player entity after returning to town:", gameState.player);
        console.log("Is player in entities map:", gameState.entities.has(gameState.player.id));
        console.log("Total entities:", gameState.entities.size);
    }
    
    /**
     * Change to a different area
     */
    async changeArea(areaName) {
        console.log(`Changing area to: ${areaName}`);
        
        // Save the exit's info before changing areas
        const currentExit = this.getCurrentExit();
        
        // If returning to town, use existing method
        if (areaName === 'town') {
            this.returnToTown(currentExit);
            return;
        }
        
        try {
            // Get the map name, either from the exit info or default to areaName
            const mapName = currentExit?.mapFile ? 
                currentExit.mapFile.replace('.json', '') : areaName;
            
            // Load area data using our standardized method
            const areaData = await this.loadMapData(mapName);
            if (!areaData) {
                throw new Error(`Failed to load map data for ${mapName}`);
            }
            
            // Set location and generate map
            gameState.location = areaName;
            
            // Check if this is a dungeon-style map (has roomMinSize, roomMaxSize, etc.)
            let isDungeonStyle = areaData.roomMinSize !== undefined && areaData.roomMaxSize !== undefined;
            
            let result;
            if (isDungeonStyle) {
                // Use DungeonGenerator for dungeon-style maps like orc_camp
                console.log(`Using DungeonGenerator for ${areaName} with config:`, areaData);
                const dungeonGenerator = new DungeonGenerator(GAME_WIDTH, GAME_HEIGHT, {
                    roomMinSize: areaData.roomMinSize || 4,
                    roomMaxSize: areaData.roomMaxSize || 10,
                    maxRooms: areaData.maxRooms || 15
                });
                result = dungeonGenerator.generate();
            } else {
                // Use TownGenerator for town-style maps
                console.log(`Using TownGenerator for ${areaName}`);
                const areaGenerator = new TownGenerator(GAME_WIDTH, GAME_HEIGHT, areaData);
                result = areaGenerator.generate();
            }
            
            if (!result || !result.map) {
                throw new Error(`Failed to generate ${areaName} map!`);
            }
            
            // Update game state with new map
            const { map, startPosition } = result;
            gameState.map = map;
            gameState.entities = new Map();
            
            // Position player
            let playerX = startPosition[0], playerY = startPosition[1];
            
            // Use destination coordinates if available
            if (currentExit?.destination_x !== undefined && currentExit?.destination_y !== undefined) {
                const centerX = Math.floor(GAME_WIDTH / 2);
                const centerY = Math.floor(GAME_HEIGHT / 2);
                playerX = centerX + currentExit.destination_x;
                playerY = centerY + currentExit.destination_y;
            } else if (currentExit?.name) {
                const entrancePoint = this.findEntranceForArea(map, currentExit.name, areaData);
                if (entrancePoint) {
                    playerX = entrancePoint.x;
                    playerY = entrancePoint.y;
                }
            }
            
            // Place player and add entities
            gameState.player.position.moveTo(playerX, playerY);
            gameState.addEntity(gameState.player);
            
            // Use the isDungeonStyle variable from earlier
            if (isDungeonStyle) {
                console.log(`Populating dungeon-style map ${areaName} with monsters and items`);
                if (areaData.monsters && areaData.monsters.length > 0) {
                    this.populateWithCustomMonsters(map, areaData.monsters);
                }
                
                if (areaData.items && areaData.items.length > 0) {
                    this.populateWithCustomItems(map, areaData.items);
                }
                
                // Handle dungeon-style exits
                if (areaData.exitToHills) {
                    const centerX = Math.floor(GAME_WIDTH / 2);
                    const centerY = Math.floor(GAME_HEIGHT / 2);
                    const exitX = centerX + (areaData.exitToHills.x_offset || 0);
                    const exitY = centerY + (areaData.exitToHills.y_offset || 0);
                    
                    if (map.isInBounds(exitX, exitY)) {
                        map.setTile(exitX, exitY, TILE_TYPES.AREA_EXIT);
                        map.tiles[exitY][exitX].exitInfo = {
                            name: 'hills',
                            signMessage: areaData.exitToHills.signMessage,
                            destination_x: areaData.exitToHills.destination_x,
                            destination_y: areaData.exitToHills.destination_y
                        };
                        console.log(`Added exit at ${exitX},${exitY} that leads back to hills`);
                    }
                }
            } else {
                // For town-style maps, use the regular population method
                this.populateArea(map, areaData);
            }
            
            // Update display
            this.systems[1].update();
            eventBus.emit('fovUpdated');
            gameState.addMessage(`You enter ${areaName}.`, "important");
            
            // Handle special rooms if they exist
            if (areaData.specialRooms && areaData.specialRooms.length > 0) {
                this.setupSpecialRooms(map, areaData.specialRooms);
            }
            
            console.log(`Area ${areaName} loaded and populated with modular entity references`);
            
        } catch (error) {
            console.error(`Error changing to area ${areaName}:`, error);
            gameState.addMessage(`Unable to travel to ${areaName}. The path seems blocked.`, "error");
        }
    }
    
    getCurrentExit() {
        // Get info about the exit the player is standing on
        if (!gameState.player || !gameState.map) return null;
        
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        const tile = gameState.map.getTile(x, y);
        
        if (tile && tile.type === TILE_TYPES.AREA_EXIT && tile.exitInfo) {
            // Return a copy to avoid issues with map references 
            return {
                name: gameState.location,  // Note the source area we're coming from
                x: x,
                y: y,
                ...tile.exitInfo
            };
        }
        
        return null;
    }
    
    findEntranceForArea(map, sourceAreaName, areaData) {
        // Find the "townExit" that would take you back to the source area
        if (sourceAreaName === 'town' && areaData.townExit) {
            // Calculate center of map
            const centerX = Math.floor(GAME_WIDTH / 2);
            const centerY = Math.floor(GAME_HEIGHT / 2);
            
            // Return position based on exit offsets
            return {
                x: centerX + (areaData.townExit.x_offset || 0),
                y: centerY + (areaData.townExit.y_offset || 0)
            };
        }
        
        // Check for other named exits that lead back to the source area
        if (areaData.exits) {
            for (const exit of areaData.exits) {
                if (exit.name === sourceAreaName) {
                    // Calculate center of map
                    const centerX = Math.floor(GAME_WIDTH / 2);
                    const centerY = Math.floor(GAME_HEIGHT / 2);
                    
                    // Return position based on exit offsets
                    return {
                        x: centerX + (exit.x_offset || 0),
                        y: centerY + (exit.y_offset || 0)
                    };
                }
            }
        }
        
        // No specific entrance found
        return null;
    }
    
    populateArea(map, areaData) {
        // Similar to populateTown but for any area
        
        // Add NPCs
        if (areaData.npcs) {
            for (const npc of areaData.npcs) {
                const npcEntity = new Entity(npc.name);
                npcEntity.addComponent(new PositionComponent(npc.x, npc.y));
                npcEntity.addComponent(new RenderableComponent(npc.char, npc.color, null, 50));
                npcEntity.addComponent(new BlocksMovementComponent());
                
                // Add dialogue component if the NPC has dialogue data
                if (npc.dialogue && Array.isArray(npc.dialogue) && npc.dialogue.length > 0) {
                    const isShopkeeper = npc.isShopkeeper || false;
                    
                    // Pass inventory directly to the DialogueComponent for shopkeepers
                    if (isShopkeeper && npc.inventory) {
                        // Force explicit item-by-item deep copy to avoid reference issues
                        const inventoryCopy = npc.inventory.map(item => ({...item}));
                        console.log(`Game: Creating shopkeeper ${npc.name} with ${inventoryCopy.length} items in inventory. First item: ${inventoryCopy[0]?.name}`);
                        npcEntity.addComponent(new DialogueComponent(npc.dialogue, isShopkeeper, inventoryCopy));
                    } else {
                        console.log(`Game: Creating NPC ${npc.name}, isShopkeeper:`, isShopkeeper);
                        npcEntity.addComponent(new DialogueComponent(npc.dialogue, isShopkeeper));
                    }
                }
                
                gameState.addEntity(npcEntity);
            }
        }
        
        // Add fixed items
        if (areaData.hardcoded_items) {
            for (const item of areaData.hardcoded_items) {
                // Calculate position based on offsets and center of area
                const centerX = Math.floor(GAME_WIDTH / 2);
                const centerY = Math.floor(GAME_HEIGHT / 2);
                const x = centerX + (item.x_offset || 0);
                const y = centerY + (item.y_offset || 0);
                
                // Special handling for spellbooks
                if (item.type === 'spellbook') {
                    const spellbook = this.entityFactory.createSpellbook(item.spellId, x, y);
                    if (spellbook) {
                        gameState.addEntity(spellbook);
                        console.log(`Added spellbook: ${item.name} at ${x},${y}`);
                    }
                    continue;
                }
                
                // Create a basic item entity
                const itemEntity = new Entity(item.name);
                itemEntity.addComponent(new PositionComponent(x, y));
                itemEntity.addComponent(new RenderableComponent(item.char, item.color, null, 20));
                itemEntity.addComponent(new ItemComponent(item.type, item.value || 0));
                
                if (item.type === 'potion') {
                    itemEntity.addComponent(new UsableComponent(item.effect, item.power));
                } else if (item.type === 'weapon') {
                    itemEntity.addComponent(new EquippableComponent('weapon', { strength: item.damage || 0 }));
                } else if (item.type === 'armor') {
                    itemEntity.addComponent(new EquippableComponent('armor', { defense: item.defense || 0 }));
                }
                
                gameState.addEntity(itemEntity);
            }
        }
    }
    
    /**
     * Populate a map with custom monsters based on the weights in monsterData
     */
    populateWithCustomMonsters(map, monsterData) {
        // Skip if no rooms or invalid data
        if (!map.rooms || map.rooms.length === 0 || !monsterData || monsterData.length === 0) {
            return;
        }
        
        // Skip the first room (player start)
        for (let i = 1; i < map.rooms.length; i++) {
            const room = map.rooms[i];
            
            // Calculate how many monsters to add
            const roomArea = room.width * room.height;
            const monsterDensity = 0.3; // Default value from dungeon config
            const monsterCount = Math.floor(roomArea * monsterDensity);
            
            for (let j = 0; j < monsterCount; j++) {
                // Get a random position in the room
                const x = Math.floor(Math.random() * (room.width - 2)) + room.x1 + 1;
                const y = Math.floor(Math.random() * (room.height - 2)) + room.y1 + 1;
                
                // Create a monster based on weighted list - using only IDs now
                const monsterType = this.selectEntityTypeFromWeightedList(monsterData);
                if (monsterType) {
                    const monster = this.entityFactory.createMonster(monsterType, x, y);
                    if (monster) {
                        gameState.addEntity(monster);
                    }
                }
            }
        }
    }
    
    /**
     * Populate a map with custom items based on the weights in itemData
     */
    populateWithCustomItems(map, itemData) {
        // Skip if no rooms or invalid data
        if (!map.rooms || map.rooms.length === 0 || !itemData || itemData.length === 0) {
            return;
        }
        
        // Skip the first room (player start)
        for (let i = 1; i < map.rooms.length; i++) {
            const room = map.rooms[i];
            
            // Calculate how many items to add
            const roomArea = room.width * room.height;
            const itemDensity = 0.2; // Default value from dungeon config
            const itemCount = Math.floor(roomArea * itemDensity);
            
            for (let j = 0; j < itemCount; j++) {
                // Get a random position in the room
                const x = Math.floor(Math.random() * (room.width - 2)) + room.x1 + 1;
                const y = Math.floor(Math.random() * (room.height - 2)) + room.y1 + 1;
                
                // Select an item type based on weights
                const itemType = this.selectEntityTypeFromWeightedList(itemData);
                if (itemType) {
                    // If it's an inline item with name property, use the old method
                    const itemDef = itemData.find(item => item.id === itemType);
                    if (itemDef && itemDef.name) {
                        const item = this.createCustomItem(itemDef, x, y);
                        if (item) {
                            gameState.addEntity(item);
                        }
                    } else {
                        // Use the createItem method from entityFactory for standard items
                        const item = this.entityFactory.createItem(itemType, x, y);
                        if (item) {
                            gameState.addEntity(item);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Select an entity type from a weighted list
     * Returns the ID of the selected entity
     */
    selectEntityTypeFromWeightedList(entityList) {
        // Calculate total weight
        let totalWeight = 0;
        for (const entity of entityList) {
            totalWeight += entity.weight || 1; // Default weight of 1 if not specified
        }
        
        // Get a random value based on total weight
        let randomValue = Math.random() * totalWeight;
        
        // Find the entity that corresponds to the random value
        for (const entity of entityList) {
            const weight = entity.weight || 1;
            randomValue -= weight;
            
            if (randomValue <= 0) {
                return entity.id;
            }
        }
        
        return null;
    }
    
    /**
     * Create entities from a weighted list (legacy method)
     * @deprecated Use selectEntityTypeFromWeightedList instead
     */
    createEntityFromWeightedList(entityList, x, y, type) {
        // Calculate total weight
        let totalWeight = 0;
        for (const entity of entityList) {
            totalWeight += entity.weight || 1; // Default weight of 1 if not specified
        }
        
        // Get a random value based on total weight
        let randomValue = Math.random() * totalWeight;
        
        // Find the entity that corresponds to the random value
        for (const entity of entityList) {
            const weight = entity.weight || 1;
            randomValue -= weight;
            
            if (randomValue <= 0) {
                // If the entity only has an ID, use the entity factory
                if (entity.id && !entity.name) {
                    if (type === 'monster') {
                        return this.entityFactory.createMonster(entity.id, x, y);
                    } else if (type === 'item') {
                        return this.entityFactory.createItem(entity.id, x, y);
                    }
                }
                // Otherwise, create a new entity with the provided data
                else {
                    if (type === 'monster') {
                        return this.createCustomMonster(entity, x, y);
                    } else if (type === 'item') {
                        return this.createCustomItem(entity, x, y);
                    }
                }
                break;
            }
        }
        
        return null;
    }
    
    /**
     * Create a custom monster entity
     */
    createCustomMonster(monsterData, x, y) {
        const entity = new Entity(monsterData.name);
        entity.addComponent(new PositionComponent(x, y));
        entity.addComponent(new RenderableComponent(monsterData.char, monsterData.color, null, 40));
        entity.addComponent(new CombatComponent(monsterData.hp, monsterData.strength, monsterData.defense, monsterData.xp || 0));
        entity.addComponent(new BlocksMovementComponent());
        
        // Add AI component with target set to player to make monsters aggressive immediately
        const ai = new AIComponent('hostile');
        entity.addComponent(ai);
        
        // Set player as target to make monster immediately aggressive
        if (gameState.player) {
            ai.target = gameState.player;
            ai.state = 'chase';
        }
        
        return entity;
    }
    
    /**
     * Create a custom item entity
     */
    createCustomItem(itemData, x, y) {
        const entity = new Entity(itemData.name);
        entity.addComponent(new PositionComponent(x, y));
        entity.addComponent(new RenderableComponent(itemData.char, itemData.color, null, 20));
        entity.addComponent(new ItemComponent(itemData.type, itemData.value || 0));
        
        if (itemData.type === 'potion') {
            entity.addComponent(new UsableComponent(itemData.effect, itemData.power));
        } else if (itemData.type === 'weapon') {
            entity.addComponent(new EquippableComponent('weapon', itemData.statModifiers || { strength: 1 }));
        } else if (itemData.type === 'armor') {
            entity.addComponent(new EquippableComponent('armor', itemData.statModifiers || { defense: 1 }));
        } else if (itemData.type === 'charm') {
            entity.addComponent(new EquippableComponent('accessory', itemData.statModifiers || {}));
        }
        
        return entity;
    }
    
    /**
     * Setup special rooms with guaranteed monsters/NPCs/items
     */
    setupSpecialRooms(map, specialRoomsData) {
        // Skip if no rooms
        if (!map.rooms || map.rooms.length === 0) return;
        
        for (const specialRoom of specialRoomsData) {
            // Find a suitable room
            let selectedRoom = null;
            
            for (const room of map.rooms) {
                // Skip first room (player start)
                if (room === map.rooms[0]) continue;
                
                // Check room size constraints
                if (specialRoom.minSize && (room.width < specialRoom.minSize || room.height < specialRoom.minSize)) {
                    continue;
                }
                
                if (specialRoom.maxSize && (room.width > specialRoom.maxSize || room.height > specialRoom.maxSize)) {
                    continue;
                }
                
                // Use this room
                selectedRoom = room;
                break;
            }
            
            // If no suitable room found, continue to next special room
            if (!selectedRoom) continue;
            
            // Add guaranteed monsters
            if (specialRoom.guaranteedMonsters) {
                for (const monsterData of specialRoom.guaranteedMonsters) {
                    // Find a valid position in the room center
                    const centerX = Math.floor((selectedRoom.x1 + selectedRoom.x2) / 2);
                    const centerY = Math.floor((selectedRoom.y1 + selectedRoom.y2) / 2);
                    
                    // If only an ID is provided, use the entity factory
                    if (monsterData.id && !monsterData.name) {
                        const monster = this.entityFactory.createMonster(monsterData.id, centerX, centerY);
                        if (monster) {
                            gameState.addEntity(monster);
                            console.log(`Added special monster ${monsterData.id} to ${specialRoom.type} room`);
                        }
                    } else {
                        // Otherwise use legacy method for inline monster data
                        const monster = this.createCustomMonster(monsterData, centerX, centerY);
                        if (monster) {
                            gameState.addEntity(monster);
                            console.log(`Added special monster ${monsterData.name} to ${specialRoom.type} room`);
                        }
                    }
                }
            }
            
            // Add guaranteed NPCs
            if (specialRoom.guaranteedNpcs) {
                for (const npcData of specialRoom.guaranteedNpcs) {
                    // Find a valid position in the room
                    const x = Math.floor(Math.random() * (selectedRoom.width - 2)) + selectedRoom.x1 + 1;
                    const y = Math.floor(Math.random() * (selectedRoom.height - 2)) + selectedRoom.y1 + 1;
                    
                    // Create NPC entity
                    const npcEntity = new Entity(npcData.name);
                    npcEntity.addComponent(new PositionComponent(x, y));
                    npcEntity.addComponent(new RenderableComponent(npcData.char, npcData.color, null, 50));
                    
                    // NPCs shouldn't block movement if they're prisoners
                    if (specialRoom.type !== 'prison') {
                        npcEntity.addComponent(new BlocksMovementComponent());
                    }
                    
                    // Add dialogue component
                    if (npcData.dialogue && Array.isArray(npcData.dialogue) && npcData.dialogue.length > 0) {
                        npcEntity.addComponent(new DialogueComponent(npcData.dialogue, false));
                    }
                    
                    gameState.addEntity(npcEntity);
                    console.log(`Added special NPC ${npcData.name} to ${specialRoom.type} room`);
                }
            }
            
            // Add guaranteed items
            if (specialRoom.guaranteedItems) {
                for (const itemData of specialRoom.guaranteedItems) {
                    // Find a valid position in the room
                    const x = Math.floor(Math.random() * (selectedRoom.width - 2)) + selectedRoom.x1 + 1;
                    const y = Math.floor(Math.random() * (selectedRoom.height - 2)) + selectedRoom.y1 + 1;
                    
                    // If only an ID is provided, use the entity factory
                    if (itemData.id && !itemData.name) {
                        const item = this.entityFactory.createItem(itemData.id, x, y);
                        if (item) {
                            gameState.addEntity(item);
                            console.log(`Added special item ${itemData.id} to ${specialRoom.type} room`);
                        }
                    } else {
                        // Otherwise use legacy method for inline item data
                        const item = this.createCustomItem(itemData, x, y);
                        if (item) {
                            gameState.addEntity(item);
                            console.log(`Added special item ${itemData.name} to ${specialRoom.type} room`);
                        }
                    }
                }
            }
        }
    }
    
    debugSpawnSpellbooks() {
        // Spawn spellbooks at player location for testing
        if (!gameState.player) return;
        
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        
        // Spawn all available spellbooks
        const spellbookTypes = Object.keys(this.entityFactory.spellbookTemplates);
        console.log("Available spellbook types:", spellbookTypes);
        
        if (spellbookTypes.length === 0) {
            console.log("No spellbook templates available");
            gameState.addMessage("Debug: No spellbooks available");
            return;
        }
        
        // Create each spellbook type around the player
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

// Start the game when the page loads
function startGame() {
    console.log("Starting game...");
    const game = new Game();
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
} else {
    // DOM already loaded, start game immediately
    startGame();
}

export default Game;