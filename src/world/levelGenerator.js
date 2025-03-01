import { GAME_WIDTH, GAME_HEIGHT, TILE_TYPES } from '../constants.js';
import gameState from '../core/gameState.js';
import DungeonGenerator from './dungeonGenerator.js';
import TownGenerator from './townGenerator.js';
import MapLoader from './mapLoader.js';
import Entity from '../entities/entity.js';
import { 
    PositionComponent, RenderableComponent, BlocksMovementComponent,
    DialogueComponent, EquippableComponent, UsableComponent,
    ItemComponent, HealthComponent, AIComponent, StatsComponent,
    ManaComponent, ArenaManagerComponent
} from '../entities/components.js';

/**
 * LevelGenerator - Handles generating different level types (town, dungeon, etc.)
 */
class LevelGenerator {
    constructor(entityFactory) {
        this.entityFactory = entityFactory;
        this.mapLoader = new MapLoader();
    }
    
    /**
     * Generate a town level
     * @param {Object} townData - Town configuration data
     * @returns {Object} The generated town map and starting position
     */
    generateTown(townData) {
        console.log("Generating town...");
        
        // Create a town generator with town data
        const defaultTownData = {
            buildings: [],
            dungeonEntrance: { x_offset: 0, y_offset: 5 }
        };
        
        const townGenerator = new TownGenerator(
            GAME_WIDTH,
            GAME_HEIGHT,
            townData || defaultTownData
        );
        
        // Generate the town
        const result = townGenerator.generate();
        
        if (!result || !result.map) {
            console.error("Failed to generate town map!");
            return null;
        }
        
        return result;
    }
    
    /**
     * Generate a dungeon level
     * @param {Object} dungeonConfig - Dungeon configuration 
     * @returns {Object} The generated dungeon and starting position
     */
    generateDungeon(dungeonConfig) {
        console.log("Generating new dungeon level...");
        
        // Create a dungeon generator with configuration
        const defaultConfig = {
            roomMinSize: 4,
            roomMaxSize: 10,
            maxRooms: 15
        };
        
        const config = dungeonConfig || defaultConfig;
        
        const dungeonGenerator = new DungeonGenerator(
            GAME_WIDTH, 
            GAME_HEIGHT, 
            {
                roomMinSize: config.roomMinSize || 4,
                roomMaxSize: config.roomMaxSize || 10,
                maxRooms: config.maxRooms || 15
            }
        );
        
        // Generate a new dungeon
        const result = dungeonGenerator.generate();
        
        if (!result || !result.map) {
            console.error("Failed to generate dungeon map!");
            return null;
        }
        
        return result;
    }
    
