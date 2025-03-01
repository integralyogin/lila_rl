import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { KEYS, TILE_TYPES } from '../constants.js';
import { allyLogic, ALLY_BEHAVIORS } from '../entities/ally_logic.js';
import combatSystem from './combatSystem.js';

/**
 * AISystem - Handles all NPC and monster AI behavior
 */
class AISystem {
    constructor() {
        console.log("AI system initialized");
    }
    
    /**
     * Process all entity turns
     */
    processEntityTurns() {
        if (!gameState.player) return;
        
        // Use the _entitiesArray getter to get an array of entities from the Map
        let entityArray = [];
        
        if (gameState._entitiesArray) {
            entityArray = gameState._entitiesArray;
        } else if (gameState.entities) {
            if (gameState.entities instanceof Map) {
                entityArray = Array.from(gameState.entities.values());
            } else if (Array.isArray(gameState.entities)) {
                entityArray = gameState.entities;
            }
        }
        
        console.log(`Processing turns for ${entityArray.length} entities`);
        
        // EMERGENCY FIX FOR GLADIATOR
        // Direct fix for the gladiator problem - completely remove AI component
        for (let entity of entityArray) {
            if (!entity || entity === gameState.player) continue;
            
            // Check if this is the gladiator
            if (entity.name && entity.name.toLowerCase().includes('gladiator')) {
                console.log(`EMERGENCY FIX: Forcefully deactivating Gladiator AI`);
                
                // Remove AI component if it exists
                if (entity.getComponent && entity.getComponent('AIComponent')) {
                    entity.removeComponent('AIComponent');
                }
                
                // Make immortal
                const health = entity.getComponent('HealthComponent');
                if (health) {
                    health.immortal = true;
                }
                
                // Set position back to original
                if (entity.position) {
                    console.log(`Resetting gladiator position to 35,25`);
                    entity.position.x = 35;
                    entity.position.y = 25;
                }
                
                entity.friendly = true;
            }
        }
        
        // CRITICAL - For town map, DISABLE ALL AI AGGRESSIVE BEHAVIOR
        // This forceful override will prevent any town NPCs from ever attacking
        if (gameState.currentMap === "town") {
            for (let entity of entityArray) {
                if (!entity || entity === gameState.player) continue;
                
                // Get AI component if exists
                if (!entity.getComponent) continue;
                const ai = entity.getComponent('AIComponent');
                if (!ai) continue;
                
                // Special case for gladiator - remove AI entirely
                if (entity.name && entity.name.toLowerCase().includes('gladiator')) {
                    entity.removeComponent('AIComponent');
                    continue;
                }
                
                // For any entity in town with hostile state, reset to idle
                if (ai.state === 'hostile' || ai.target === gameState.player) {
                    console.log(`[SAFETY] Resetting hostile state for ${entity.name} in town`);
                    ai.state = 'idle';
                    ai.target = null;
                    
                    // For wizard, etc., force friendly state
                    const entityName = entity.name ? entity.name.toLowerCase() : '';
                    if (entityName.includes('wizard') || 
                        entityName.includes('mage')) {
                        ai.type = 'friendly';
                        entity.friendly = true;
                    }
                }
                
                // Only process allies in town
                if (ai.faction === 'ally' || ai.type === 'friendly') {
                    if (ai.faction === 'ally') {
                        this.handleAllyEntity(entity);
                    }
                }
            }
            
            // COMPLETELY SKIP ALL OTHER AI PROCESSING IN TOWN
            return;
        }
        
        // Normal AI processing for non-town maps
        for (let entity of entityArray) {
            // Skip the player
            if (!entity || entity === gameState.player) continue;
            
            // Skip entities without AI or getComponent method
            if (!entity.getComponent) {
                console.warn("Entity missing getComponent method:", entity);
                continue;
            }
            
            const aiComponent = entity.getComponent('AIComponent');
            if (!aiComponent) continue;
            
            // Process based on entity type
            if (aiComponent.faction === 'ally') {
                // Handle allied entities using the ally_logic module
                this.handleAllyEntity(entity);
            } else {
                this.updateAI(entity);
            }
        }
    }
    
