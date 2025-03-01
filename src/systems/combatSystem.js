import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { KEYS, TILE_TYPES } from '../constants.js';

/**
 * CombatSystem - Handles all combat-related logic that was previously in inputSystem
 */
class CombatSystem {
    constructor() {
        console.log("Combat system initialized");
    }
    
    /**
     * Attack an entity at a specified position
     * @param {number} tx - Target x position
     * @param {number} ty - Target y position
     * @returns {boolean} Whether the attack was successful
     */
    attack(tx, ty) {
        if (!gameState.player) return false;
        
        // Find target entity at the position
        let targetEntity = null;
        
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
        
        console.log(`Looking for target at (${tx},${ty}) among ${entityArray.length} entities`);
        
        for (const entity of entityArray) {
            if (entity && entity.position && entity.position.x === tx && entity.position.y === ty) {
                if (entity.blockMovement) {
                    targetEntity = entity;
                    console.log(`Found target entity for attack: ${entity.name || 'unknown'}`);
                    break;
                }
            }
        }
        
        if (!targetEntity || !targetEntity.health) {
            return false;
        }
        
        // Check if entity is polymorphed - can't attack polymorphed entities
        if (targetEntity.hasComponent && targetEntity.hasComponent('PolymorphComponent')) {
            eventBus.emit('logMessage', { 
                message: `${targetEntity.name} is already incapacitated.`,
                type: 'combat'
            });
            return true; // Attack was attempted but not processed
        }
        
        // Get player stats and equipment
        const playerStats = gameState.player.getComponent('StatsComponent');
        const playerEquipment = gameState.player.getComponent('EquipmentComponent');
        
        // Base attack values
        let attackValue = playerStats ? playerStats.strength : 5;
        let damageValue = playerStats ? Math.floor(playerStats.strength / 3) + 1 : 2;
        
        // Add weapon bonuses if equipped
        if (playerEquipment && playerEquipment.weapon) {
            const weapon = playerEquipment.weapon;
            attackValue += weapon.attackBonus || 0;
            damageValue += weapon.damageBonus || 0;
        }
        
        // Target defense values
        const targetStats = targetEntity.getComponent('StatsComponent');
        let defenseValue = targetStats ? targetStats.dexterity : 3;
        
        const targetEquipment = targetEntity.getComponent('EquipmentComponent');
        if (targetEquipment && targetEquipment.armor) {
            defenseValue += targetEquipment.armor.defenseBonus || 0;
        }
        
        // Calculate hit chance
        const hitChance = Math.min(0.9, Math.max(0.1, 0.6 + (attackValue - defenseValue) * 0.05));
        const hitRoll = Math.random();
        
        let message;
        
        if (hitRoll <= hitChance) {
            // Hit! Calculate damage
            let damage = damageValue;
            
            // Apply armor damage reduction if applicable
            const armorClass = this.getEntityArmorClass(targetEntity);
            const damageReduction = Math.floor(armorClass / 2);
            damage = Math.max(1, damage - damageReduction);
            
            targetEntity.health.hp -= damage;
            
            message = `You hit the ${targetEntity.name} for ${damage} damage!`;
            
            // Check if target was killed
            if (targetEntity.health.hp <= 0) {
                // If damage is significantly higher than max HP, don't leave a corpse
                const overkill = damage > targetEntity.health.maxHp * 1.5;
                
                if (overkill) {
                    message = `You completely destroy the ${targetEntity.name}!`;
                    gameState.removeEntity(targetEntity.id);
                } else {
                    this.handleEntityKilled(targetEntity);
                }
            } else {
                // Make hostile
                const aiComponent = targetEntity.getComponent('AIComponent');
                if (aiComponent) {
                    aiComponent.state = 'hostile';
                    aiComponent.targetEntity = gameState.player;
                }
            }
        } else {
            // Miss
            message = `You miss the ${targetEntity.name}.`;
        }
        
        // Log combat message
        eventBus.emit('logMessage', { message, type: 'combat' });
        
        // Combat was attempted, process player turn
        return true;
    }
    
    /**
     * Get the armor class of an entity
     * @param {Entity} entity - The entity to check
     * @returns {number} The armor class value
     */
    getEntityArmorClass(entity) {
        let armorClass = 0;
        
        // Base armor from stats
        const statsComponent = entity.getComponent('StatsComponent');
        if (statsComponent) {
            armorClass += Math.floor(statsComponent.dexterity / 4);
        }
        
        // Armor equipment
        const equipmentComponent = entity.getComponent('EquipmentComponent');
        if (equipmentComponent && equipmentComponent.armor) {
            armorClass += equipmentComponent.armor.armorClass || 0;
        }
        
        return armorClass;
    }
    