    /**
     * Populate a town with NPCs, shops, and items
     * @param {Object} map - The map to populate
     * @param {Object} townData - Town configuration data
     */
    populateTown(map, townData) {
        // Add NPCs from town data
        if (townData && townData.npcs) {
            for (const npc of townData.npcs) {
                let npcEntity;
                
                // Check if this is a monster-type NPC - create using the entity factory
                if (npc.cls === "monster" && npc.monsterType) {
                    // Create the entity using the monster factory
                    npcEntity = this.entityFactory.createMonster(npc.monsterType, npc.x, npc.y);
                    
                    if (!npcEntity) {
                        console.error(`Failed to create monster of type ${npc.monsterType}, creating basic NPC instead`);
                        // Fallback to creating a basic NPC
                        npcEntity = new Entity(npc.name);
                        npcEntity.addComponent(new PositionComponent(npc.x, npc.y));
                        npcEntity.addComponent(new RenderableComponent(npc.char, npc.color, null, 50));
                        npcEntity.addComponent(new BlocksMovementComponent());
                    } else {
                        // Log monster creation details - DEBUG
                        const health = npcEntity.getComponent('HealthComponent');
                        console.log(`Created ${npc.monsterType} [${npcEntity.id}] with HP: ${health ? health.hp : 'N/A'}/${health ? health.maxHp : 'N/A'}`);
                        
                        // IMPORTANT FIX: Make town NPC monsters immortal for testing spell effects
                        // This prevents them from being killed instantly
                        if (health) {
                            console.log(`  Setting ${npc.name} to immortal to fix instakill bug`);
                            health.immortal = true;
                        }
                        
                        // Set up AI to respond to attacks but not be initially hostile
                        const ai = npcEntity.getComponent('AIComponent');
                        if (ai) {
                            // Change AI type to 'defensive' instead of the default 'hostile'
                            ai.type = 'defensive';
                            ai.state = 'idle'; // Start peaceful
                            ai.target = null;  // Don't target player immediately
                            
                            // Set behavior for wizard to be a spellcaster
                            if (npc.monsterType === 'wizard') {
                                ai.behaviorType = 'spellcaster';
                                // Make sure wizard has reasonable attack range and cooldown
                                ai.attackRange = 6;
                                ai.attackCooldown = 2;
                            }
                            
                            console.log(`  AI State: ${ai.state}, Type: ${ai.type}, Behavior: ${ai.behaviorType || 'default'}`);
                        }
                        
                        // Override the monster position to match town data
                        const position = npcEntity.getComponent('PositionComponent');
                        if (position) {
                            position.x = npc.x;
                            position.y = npc.y;
                        }
                        
                        // Override the name if needed
                        if (npc.name) {
                            npcEntity.name = npc.name;
                        }
                        
                        // Check for spells
                        const spells = npcEntity.getComponent('SpellsComponent');
                        if (spells) {
                            console.log(`  Spells available: ${spells.knownSpells ? Object.keys(spells.knownSpells).join(', ') : 'none'}`);
                        }
                    }
                } else {
                    // Create a regular NPC entity
                    npcEntity = new Entity(npc.name);
                    npcEntity.addComponent(new PositionComponent(npc.x, npc.y));
                    npcEntity.addComponent(new RenderableComponent(npc.char, npc.color, null, 50));
                    npcEntity.addComponent(new BlocksMovementComponent());
                    
                    // Check if this NPC has combat data directly in the town data, use that
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
                            // Special case for the gladiator - make him immortal and remove any AI
                            if (npc.name && npc.name.toLowerCase().includes('gladiator')) {
                                console.log(`Making ${npc.name} immortal and removing AI to prevent attacking`);
                                
                                // Make gladiator immortal
                                const health = npcEntity.getComponent('HealthComponent');
                                if (health) {
                                    health.immortal = true;
                                }
                                
                                // Don't add AI component at all
                                npcEntity.friendly = true;
                            } else {
                                const npcAI = new AIComponent('defensive');
                                npcAI.state = 'idle'; // Start peaceful
                                npcEntity.addComponent(npcAI);
                            }
                        }
                    }
                }
                
                // Add dialogue component if the NPC has dialogue data
                if (npc.dialogue && Array.isArray(npc.dialogue) && npc.dialogue.length > 0) {
                    // Check if this NPC is a shopkeeper
                    const isShopkeeper = npc.isShopkeeper || false;
                    
                    // Pass inventory directly to the DialogueComponent for shopkeepers
                    if (isShopkeeper && npc.inventory) {
                        // Force explicit item-by-item deep copy to avoid reference issues
                        const inventoryCopy = npc.inventory.map(item => ({...item}));
                        console.log(`LevelGenerator: Creating shopkeeper ${npc.name} with ${inventoryCopy.length} items in inventory.`);
                        npcEntity.addComponent(new DialogueComponent(npc.dialogue, isShopkeeper, inventoryCopy));
                    } else {
                        console.log(`LevelGenerator: Creating NPC ${npc.name}, isShopkeeper:`, isShopkeeper);
                        npcEntity.addComponent(new DialogueComponent(npc.dialogue, isShopkeeper));
                    }
                }
                
                // Check if this NPC is an arena manager
                if (npc.isArenaManager) {
                    console.log(`LevelGenerator: Adding ArenaManagerComponent to ${npc.name}`);
                    npcEntity.addComponent(new ArenaManagerComponent());
                }
                
                gameState.addEntity(npcEntity);
            }
        }
        
        // Add fixed items if present in town data
        if (townData && townData.hardcoded_items) {
            for (const item of townData.hardcoded_items) {
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
    }
    
    /**
     * Populate a dungeon with monsters and items
     * @param {Object} map - The dungeon map to populate
     * @param {Object} dungeonConfig - Dungeon configuration
     * @param {number} currentLevel - Current dungeon level
     */
    populateDungeon(map, dungeonConfig, currentLevel) {
        // Use monster/item density from config
        const config = dungeonConfig || { monsterDensity: 0.3, itemDensity: 0.2 };
        const monsterDensity = config.monsterDensity || 0.3;
        const itemDensity = config.itemDensity || 0.2;
        
        // Add monsters and items to rooms, but skip the first room (player start)
        for (let i = 1; i < map.rooms.length; i++) {
            const room = map.rooms[i];
            
            // Add random number of monsters based on dungeon level and room size
            const roomArea = room.width * room.height;
            const monsterCount = Math.floor(roomArea * monsterDensity * (1 + 0.1 * currentLevel));
            
            for (let j = 0; j < monsterCount; j++) {
                // Get a random position in the room
                const x = Math.floor(Math.random() * (room.width - 2)) + room.x1 + 1;
                const y = Math.floor(Math.random() * (room.height - 2)) + room.y1 + 1;
                
                // Create random monster based on dungeon level
                const monster = this.entityFactory.createRandomMonster(x, y, currentLevel);
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
                    const item = this.entityFactory.createRandomItem(x, y, currentLevel);
                    if (item) {
                        gameState.addEntity(item);
                    }
                }
            }
        }
    }
}

export default LevelGenerator;