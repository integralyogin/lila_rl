import { KEYS, TILE_TYPES } from '../constants.js';
import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import combatSystem from './combatSystem.js';
import aiSystem from './aiSystem.js';
import { getEntityArray } from '../utils/entityUtils.js';
import pathfindingSystem from './pathfindingSystem.js';

/**
 * InputSystem - Handles keyboard input and player actions
 * Focuses only on keyboard input handling and player actions,
 * leaving mouse input to MouseSystem
 */
class InputSystem {
    constructor() {
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        
        // Set up event listeners
        window.addEventListener('keydown', this.boundHandleKeyDown);
        
        // Add startup sanity check for debugging
        setTimeout(() => this.runSanityCheck(), 2000);
    }
    
    /**
     * Run a quick sanity check to validate the game state
     */
    runSanityCheck() {
        console.log("Running game state sanity check...");
        
        // Check if gameState has been initialized properly
        if (!gameState) {
            console.error("SANITY CHECK FAILED: gameState is not defined");
            return;
        }
        
        // Check if game map exists
        if (!gameState.map) {
            console.warn("SANITY CHECK WARNING: gameState.map is not defined");
        }
        
        // Check if player exists
        if (!gameState.player) {
            console.warn("SANITY CHECK WARNING: gameState.player is not defined");
        }
        
        // Check if entities is properly initialized
        if (!gameState.entities) {
            console.error("SANITY CHECK FAILED: gameState.entities is not defined");
            // Initialize an empty Map to prevent errors
            gameState.entities = new Map();
        } else if (!(gameState.entities instanceof Map)) {
            console.error("SANITY CHECK FAILED: gameState.entities is not a Map");
            // Convert to a Map if it's an array, otherwise create new Map
            if (Array.isArray(gameState.entities)) {
                const newMap = new Map();
                gameState.entities.forEach((entity, index) => {
                    if (entity && entity.id) {
                        newMap.set(entity.id, entity);
                    } else {
                        newMap.set(`entity-${index}`, entity);
                    }
                });
                gameState.entities = newMap;
            } else {
                gameState.entities = new Map();
            }
        }
        
        console.log(`SANITY CHECK: gameState.entities contains ${gameState.entities.size} entities`);
        
        // Add helper methods for array-like operations on the Map
        if (!gameState._entitiesArray) {
            // Add a getter that converts the Map to an array when needed
            Object.defineProperty(gameState, '_entitiesArray', {
                get: function() {
                    return Array.from(this.entities.values());
                }
            });
        }
        
        // Check game mode
        console.log(`SANITY CHECK: Current game mode is "${gameState.gameMode}"`);
        if (gameState.gameMode !== 'exploration') {
            console.warn("Game is not in exploration mode - this may cause issues on startup");
        }
        
        console.log("Sanity check complete.");
    }
    
    shutdown() {
        // Clean up event listeners when system is destroyed
        window.removeEventListener('keydown', this.boundHandleKeyDown);
    }
    