    /**
     * Handle entity death
     * @param {Entity} entity - The entity that was killed
     */
    handleEntityKilled(entity) {
        // Get XP value from entity
        let xpValue = 10; // Default XP value
        
        const statsComponent = entity.getComponent('StatsComponent');
        if (statsComponent && statsComponent.xpValue) {
            xpValue = statsComponent.xpValue;
        }
        
        // Award XP to player
        const playerStats = gameState.player.getComponent('StatsComponent');
        if (playerStats) {
            playerStats.xp += xpValue;
            eventBus.emit('logMessage', { 
                message: `You gained ${xpValue} experience.`, 
                type: 'info' 
            });
            
            // Check for level up
            if (playerStats.xp >= playerStats.nextLevelXP) {
                this.handlePlayerLevelUp(playerStats);
            }
        }
        
        // Check for loot drops
        this.handleLootDrop(entity);
        
        // Set entity as dead
        entity.health.hp = 0;
        
        // Get or create renderable component
        const renderableComponent = entity.getComponent('RenderableComponent');
        if (renderableComponent) {
            renderableComponent.char = '%';
            renderableComponent.color = '#730303';
            renderableComponent.background = null;
            renderableComponent.priority = 1; // Below living entities
        } else {
            console.error("Entity missing renderable component during death:", entity);
        }
        
        // Remove blocking property so player can walk over corpses
        entity.blockMovement = false;
        
        // Remove BlocksMovementComponent if it exists
        if (entity.getComponent('BlocksMovementComponent')) {
            entity.removeComponent('BlocksMovementComponent');
        }
        
        // Disable health regeneration by removing the regeneration property
        const healthComponent = entity.getComponent('HealthComponent');
        if (healthComponent) {
            healthComponent.regenerate = false;
            healthComponent.regenRate = 0;
        }
        
        const aiComponent = entity.getComponent('AIComponent');
        if (aiComponent) {
            entity.removeComponent('AIComponent');
        }
        
        // Add a "corpse" flag to indicate this is a corpse
        entity.corpse = true;
        
        // Log death message
        eventBus.emit('logMessage', { 
            message: `You killed the ${entity.name}!`, 
            type: 'success' 
        });
    }
    
    /**
     * Handle player level up
     * @param {object} playerStats - The player's stats component
     */
    handlePlayerLevelUp(playerStats) {
        playerStats.level += 1;
        playerStats.nextLevelXP = Math.floor(playerStats.nextLevelXP * 1.5);
        
        // Increase stats
        playerStats.strength += 1;
        playerStats.dexterity += 1;
        playerStats.intelligence += 1;
        
        // Increase health
        const healthComponent = gameState.player.getComponent('HealthComponent');
        if (healthComponent) {
            healthComponent.maxHp += 5;
            healthComponent.hp = healthComponent.maxHp; // Fully heal on level up
        }
        
        // Increase mana
        const manaComponent = gameState.player.getComponent('ManaComponent');
        if (manaComponent) {
            manaComponent.maxMana += 5;
            manaComponent.mana = manaComponent.maxMana; // Fully restore mana on level up
        }
        
        // Log level up message
        eventBus.emit('logMessage', { 
            message: `You reached level ${playerStats.level}!`,
            type: 'success'
        });
    }
    
    /**
     * Handle potential loot drops from killed entities
     * @param {Entity} entity - The killed entity
     */
    handleLootDrop(entity) {
        // Check if entity has loot table
        const lootTable = entity.lootTable;
        if (!lootTable || !lootTable.length) return;
        
        // Roll for each item in loot table
        for (const lootEntry of lootTable) {
            const chance = lootEntry.chance || 0.2; // Default 20% chance
            
            if (Math.random() <= chance) {
                // Create the item
                const itemData = lootEntry.item;
                if (!itemData) continue;
                
                const item = new Entity();
                item.name = itemData.name;
                
                // Add position component at entity's location
                item.addComponent(
                    new PositionComponent(
                        entity.position.x,
                        entity.position.y
                    )
                );
                
                // Add renderable component
                item.addComponent(
                    new RenderableComponent(
                        itemData.char || '?',
                        itemData.color || '#fff',
                        null, // Background
                        3 // zIndex
                    )
                );
                
                // Add item component
                item.addComponent(
                    new ItemComponent(
                        itemData.type || 'misc',
                        itemData.description || `A ${itemData.name}`
                    )
                );
                
                // Add additional components based on item type
                if (itemData.type === 'weapon') {
                    item.addComponent(
                        new EquippableComponent(
                            'weapon',
                            itemData.attackBonus || 1,
                            itemData.damageBonus || 1
                        )
                    );
                } else if (itemData.type === 'armor') {
                    item.addComponent(
                        new EquippableComponent(
                            'armor',
                            itemData.defenseBonus || 1,
                            0,
                            itemData.armorClass || 1
                        )
                    );
                } else if (itemData.type === 'potion') {
                    item.addComponent(
                        new UsableComponent(
                            itemData.effect || 'heal',
                            itemData.amount || 5
                        )
                    );
                }
                
                // Add the item to the game
                if (gameState.entities instanceof Map) {
                    gameState.entities.set(item.id || `item-${Date.now()}`, item);
                } else if (Array.isArray(gameState.entities)) {
                    gameState.entities.push(item);
                }
                
                // Log item drop message
                eventBus.emit('logMessage', { 
                    message: `The ${entity.name} dropped ${itemData.name}!`, 
                    type: 'info' 
                });
            }
        }
    }
}

// Export a singleton instance
const combatSystem = new CombatSystem();
export default combatSystem;