    /**
     * Update the AI for a single entity
     * @param {Entity} entity - The entity to update
     */
    updateAI(entity) {
        if (!entity || !gameState.player) return;
        
        const aiComponent = entity.getComponent('AIComponent');
        if (!aiComponent) return;
        
        const entityPos = entity.position;
        const playerPos = gameState.player.position;
        
        if (!entityPos || !playerPos) return;

        // Check if this is a friendly or peaceful town NPC by name - SKIP AI PROCESSING
        if (gameState.currentMap === "town") {
            const entityName = entity.name ? entity.name.toLowerCase() : '';
            
            // Special entity names that should never become hostile automatically
            if (entityName.includes('wizard') ||
                entityName.includes('mage') ||
                entityName.includes('gladiator') ||
                entityName.includes('shopkeeper') ||
                entityName.includes('innkeeper') ||
                entityName.includes('blacksmith') ||
                entity.friendly === true) {
                
                // If already hostile continue processing (they were attacked), otherwise skip
                if (aiComponent.state !== 'hostile' && !aiComponent.target) {
                    // console.log(`Skipping AI for town NPC: ${entity.name}`);
                    return;
                }
            }
        }
        
        // Calculate distance to player
        const dx = playerPos.x - entityPos.x;
        const dy = playerPos.y - entityPos.y;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
        
        // Check if we can see the player
        const canSeePlayer = this.hasLineOfSight(
            entityPos.x, entityPos.y,
            playerPos.x, playerPos.y
        );
        
        // Update AI state based on distance and visibility
        if (aiComponent.state === 'idle') {
            // Extra check for friendly NPCs and those marked as friendly
            const entityName = entity.name ? entity.name.toLowerCase() : '';
            if (entity.friendly === true || 
                (gameState.currentMap === "town" && 
                 (entityName.includes('gladiator') || 
                  entityName.includes('wizard') || 
                  entityName.includes('mage')))) {
                // These entities never turn hostile automatically
                return;
            }
            
            if (canSeePlayer && distanceToPlayer < (aiComponent.aggroRange || 8)) {
                aiComponent.state = 'hostile';
                aiComponent.target = gameState.player; // Note: Using 'target' to match AIComponent in aiComponents.js
                
                // Alert message if this is first aggro
                if (!entity.alertedPlayer) {
                    entity.alertedPlayer = true;
                    eventBus.emit('logMessage', {
                        message: `The ${entity.name} notices you!`,
                        type: 'warning'
                    });
                }
            }
        }
        
        // If hostile, use the AI behavior system from aiComponents
        if (aiComponent.state === 'hostile' && aiComponent.target) {
            // Use the entity's takeTurn method if available (which uses the behavior tree)
            if (typeof aiComponent.takeTurn === 'function') {
                console.log(`[AISystem] Entity ${entity.name} using behavior tree AI`);
                aiComponent.takeTurn();
                return;
            }
            
            // Check if entity has spells and a mana component
            const hasSpells = entity.getComponent('SpellsComponent') && 
                             entity.getComponent('SpellsComponent').knownSpells &&
                             entity.getComponent('SpellsComponent').knownSpells.size > 0;
            const hasMana = entity.getComponent('ManaComponent') && 
                           entity.getComponent('ManaComponent').mana > 0;
            
            // Decide whether to use a spell or melee attack
            if (hasSpells && hasMana && distanceToPlayer <= 6 && distanceToPlayer > 1.5) {
                // Get a spell to cast
                const spellsComponent = entity.getComponent('SpellsComponent');
                const spellId = Array.from(spellsComponent.knownSpells.keys())[0]; // Use first spell
                const spell = spellsComponent.knownSpells.get(spellId);
                
                console.log(`[AISystem] ${entity.name} is casting spell: ${spellId}`);
                
                // Create a context for the spell cast
                const context = {
                    target: gameState.player,
                    spellId: spellId,
                    spellManaCost: spell.manaCost || 5
                };
                
                // Cast the spell using the castSpell behavior
                const aiBehaviorManager = window.aiBehaviorManager || 
                    (window.AIBehaviorManager ? new window.AIBehaviorManager() : null);
                
                if (aiBehaviorManager) {
                    aiBehaviorManager.execute('castSpell', entity, context);
                } else {
                    console.error("[AISystem] Cannot find aiBehaviorManager for spell casting");
                    // Fall back to melee if close enough
                    if (distanceToPlayer <= 1.5) {
                        this.entityAttack(entity, gameState.player);
                    } else {
                        this.moveTowardTarget(entity, playerPos.x, playerPos.y);
                    }
                }
            } 
            // If adjacent to player or no spells, use melee attack
            else if (distanceToPlayer <= 1.5) {
                this.entityAttack(entity, gameState.player);
            } 
            // If can see player, move toward them
            else if (canSeePlayer) {
                this.moveTowardTarget(entity, playerPos.x, playerPos.y);
            }
            // If can't see player but was previously hostile, wander or search
            else {
                if (Math.random() < 0.7) {
                    // 70% chance to move randomly
                    this.moveRandomly(entity);
                }
            }
        } 
        // If not hostile, just wander randomly sometimes
        else {
            if (Math.random() < 0.3) {
                this.moveRandomly(entity);
            }
        }
    }
    