    handleKeyDown(event) {
        // Ignore if there's no player entity
        if (!gameState.player) return;
        
        const key = event.key;
        console.log(`Key pressed: ${key}, game mode: ${gameState.gameMode}`);
        
        // Emergency key to reset game mode (use backtick)
        if (key === '`') {
            console.log("EMERGENCY MODE RESET - Returning to exploration mode");
            gameState.gameMode = 'exploration';
            eventBus.emit('emergencyReset');
            event.preventDefault();
            return;
        }
        
        // Handle special key combinations for path following
        if (key === 'Escape' && pathfindingSystem.isFollowingPath()) {
            pathfindingSystem.cancelPathFollowing();
            event.preventDefault();
            return;
        }
        
        // Toggle pathfinding with Alt+P
        if (key === 'p' && event.altKey) {
            pathfindingSystem.togglePathfinding();
            event.preventDefault();
            return;
        }
        
        // Process key based on current game mode
        switch (gameState.gameMode) {
            case 'exploration':
                this.handleExplorationInput(key, event);
                break;
            case 'inventory':
                console.log("Sending key to inventory:", key);
                // If escape, explicitly close the inventory
                if (key === 'Escape') {
                    console.log("Closing inventory");
                    gameState.gameMode = 'exploration';
                    eventBus.emit('inventoryClosed');
                    event.preventDefault();
                } else {
                    eventBus.emit('inventoryKeyPressed', key);
                }
                break;
            case 'targeting':
                // Forward keys to targeting system
                event.preventDefault();
                eventBus.emit('targetingKeyPressed', key);
                break;
            case 'spellbook':
                console.log("Sending key to spellbook:", key);
                // If escape, explicitly close the spellbook
                if (key === 'Escape') {
                    console.log("Closing spellbook");
                    gameState.gameMode = 'exploration';
                    eventBus.emit('spellbookClosed');
                    event.preventDefault();
                } else {
                    eventBus.emit('spellbookKeyPressed', key);
                }
                break;
            case 'character':
                console.log("Sending key to character screen:", key);
                // If escape, explicitly close the character screen
                if (key === 'Escape') {
                    console.log("Closing character screen");
                    gameState.gameMode = 'exploration';
                    eventBus.emit('characterClosed');
                    event.preventDefault();
                } else {
                    eventBus.emit('characterKeyPressed', key);
                }
                break;
            case 'dialogue':
                console.log("Dialogue mode key press:", key);
                // If escape, explicitly close the dialogue
                if (key === 'Escape') {
                    console.log("Closing dialogue");
                    gameState.gameMode = 'exploration';
                    eventBus.emit('dialogueClosed');
                    event.preventDefault();
                } else {
                    // Forward key to dialogue UI
                    eventBus.emit('dialogueKeyPressed', key);
                }
                break;
            case 'shop':
                console.log("Shop mode key press:", key);
                // Prevent any default browser behavior for ALL shop mode keys
                event.preventDefault();
                event.stopPropagation();
                
                // If escape, explicitly close the shop
                if (key === 'Escape') {
                    console.log("Closing shop");
                    gameState.gameMode = 'exploration';
                    eventBus.emit('shopClosed');
                } else {
                    // Forward key presses to the shop UI
                    console.log(`Forwarding shop key: ${key}`);
                    eventBus.emit('shopKeyPressed', key);
                }
                break;
            case 'arena':
                console.log("Arena mode key press:", key);
                // Prevent any default browser behavior for arena mode keys
                event.preventDefault();
                
                // If escape, stop the arena match
                if (key === 'Escape') {
                    console.log("Stopping arena match");
                    eventBus.emit('stopArenaMatch');
                }
                break;
            case 'arena_selection':
                console.log("Arena selection mode key press:", key);
                // Prevent default browser behavior
                event.preventDefault();
                
                // If escape, close the arena UI
                if (key === 'Escape') {
                    console.log("Closing arena selection");
                    gameState.gameMode = 'exploration';
                    eventBus.emit('arenaClose');
                }
                break;
            default:
                console.warn(`Unknown game mode: ${gameState.gameMode}`);
        }
    }
    