    /**
     * Entity attacks a target
     * @param {Entity} attacker - The attacking entity
     * @param {Entity} target - The target entity (usually the player)
     */
    entityAttack(attacker, target) {
        if (!attacker || !target || !attacker.health || !target.health) return;
        
        // Calculate attack and defense values
        const attackerStats = attacker.getComponent('StatsComponent');
        const targetStats = target.getComponent('StatsComponent');
        
        let attackValue = attackerStats ? attackerStats.strength : 3;
        let defenseValue = targetStats ? targetStats.dexterity : 5;
        
        // Get damage value
        let damageValue = attackerStats ? Math.floor(attackerStats.strength / 3) + 1 : 1;
        
        // Calculate hit chance
        const hitChance = Math.min(0.8, Math.max(0.2, 0.5 + (attackValue - defenseValue) * 0.05));
        const hitRoll = Math.random();
        
        if (hitRoll <= hitChance) {
            // Hit! Calculate damage reduction from armor
            const armorClass = combatSystem.getEntityArmorClass(target);
            const damageReduction = Math.floor(armorClass / 2);
            const finalDamage = Math.max(1, damageValue - damageReduction);
            
            // Apply damage
            target.health.hp -= finalDamage;
            
            // Log message
            eventBus.emit('logMessage', {
                message: `The ${attacker.name} hits you for ${finalDamage} damage!`,
                type: 'danger'
            });
            
            // Check if player died
            if (target.health.hp <= 0) {
                this.handlePlayerDeath();
            }
        } else {
            // Missed
            eventBus.emit('logMessage', {
                message: `The ${attacker.name} misses you.`,
                type: 'info'
            });
        }
    }
    
    /**
     * Handle player death
     */
    handlePlayerDeath() {
        gameState.player.health.hp = 0;
        eventBus.emit('logMessage', {
            message: 'You have died! Game over.',
            type: 'danger'
        });
        
        // Set game state to game over
        gameState.gameMode = 'gameOver';
        eventBus.emit('gameOver');
    }
    
    /**
     * Safely handle ally entity AI
     * @param {Entity} entity - The ally entity to process
     */
    handleAllyEntity(entity) {
        try {
            // Check if summonedBy component exists to get ally position info
            if (entity.getComponent('SummonedByComponent')) {
                // Get entity ID for tracking
                const entityId = entity.id;

                // Find the position for proper ally logic
                const pos = entity.getComponent('PositionComponent');
                if (!pos) {
                    console.warn(`Ally ${entity.name} missing position component`);
                    return;
                }
                
                // Get AI component
                const ai = entity.getComponent('AIComponent');
                if (!ai) {
                    console.warn(`Ally ${entity.name} missing AI component`);
                    return;
                }
                
                // Get entity type from name or AI behavior
                const entityName = entity.name ? entity.name.toLowerCase() : '';
                const entityType = entityName.includes('hydra') ? 'hydra' : entity.type || 'generic';
                
                console.log(`Processing ${entityName} (${entityType}) ally turn`);
                
                // Determine the behavior type
                let behavior = ALLY_BEHAVIORS.FOLLOWER;
                if (entityType === 'hydra' || ai.behaviorType === 'stationary') {
                    behavior = ALLY_BEHAVIORS.STATIONARY_CASTER;
                }
                
                // First, make sure this creature is registered with allyLogic
                if (!allyLogic.isRegistered || !allyLogic.isRegistered(entityId)) {
                    console.log(`Registering ${entity.name} with allyLogic, behavior: ${behavior}`);
                    allyLogic.registerSummonedCreature(entityId, pos.x, pos.y, behavior);
                }
                
                // Now, handle the ally's turn
                if (allyLogic && typeof allyLogic.handleAllyTurn === 'function') {
                    console.log(`Calling allyLogic.handleAllyTurn for ${entity.name}`);
                    const result = allyLogic.handleAllyTurn(entity);
                    if (result) {
                        console.log(`Ally turn processed successfully for ${entity.name}`);
                    } else {
                        console.warn(`Ally turn processing returned false for ${entity.name}`);
                    }
                } else {
                    console.error(`Error: allyLogic.handleAllyTurn not available`);
                }
            }
        } catch (error) {
            console.error(`Error in handleAllyEntity: ${error.message}`, error);
        }
    }
    