    // Handle player input in exploration mode
    handleExplorationInput(key, event) {
        let handled = false;
        console.log(`Processing exploration input: ${key}`);
        
        // Check if player is following a path and handle interruption with movement keys
        if (pathfindingSystem.isFollowingPath()) {
            // Handle path interruption with any movement key
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 
                 'Home', 'End', 'PageUp', 'PageDown'].includes(key)) {
                
                console.log("Manual movement detected, interrupting path");
                pathfindingSystem.cancelPathFollowing("Path following interrupted by manual movement");
                // Let the normal movement handling below take over
            }
        }
        
        // Normal movement handling
        switch (key) {
            // Cardinal directions
            case KEYS.UP:
            case 'ArrowUp':
            case 'w':
            case 'k':
                console.log("Moving up");
                handled = this.tryMove(0, -1);
                break;
            case KEYS.RIGHT:
            case 'ArrowRight':
            case 'd':
            case 'l':
                handled = this.tryMove(1, 0);
                break;
            case KEYS.DOWN:
            case 'ArrowDown':
            case 's':
            case 'j':
                handled = this.tryMove(0, 1);
                break;
            case KEYS.LEFT:
            case 'ArrowLeft':
            case 'a':
            case 'h':
                handled = this.tryMove(-1, 0);
                break;
                
            // Diagonal movement
            case 'Home':
                handled = this.tryMove(-1, -1);
                break;
            case 'PageUp':
                handled = this.tryMove(1, -1);
                break;
            case 'End':
                handled = this.tryMove(-1, 1);
                break;
            case 'PageDown':
                handled = this.tryMove(1, 1);
                break;
                
            // Wait a turn
            case '.':
            case ' ':
            case '5':
                this.processTurn();
                handled = true;
                break;
                
            // Use stairs - check for both '>' and '<' keys
            case '>':
            case '<':
                console.log("Attempting to use stairs with key:", key);
                handled = this.tryUseStairs();
                break;
                
            // Pick up item
            case 'g':
            case ',':
                handled = this.tryPickupItem();
                break;
                
            // Open inventory
            case 'i':
                console.log("Opening inventory");
                gameState.gameMode = 'inventory';
                eventBus.emit('openInventory');
                eventBus.emit('inventoryOpened');
                handled = true;
                break;
                
            // Open spellbook
            case 'b':
                console.log("Opening spellbook");
                gameState.gameMode = 'spellbook';
                eventBus.emit('openSpellbook');
                eventBus.emit('spellbookOpened');
                handled = true;
                break;
                
            // Open character screen
            case 'c':
                console.log("Opening character screen");
                gameState.gameMode = 'character';
                eventBus.emit('openCharacterScreen');
                eventBus.emit('characterOpened');
                handled = true;
                break;
                
            // Talk to NPC
            case 't':
                handled = this.tryInteract();
                break;
                
            // Resume/interrupt path with a dedicated key
            case 'f':
                if (pathfindingSystem.isFollowingPath()) {
                    // Pause path following
                    pathfindingSystem.pausePathFollowing();
                } else if (pathfindingSystem.hasPath()) {
                    // Resume following if we have a path but it's paused
                    pathfindingSystem.resumePathFollowing();
                } else {
                    eventBus.emit('logMessage', { 
                        message: "No path to follow", 
                        type: 'info' 
                    });
                }
                handled = true;
                break;
        }
        
        // If key was handled, update game state
        if (handled) {
            console.log(`Key ${key} was handled`);
            // Prevent default browser behavior like scrolling
            event.preventDefault();
        }
    }
    
    tryMove(dx, dy) {
        console.log(`Attempting to move by dx=${dx}, dy=${dy}`);
        
        // Basic movement validation
        if (!gameState.player || !gameState.map) {
            console.error("Missing player or map!");
            return false;
        }
        
        const newX = gameState.player.position.x + dx;
        const newY = gameState.player.position.y + dy;
        console.log(`Target position: ${newX},${newY}`);
        
        // Check map boundaries
        if (newX < 0 || newY < 0 || newX >= gameState.map.width || newY >= gameState.map.height) {
            // If out of bounds, stop path following
            if (pathfindingSystem.isFollowingPath()) {
                pathfindingSystem.cancelPathFollowing("Path leads out of bounds");
            }
            return false;
        }
        
        // Check for entities at target position
        const entityArray = getEntityArray();
        
        console.log(`Checking ${entityArray.length} entities for movement collision at ${newX},${newY}`);
        
        // Filter only entities at the target position for better performance
        const entitiesAtPosition = entityArray.filter(
            entity => entity && entity.position && 
            entity.position.x === newX && 
            entity.position.y === newY
        );
        
        console.log(`Found ${entitiesAtPosition.length} entities at position ${newX},${newY}`);
        
        for (const entity of entitiesAtPosition) {
            // Check both the property and the component
            const hasBlockComponent = entity.getComponent && entity.getComponent('BlocksMovementComponent');
            
            // If entity blocks movement either by property or component, try to attack it
            if (entity.blockMovement || hasBlockComponent) {
                console.log(`Found blocking entity at ${newX},${newY}: ${entity.name || 'unknown'}`);
                
                // If we're following a path, stop following it since we encountered an obstacle
                if (pathfindingSystem.isFollowingPath()) {
                    pathfindingSystem.cancelPathFollowing("Path blocked by entity");
                }
                
                // Try to attack the entity
                if (combatSystem.attack(newX, newY)) {
                    this.processTurn();
                    return true;
                }
                return false;
            }
        }
        
        // Check if tile is blocked
        const tile = gameState.map.getTile(newX, newY);
        if (tile.blocked) {
            // If we're following a path, stop following it since we encountered a blocked tile
            if (pathfindingSystem.isFollowingPath()) {
                pathfindingSystem.cancelPathFollowing("Path blocked by terrain");
            }
            return false;
        }
        
        // Move player to new position
        gameState.player.position.x = newX;
        gameState.player.position.y = newY;
        
        // Process turn and update FOV
        this.processTurn();
        
        // Notify that player moved
        eventBus.emit('playerMoved', { x: newX, y: newY });
        
        // If we're following a path, update step
        if (pathfindingSystem.isFollowingPath()) {
            pathfindingSystem.stepAlongPath();
        }
        
        return true;
    }
    
    // Handle stairs, doors, other interactions
    tryUseStairs() {
        if (!gameState.player || !gameState.map) return false;
        
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        
        const tile = gameState.map.getTile(x, y);
        
        console.log(`Checking for stairs at position ${x},${y}. Tile type: ${tile.type}`);
        
        // Check if player is on stairs or exit tile
        if (tile.type === TILE_TYPES.STAIRS_DOWN || 
            tile.type === TILE_TYPES.STAIRS_UP ||
            tile.type === TILE_TYPES.AREA_EXIT ||
            tile.type === TILE_TYPES.DUNGEON_ENTRANCE) {
            
            console.log(`Found valid transit point: ${tile.type}. Emitting useStairs event.`);
            eventBus.emit('useStairs');
            return true;
        }
        
        console.log("No stairs or exit found at current position");
        return false;
    }
    
    // Pick up items
    tryPickupItem() {
        if (!gameState.player || !gameState.map) return false;
        
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        
        // Find items at player's position
        const entityArray = getEntityArray();
        
        const items = entityArray.filter(entity => 
            entity && 
            entity.position && 
            entity.position.x === x && 
            entity.position.y === y &&
            entity.getComponent && 
            entity.getComponent('ItemComponent')
        );
        
        if (items.length > 0) {
            // Pick up the first item
            const item = items[0];
            
            // Add to inventory
            const inventory = gameState.player.getComponent('InventoryComponent');
            if (inventory) {
                inventory.items.push(item);
                
                // Remove from map
                gameState.entities = new Map(
                    Array.from(gameState.entities.entries())
                    .filter(([id, e]) => e !== item)
                );
                
                // Remove position component
                item.removeComponent('PositionComponent');
                
                // Log message
                eventBus.emit('logMessage', { 
                    message: `Picked up ${item.name}`, 
                    type: 'info' 
                });
                
                // Process turn
                this.processTurn();
                return true;
            }
        }
        
        return false;
    }
    
    // Talk to NPCs, examine objects
    tryInteract() {
        if (!gameState.player || !gameState.map) return false;
        
        const playerX = gameState.player.position.x;
        const playerY = gameState.player.position.y;
        
        // Check all adjacent tiles for NPCs
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                // Skip the center tile (player's position)
                if (dx === 0 && dy === 0) continue;
                
                const x = playerX + dx;
                const y = playerY + dy;
                
                // Find entities at this position
                const entityArray = getEntityArray();
                
                const entities = entityArray.filter(entity => 
                    entity && 
                    entity.position && 
                    entity.position.x === x && 
                    entity.position.y === y
                );
                
                // Look for entities with dialogue
                for (const entity of entities) {
                    const dialogueComponent = entity.getComponent('DialogueComponent');
                    if (dialogueComponent) {
                        // Start dialogue
                        gameState.gameMode = 'dialogue';
                        gameState.currentDialogue = {
                            npc: entity,
                            dialogueState: 'start'
                        };
                        
                        // Emit dialogue event
                        eventBus.emit('startDialogue', entity);
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    processTurn() {
        // Increment turn counter
        gameState.turn++;
        
        // Process player-specific turn logic
        this.processPlayerTurn();
        
        // Process entity turn logic using the AISystem
        aiSystem.processEntityTurns();
        
        // Update FOV after everyone has moved
        eventBus.emit('turnProcessed');
        
        // Force re-render
        eventBus.emit('fovUpdated');
        
        // Debug output to help track aura damage issues
        console.log(`Turn ${gameState.turn} processed, emitted turnProcessed event`);
    }
    
    processPlayerTurn() {
        // Player-specific turn logic
    }
}

// Export the system
export default new InputSystem();