    /**
     * Move entity toward a target position
     * @param {Entity} entity - The entity to move
     * @param {number} targetX - Target x position
     * @param {number} targetY - Target y position
     */
    moveTowardTarget(entity, targetX, targetY) {
        const pos = entity.position;
        const dx = targetX - pos.x;
        const dy = targetY - pos.y;
        
        let newX = pos.x;
        let newY = pos.y;
        
        // Try to move horizontally or vertically toward target
        if (Math.abs(dx) > Math.abs(dy)) {
            // Move horizontally first
            newX = pos.x + Math.sign(dx);
            if (!this.isPositionBlocked(newX, pos.y)) {
                entity.position.x = newX;
                return;
            }
            // If horizontal movement failed, try vertical
            newY = pos.y + Math.sign(dy);
            if (!this.isPositionBlocked(pos.x, newY)) {
                entity.position.y = newY;
                return;
            }
        } else {
            // Move vertically first
            newY = pos.y + Math.sign(dy);
            if (!this.isPositionBlocked(pos.x, newY)) {
                entity.position.y = newY;
                return;
            }
            // If vertical movement failed, try horizontal
            newX = pos.x + Math.sign(dx);
            if (!this.isPositionBlocked(newX, pos.y)) {
                entity.position.x = newX;
                return;
            }
        }
    }
    
    /**
     * Move entity in a random direction
     * @param {Entity} entity - The entity to move
     */
    moveRandomly(entity) {
        const directions = [
            { x: 0, y: -1 }, // north
            { x: 1, y: -1 },  // northeast
            { x: 1, y: 0 },   // east
            { x: 1, y: 1 },   // southeast
            { x: 0, y: 1 },   // south
            { x: -1, y: 1 },  // southwest
            { x: -1, y: 0 },  // west
            { x: -1, y: -1 }  // northwest
        ];
        
        // Shuffle directions for random selection
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }
        
        // Try each direction until we find a valid move
        for (const dir of directions) {
            const newX = entity.position.x + dir.x;
            const newY = entity.position.y + dir.y;
            
            if (!this.isPositionBlocked(newX, newY)) {
                entity.position.x = newX;
                entity.position.y = newY;
                return;
            }
        }
    }
    
    /**
     * Check if a position is blocked by terrain or entities
     * @param {number} x - X position to check
     * @param {number} y - Y position to check
     * @returns {boolean} - True if the position is blocked
     */
    isPositionBlocked(x, y) {
        // Check if out of bounds
        if (!gameState.map || x < 0 || y < 0 || 
            x >= gameState.map.width || y >= gameState.map.height) {
            return true;
        }
        
        // Check if blocked by terrain
        const tile = gameState.map.getTile(x, y);
        if (!tile || tile.blocked) {
            return true;
        }
        
        // Check if blocked by another entity
        let entityArray = [];
        
        if (gameState._entitiesArray) {
            entityArray = gameState._entitiesArray;
        } else if (gameState.entities) {
            if (gameState.entities instanceof Map) {
                entityArray = Array.from(gameState.entities.values());
            } else if (Array.isArray(gameState.entities)) {
                entityArray = gameState.entities;
            }
        }
        
        for (const entity of entityArray) {
            if (entity.position && 
                entity.position.x === x && 
                entity.position.y === y) {
                    
                // Check both the property and the component
                const hasBlockComponent = entity.getComponent && entity.getComponent('BlocksMovementComponent');
                
                if (entity.blockMovement || hasBlockComponent) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check if there's a clear line of sight between two points
     * @param {number} x1 - Starting x position
     * @param {number} y1 - Starting y position
     * @param {number} x2 - Target x position
     * @param {number} y2 - Target y position
     * @returns {boolean} - True if there is a clear line of sight
     */
    hasLineOfSight(x1, y1, x2, y2) {
        // Bresenham's line algorithm
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        
        let x = x1;
        let y = y1;
        
        while (x !== x2 || y !== y2) {
            const e2 = 2 * err;
            
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
            
            // Skip the starting and ending points
            if (x === x1 && y === y1) continue;
            if (x === x2 && y === y2) continue;
            
            // Check if this point blocks vision
            const tile = gameState.map.getTile(x, y);
            if (!tile || tile.blocksVision) {
                return false;
            }
        }
        
        return true;
    }
}

// Export a singleton instance
const aiSystem = new AISystem();
export default aiSystem;