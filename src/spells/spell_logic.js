import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { targetingSystem } from '../systems/targetingSystem.js';
import EntityFactory from '../entities/entityFactory.js';
import Entity from '../entities/entity.js';
import { 
    PositionComponent, 
    RenderableComponent,
    HealthComponent,
    StatsComponent,
    AIComponent,
    SummonedByComponent,
    BlocksMovementComponent
} from '../entities/components.js';

class SpellLogic {
    constructor() {
        this.spellEffects = new Map();
        this.gameData = {
            monsters: null
        };
        this.registerDefaultSpells();
    }
    
    /**
     * Update game data for use in spell effects
     * @param {Object} data - The game data object
     */
    updateGameData(data) {
        this.gameData = data;
        console.log("SpellLogic: Updated game data", data ? Object.keys(data) : "null");
        if (data && data.monsters) {
            console.log("SpellLogic: Loaded monster templates:", data.monsters.map(m => m.id));
        }
    }

    /**
     * Register a spell effect implementation
     * @param {string} spellId - Unique identifier for the spell
     * @param {object} implementation - Implementation object with cast and optionally target methods
     */
    registerSpell(spellId, implementation) {
        this.spellEffects.set(spellId, implementation);
    }

    /**
     * Register default spell implementations
     */
    registerDefaultSpells() {
        // Firebolt spell
        this.registerSpell('firebolt', {
            targetType: 'entity',
            target: (spell, callback) => {
                gameState.addMessage("Choose a target for your Firebolt spell. Valid targets will be highlighted. Press ESC to cancel.", "important");
                
                // Start targeting mode
                targetingSystem.startTargeting(spell, callback);
            },
            cast: (spell, target) => {
                // Use mana
                const mana = gameState.player.getComponent('ManaComponent');
                mana.useMana(spell.manaCost);
                
                // Calculate damage based on player intelligence
                const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
                const damage = spell.baseDamage + Math.floor(intelligence * 0.5);
                
                // Find entity at the target position
                const targetEntity = Array.from(gameState.entities.values()).find(e => {
                    if (e.hasComponent('PositionComponent')) {
                        const pos = e.getComponent('PositionComponent');
                        return pos.x === target.x && pos.y === target.y && e.hasComponent('HealthComponent');
                    }
                    return false;
                });
                
                // If no entity with health at target, the spell still casts but hits nothing
                if (!targetEntity) {
                    gameState.addMessage(`You cast ${spell.name} at the location, but hit nothing.`);
                    return;
                }
                
                // Check if targeting an NPC that's not hostile
                const isNPC = targetEntity.hasComponent('DialogueComponent');
                let proceedWithAttack = true;
                
                if (isNPC && targetEntity.hasComponent('AIComponent')) {
                    const ai = targetEntity.getComponent('AIComponent');
                    
                    // If NPC is in idle state (not hostile yet), ask for confirmation
                    if (ai.state === 'idle') {
                        // Ask for confirmation before attacking peaceful NPC
                        proceedWithAttack = window.confirm(`Do you want to attack ${targetEntity.name} with ${spell.name}? This might have serious consequences.`);
                        
                        if (!proceedWithAttack) {
                            // Player decided not to attack - spell is still cast, but misses
                            gameState.addMessage(`You redirect your ${spell.name} spell away from ${targetEntity.name} at the last moment.`);
                            return; // Spell is still cast and mana is used, but no damage
                        }
                        
                        // If confirmed, proceed with attack
                        gameState.addMessage(`You deliberately target ${targetEntity.name} with your ${spell.name}!`, 'danger');
                        
                        // Mark NPC as hostile now
                        ai.state = 'enraged';
                        ai.target = gameState.player;
                    }
                }
                
                if (proceedWithAttack) {
                    // Apply damage to the targeted entity
                    const targetHealth = targetEntity.getComponent('HealthComponent');
                    const isDead = targetHealth.takeDamage(damage);
                    
                    // Log the spell effect
                    gameState.addMessage(`You cast ${spell.name} and hit ${targetEntity.name} for ${damage} damage!`);
                    
                    // Special handling for immortal entities like training dummies
                    if (targetHealth.immortal) {
                        gameState.addMessage(`${targetEntity.name} takes the hit but remains standing.`);
                        return;
                    }
                    
                    // Check if target died
                    if (isDead) {
                        gameState.addMessage(`${targetEntity.name} is incinerated!`);
                        gameState.removeEntity(targetEntity.id);
                        
                        // Award XP if it was an enemy
                        if (targetEntity.hasComponent('AIComponent')) {
                            const targetStats = targetEntity.getComponent('StatsComponent');
                            if (targetStats) {
                                const playerStats = gameState.player.getComponent('StatsComponent');
                                const xpGained = targetStats.level * 10;
                                const didLevelUp = playerStats.addXp(xpGained);
                                
                                gameState.addMessage(`You gain ${xpGained} XP.`);
                                if (didLevelUp) {
                                    gameState.addMessage(`You advance to level ${playerStats.level}!`, 'important');
                                }
                                
                                gameState.score += xpGained;
                            }
                        } else {
                            // Show different message for non-enemies (like town NPCs)
                            gameState.addMessage(`You've killed ${targetEntity.name}! This may have consequences...`);
                        }
                    }
                }
            }
        });
        
        // Generic aura spell handler - can be used for any aura type spell
        this.registerSpell('aura', {
            targetType: 'self',
            cast: (spell) => {
                // Use mana for initial cast
                const mana = gameState.player.getComponent('ManaComponent');
                if (!mana.useMana(spell.manaCost)) {
                    gameState.addMessage(`You don't have enough mana to cast ${spell.spellName}.`);
                    return false;
                }
                
                // Calculate damage based on player intelligence (if it's a damaging aura)
                const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
                const baseDamage = spell.baseDamage ? (spell.baseDamage + Math.floor(intelligence * 0.3)) : 0;
                
                // Get aura configuration from spell
                const element = spell.element || 'neutral';
                const duration = spell.duration || 5; // Default 5 turns if not specified
                const aoeRadius = spell.aoeRadius || 1; // Default radius 1 if not specified
                const turnCost = spell.turnCost || 1; // Mana cost per turn
                const effects = spell.effects || [];
                const auraColor = spell.color || '#ff8c00'; // Default to orange if not specified
                
                // Generate element-specific messages
                let castMessage = `You surround yourself with a magical aura!`;
                let tickMessage = `Your aura pulses with energy.`;
                let expireMessage = `Your aura dissipates.`;
                let noManaMessage = `Your aura dissipates as you run out of mana.`;
                let damageMessage = `Your aura damages {target} for {damage}!`;
                let deathMessage = `{target} is destroyed by your aura!`;
                
                // Customize messages based on element
                if (element === 'fire') {
                    castMessage = `You surround yourself with a blazing aura of fire!`;
                    tickMessage = `Your flame aura burns brightly.`;
                    expireMessage = `Your flame aura dissipates.`;
                    noManaMessage = `Your flame aura dissipates as you run out of mana.`;
                    damageMessage = `Your flame aura burns {target} for {damage} damage!`;
                    deathMessage = `{target} is incinerated by your flame aura!`;
                } else if (element === 'ice') {
                    castMessage = `You surround yourself with a freezing aura of ice!`;
                    tickMessage = `Your frost aura shimmmers coldly.`;
                    expireMessage = `Your frost aura melts away.`;
                    noManaMessage = `Your frost aura melts away as you run out of mana.`;
                    damageMessage = `Your frost aura freezes {target} for {damage} damage!`;
                    deathMessage = `{target} is frozen solid by your frost aura!`;
                } else if (element === 'lightning') {
                    castMessage = `Crackling electricity surrounds you in an aura of lightning!`;
                    tickMessage = `Your lightning aura crackles with energy.`;
                    expireMessage = `Your lightning aura fades away.`;
                    noManaMessage = `Your lightning aura shorts out as you run out of mana.`;
                    damageMessage = `Your lightning aura shocks {target} for {damage} damage!`;
                    deathMessage = `{target} is electrocuted by your lightning aura!`;
                } else if (element === 'nature') {
                    castMessage = `You surround yourself with a swirling aura of natural energy!`;
                    tickMessage = `Your nature aura pulses with life.`;
                    expireMessage = `Your nature aura returns to the earth.`;
                    noManaMessage = `Your nature aura withers as you run out of mana.`;
                    damageMessage = `Your nature aura lashes {target} for {damage} damage!`;
                    deathMessage = `{target} is overwhelmed by your nature aura!`;
                } else if (element === 'radiant') {
                    castMessage = `You surround yourself with a brilliant aura of holy light!`;
                    tickMessage = `Your radiant aura shines brightly.`;
                    expireMessage = `Your radiant aura fades away.`;
                    noManaMessage = `Your radiant aura dims as you run out of mana.`;
                    damageMessage = `Your radiant aura smites {target} for {damage} damage!`;
                    deathMessage = `{target} is banished by your radiant aura!`;
                } else if (element === 'arcane') {
                    castMessage = `You surround yourself with a shimmering aura of arcane energy!`;
                    tickMessage = `Your arcane aura hums with power.`;
                    expireMessage = `Your arcane aura dissipates.`;
                    noManaMessage = `Your arcane aura unravels as you run out of mana.`;
                    damageMessage = `Your arcane aura disrupts {target} for {damage} damage!`;
                    deathMessage = `{target} is torn apart by your arcane aura!`;
                }
                
                // Display initial cast message
                gameState.addMessage(castMessage, "important");
                
                // Store current turn to track duration
                const startTurn = gameState.turn;
                
                // Set up the callback for the "turnProcessed" event to apply effects each turn
                const auraEffect = () => {
                    // Check if spell has expired
                    if (gameState.turn > startTurn + duration) {
                        // Remove the event listener when duration is over
                        eventBus.off('turnProcessed', auraEffect);
                        gameState.addMessage(expireMessage, "info");
                        return;
                    }
                    
                    // Use mana per turn to maintain the aura
                    if (!mana.useMana(turnCost)) {
                        // If player runs out of mana, the aura dissipates early
                        eventBus.off('turnProcessed', auraEffect);
                        gameState.addMessage(noManaMessage, "info");
                        return;
                    }
                    
                    // Count remaining turns
                    const remainingTurns = (startTurn + duration) - gameState.turn;
                    
                    // Only apply effects on the player's turn, not when other entities move
                    if (gameState.turn > startTurn) {
                        // Track if we affected any entities this turn
                        let affectedEntities = false;
                        
                        // Debug message to help diagnose aura issues
                        console.log(`Aura active: ${spell.spellName}, turn ${gameState.turn}, baseDamage: ${baseDamage}, effects: ${effects}, element: ${element}`);
                    
                        
                        // If this is a damaging aura
                        if (baseDamage > 0 && effects.includes('damage')) {
                            // Apply damage to all entities within the aura's radius
                            const playerX = gameState.player.position.x;
                            const playerY = gameState.player.position.y;
                            
                            // Get all entities with health components
                            const entities = gameState.getEntitiesWithComponents('HealthComponent', 'PositionComponent');
                            
                            console.log(`Found ${entities.length} entities with HealthComponent and PositionComponent`);
                            
                            // Check each entity
                            for (const entity of entities) {
                                // Skip the player - aura doesn't damage self
                                if (entity === gameState.player) continue;
                                
                                const entityPos = entity.getComponent('PositionComponent');
                                const dx = Math.abs(entityPos.x - playerX);
                                const dy = Math.abs(entityPos.y - playerY);
                                
                                console.log(`Entity ${entity.name} at position (${entityPos.x}, ${entityPos.y}), distance: dx=${dx}, dy=${dy}, radius=${aoeRadius}`);
                                
                                // If entity is within aura radius
                                if (dx <= aoeRadius && dy <= aoeRadius) {
                                    console.log(`Entity ${entity.name} is within aura radius!`);
                                    
                                    // Check if entity has health component
                                    const health = entity.getComponent('HealthComponent');
                                    if (health) {
                                        console.log(`Entity ${entity.name} has ${health.hp}/${health.maxHp} HP, applying ${baseDamage} damage`);
                                        
                                        // Apply damage
                                        const isDead = health.takeDamage(baseDamage);
                                        affectedEntities = true;
                                        
                                        // Log the damage
                                        const customDamageMessage = damageMessage
                                            .replace('{target}', entity.name)
                                            .replace('{damage}', baseDamage);
                                        gameState.addMessage(customDamageMessage);
                                        
                                        // Handle special element effects
                                        if (element === 'ice' && effects.includes('slow') && !isDead) {
                                            // Apply slow effect (just visual for now)
                                            if (Math.random() < 0.5) {
                                                gameState.addMessage(`${entity.name} is slowed by the freezing cold!`);
                                            }
                                        }
                                        
                                        // Special handling for immortal entities like training dummies
                                        if (health.immortal) {
                                            gameState.addMessage(`${entity.name} takes the hit but remains standing.`);
                                            continue; // Skip death processing and go to the next entity
                                        }
                                        
                                        // Handle entity death
                                        if (isDead) {
                                            const customDeathMessage = deathMessage
                                                .replace('{target}', entity.name);
                                            gameState.addMessage(customDeathMessage);
                                            
                                            // Award XP if it was an enemy with AI and stats
                                            if (entity.hasComponent('AIComponent') && entity.hasComponent('StatsComponent')) {
                                                const targetStats = entity.getComponent('StatsComponent');
                                                const playerStats = gameState.player.getComponent('StatsComponent');
                                                const xpGained = targetStats.level * 10;
                                                const didLevelUp = playerStats.addXp(xpGained);
                                                
                                                gameState.addMessage(`You gain ${xpGained} XP.`);
                                                if (didLevelUp) {
                                                    gameState.addMessage(`You advance to level ${playerStats.level}!`, 'important');
                                                }
                                                
                                                gameState.score += xpGained;
                                            }
                                            
                                            // Remove the dead entity
                                            gameState.removeEntity(entity.id);
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Handle healing effects
                        if (effects.includes('heal') && !affectedEntities) {
                            const healAmount = Math.floor(baseDamage * 0.5) || 1;
                            const playerHealth = gameState.player.getComponent('HealthComponent');
                            
                            if (playerHealth && playerHealth.hp < playerHealth.maxHp) {
                                playerHealth.heal(healAmount);
                                gameState.addMessage(`Your aura restores ${healAmount} health.`);
                                affectedEntities = true;
                            }
                        }
                        
                        // Handle defense boost effects
                        if (effects.includes('defense_boost') && gameState.turn === startTurn + 1) {
                            const playerStats = gameState.player.getComponent('StatsComponent');
                            if (playerStats) {
                                const defenseBoost = 2;
                                playerStats.defense += defenseBoost;
                                gameState.addMessage(`Your aura increases your defense by ${defenseBoost}!`);
                                
                                // Schedule defense reset when aura ends
                                setTimeout(() => {
                                    playerStats.defense = Math.max(playerStats.defense - defenseBoost, 0);
                                    gameState.addMessage("The defensive effect of your aura fades.");
                                }, duration * 1000); // Approximately when aura would end
                            }
                        }
                        
                        // If we didn't affect any entities this turn, show a generic message
                        if (!affectedEntities) {
                            gameState.addMessage(`${tickMessage} (${remainingTurns} turns remaining)`);
                        }
                    }
                };
                
                // Register the aura effect to run each turn
                eventBus.on('turnProcessed', auraEffect);
                
                return true;
            }
        });
        
        // Map specific aura spells to the generic aura handler
        this.registerSpell('flameaura', {
            targetType: 'self',
            cast: (spell) => {
                // Use the generic aura spell handler with this specific spell data
                return this.castSpell('aura', spell);
            }
        });
        
        // Frost Aura spell
        this.registerSpell('frostaura', {
            targetType: 'self',
            cast: (spell) => {
                // Use the generic aura spell handler with this specific spell data
                return this.castSpell('aura', spell);
            }
        });

        // Ice Spear spell
        this.registerSpell('icespear', {
            targetType: 'entity',
            target: (spell, callback) => {
                gameState.addMessage("Choose a target for your Ice Spear spell. Valid targets will be highlighted. Press ESC to cancel.", "important");
                
                // Start targeting mode
                targetingSystem.startTargeting(spell, callback);
            },
            cast: (spell, target) => {
                // Use mana
                const mana = gameState.player.getComponent('ManaComponent');
                mana.useMana(spell.manaCost);
                
                // Calculate damage based on player intelligence
                const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
                const damage = spell.baseDamage + Math.floor(intelligence * 0.5);
                
                // Find entity at the target position
                const targetEntity = Array.from(gameState.entities.values()).find(e => {
                    if (e.hasComponent('PositionComponent')) {
                        const pos = e.getComponent('PositionComponent');
                        return pos.x === target.x && pos.y === target.y && e.hasComponent('HealthComponent');
                    }
                    return false;
                });
                
                // If no entity with health at target, the spell still casts but hits nothing
                if (!targetEntity) {
                    gameState.addMessage(`You cast ${spell.name} at the location, but hit nothing.`);
                    return;
                }
                
                // Check if targeting an NPC that's not hostile
                const isNPC = targetEntity.hasComponent('DialogueComponent');
                let proceedWithAttack = true;
                
                if (isNPC && targetEntity.hasComponent('AIComponent')) {
                    const ai = targetEntity.getComponent('AIComponent');
                    
                    // If NPC is in idle state (not hostile yet), ask for confirmation
                    if (ai.state === 'idle') {
                        // Ask for confirmation before attacking peaceful NPC
                        proceedWithAttack = window.confirm(`Do you want to attack ${targetEntity.name} with ${spell.name}? This might have serious consequences.`);
                        
                        if (!proceedWithAttack) {
                            // Player decided not to attack - spell is still cast, but misses
                            gameState.addMessage(`You redirect your ${spell.name} spell away from ${targetEntity.name} at the last moment.`);
                            return; // Spell is still cast and mana is used, but no damage
                        }
                        
                        // If confirmed, proceed with attack
                        gameState.addMessage(`You deliberately target ${targetEntity.name} with your ${spell.name}!`, 'danger');
                        
                        // Mark NPC as hostile now
                        ai.state = 'enraged';
                        ai.target = gameState.player;
                    }
                }
                
                if (proceedWithAttack) {
                    // Apply damage to the targeted entity
                    const targetHealth = targetEntity.getComponent('HealthComponent');
                    const isDead = targetHealth.takeDamage(damage);
                    
                    // Log the spell effect
                    gameState.addMessage(`You cast ${spell.name} and hit ${targetEntity.name} for ${damage} damage!`);
                    
                    // 50% chance to slow enemy (just visual for now)
                    if (Math.random() < 0.5) {
                        gameState.addMessage(`${targetEntity.name} is slowed by the frost!`);
                    }
                    
                    // Special handling for immortal entities like training dummies
                    if (targetHealth.immortal) {
                        gameState.addMessage(`${targetEntity.name} takes the hit but remains standing.`);
                        return;
                    }
                    
                    // Check if target died
                    if (isDead) {
                        gameState.addMessage(`${targetEntity.name} is frozen solid!`);
                        gameState.removeEntity(targetEntity.id);
                        
                        // Award XP if it was an enemy
                        if (targetEntity.hasComponent('AIComponent')) {
                            const targetStats = targetEntity.getComponent('StatsComponent');
                            if (targetStats) {
                                const playerStats = gameState.player.getComponent('StatsComponent');
                                const xpGained = targetStats.level * 10;
                                const didLevelUp = playerStats.addXp(xpGained);
                                
                                gameState.addMessage(`You gain ${xpGained} XP.`);
                                if (didLevelUp) {
                                    gameState.addMessage(`You advance to level ${playerStats.level}!`, 'important');
                                }
                                
                                gameState.score += xpGained;
                            }
                        } else {
                            // Show different message for non-enemies (like town NPCs)
                            gameState.addMessage(`You've killed ${targetEntity.name}! This may have consequences...`);
                        }
                    }
                }
            }
        });

        // Healing spell
        this.registerSpell('healing', {
            targetType: 'self',
            cast: (spell) => {
                // Heal the player
                const playerHealth = gameState.player.getComponent('HealthComponent');
                
                if (playerHealth.hp >= playerHealth.maxHp) {
                    gameState.addMessage("You're already at full health.");
                    return false; // Don't use mana if already at full health
                }
                
                // Use mana
                const mana = gameState.player.getComponent('ManaComponent');
                mana.useMana(spell.manaCost);
                
                // Calculate healing based on intelligence
                const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
                const healAmount = spell.baseDamage + Math.floor(intelligence * 0.5);
                
                // Apply healing
                playerHealth.heal(healAmount);
                
                gameState.addMessage(`You cast ${spell.name} and heal for ${healAmount} HP.`);
                return true;
            }
        });

        // Town Portal spell
        this.registerSpell('townportal', {
            targetType: 'self',
            cast: (spell) => {
                // Check if already in town
                if (gameState.location === 'town') {
                    gameState.addMessage("You're already in town.");
                    return false; // Don't use mana if already in town
                }
                
                // Use mana
                const mana = gameState.player.getComponent('ManaComponent');
                mana.useMana(spell.manaCost);
                
                gameState.addMessage(`You cast ${spell.name} and are teleported back to town!`, "important");
                
                // Return to town (using game's return to town method)
                eventBus.emit('returnToTown');
                return true;
            }
        });

        // Light spell
        this.registerSpell('light', {
            targetType: 'self',
            cast: (spell) => {
                // Use mana
                const mana = gameState.player.getComponent('ManaComponent');
                mana.useMana(spell.manaCost);
                
                // Increase visibility temporarily (this would need a lighting system implementation)
                gameState.addMessage(`You cast ${spell.name}, illuminating the area around you.`);
                
                // Example: temporarily double the FOV radius
                const fovSystem = gameState.getSystem('FOVSystem');
                if (fovSystem) {
                    const originalRadius = fovSystem.radius;
                    fovSystem.radius *= 2;
                    fovSystem.update();
                    
                    // Reset after 10 turns
                    setTimeout(() => {
                        fovSystem.radius = originalRadius;
                        fovSystem.update();
                        gameState.addMessage("The magical light fades.");
                    }, 10000); // 10 seconds
                }
                
                return true;
            }
        });

        // Frost Bolt spell (similar to Fire Bolt but with slowing effect)
        this.registerSpell('frostbolt', {
            targetType: 'entity',
            target: (spell, callback) => {
                gameState.addMessage("Choose a target for your Frost Bolt spell. Valid targets will be highlighted. Press ESC to cancel.", "important");
                
                // Start targeting mode
                targetingSystem.startTargeting(spell, callback);
            },
            cast: (spell, target) => {
                // Implementation similar to firebolt but with ice-themed effects
                const mana = gameState.player.getComponent('ManaComponent');
                mana.useMana(spell.manaCost);
                
                const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
                const damage = spell.baseDamage + Math.floor(intelligence * 0.4); // Slightly less damage than firebolt
                
                // Find target entity (code similar to firebolt)
                const targetEntity = Array.from(gameState.entities.values()).find(e => {
                    if (e.hasComponent('PositionComponent')) {
                        const pos = e.getComponent('PositionComponent');
                        return pos.x === target.x && pos.y === target.y && e.hasComponent('HealthComponent');
                    }
                    return false;
                });
                
                if (!targetEntity) {
                    gameState.addMessage(`You cast ${spell.name} at the location, but hit nothing.`);
                    return;
                }
                
                // NPC targeting logic similar to other combat spells
                const isNPC = targetEntity.hasComponent('DialogueComponent');
                let proceedWithAttack = true;
                
                if (isNPC && targetEntity.hasComponent('AIComponent')) {
                    const ai = targetEntity.getComponent('AIComponent');
                    if (ai.state === 'idle') {
                        proceedWithAttack = window.confirm(`Do you want to attack ${targetEntity.name} with ${spell.name}? This might have serious consequences.`);
                        
                        if (!proceedWithAttack) {
                            gameState.addMessage(`You redirect your ${spell.name} spell away from ${targetEntity.name} at the last moment.`);
                            return;
                        }
                        
                        gameState.addMessage(`You deliberately target ${targetEntity.name} with your ${spell.name}!`, 'danger');
                        ai.state = 'enraged';
                        ai.target = gameState.player;
                    }
                }
                
                if (proceedWithAttack) {
                    const targetHealth = targetEntity.getComponent('HealthComponent');
                    const isDead = targetHealth.takeDamage(damage);
                    
                    gameState.addMessage(`You cast ${spell.name} and hit ${targetEntity.name} for ${damage} damage!`);
                    
                    // 75% chance to slow enemy (higher than ice spear)
                    if (Math.random() < 0.75) {
                        gameState.addMessage(`${targetEntity.name} is slowed by the freezing cold!`);
                        // If we had a status effect system, we would apply a slow effect here
                    }
                    
                    // Special handling for immortal entities like training dummies
                    if (targetHealth.immortal) {
                        gameState.addMessage(`${targetEntity.name} takes the hit but remains standing.`);
                        return;
                    }
                    
                    if (isDead) {
                        gameState.addMessage(`${targetEntity.name} freezes and shatters!`);
                        gameState.removeEntity(targetEntity.id);
                        
                        // Award XP (same as other combat spells)
                        if (targetEntity.hasComponent('AIComponent')) {
                            const targetStats = targetEntity.getComponent('StatsComponent');
                            if (targetStats) {
                                const playerStats = gameState.player.getComponent('StatsComponent');
                                const xpGained = targetStats.level * 10;
                                const didLevelUp = playerStats.addXp(xpGained);
                                
                                gameState.addMessage(`You gain ${xpGained} XP.`);
                                if (didLevelUp) {
                                    gameState.addMessage(`You advance to level ${playerStats.level}!`, 'important');
                                }
                                
                                gameState.score += xpGained;
                            }
                        } else {
                            gameState.addMessage(`You've killed ${targetEntity.name}! This may have consequences...`);
                        }
                    }
                }
            }
        });

        // Nature spell (healing + temporary defense boost)
        this.registerSpell('nature', {
            targetType: 'self',
            cast: (spell) => {
                // Use mana
                const mana = gameState.player.getComponent('ManaComponent');
                mana.useMana(spell.manaCost);
                
                // Get player components
                const playerHealth = gameState.player.getComponent('HealthComponent');
                const playerStats = gameState.player.getComponent('StatsComponent');
                
                // Calculate effects based on intelligence
                const intelligence = playerStats.intelligence;
                const healAmount = 5 + Math.floor(intelligence * 0.3);
                
                // Apply healing
                playerHealth.heal(healAmount);
                
                // Apply temporary defense boost
                const defenseBoost = 2;
                const originalDefense = playerStats.defense;
                playerStats.defense += defenseBoost;
                
                gameState.addMessage(`You cast ${spell.name} and heal for ${healAmount} HP. You feel more resilient!`);
                
                // Reset defense after 20 turns
                setTimeout(() => {
                    playerStats.defense = originalDefense;
                    gameState.addMessage("The protective effect of Nature's Blessing fades.");
                }, 20000); // 20 seconds
                
                return true;
            }
        });

        // Generic summon spell handler
        this.registerSpell('summon', {
            targetType: 'location',
            target: (spell, callback) => {
                gameState.addMessage(`Choose a location to summon your ${spell.spellName}. Press ESC to cancel.`, "important");
                
                // Start targeting mode
                targetingSystem.startTargeting(spell, callback);
            },
            cast: (spell, target) => {
                try {
                    // Use mana
                    const mana = gameState.player.getComponent('ManaComponent');
                    if (!mana.useMana(spell.manaCost)) {
                        gameState.addMessage(`You don't have enough mana to cast ${spell.spellName}.`);
                        return false;
                    }
                    
                    // For debugging
                    console.log("Summon spell data:", spell);
                    
                    // Check if we have the summonData field in the spell
                    if (!spell.summonData || !spell.summonData.creatureType) {
                        console.error("Missing summonData.creatureType in spell:", spell);
                        gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                        return false;
                    }
                    
                    // Check if target is valid
                    if (!target || target.x === undefined || target.y === undefined) {
                        console.error("Invalid target for summon spell:", target);
                        gameState.addMessage(`The spell fizzles - invalid target location.`);
                        return false;
                    }
                    
                    // Get a reference to EntityFactory
                    const entityFactory = new EntityFactory();
                    
                    // Initialize with the current game data
                    if (this.gameData.monsters) {
                        entityFactory.initialize({
                            monsters: this.gameData.monsters
                        });
                    } else {
                        console.error("Missing monster data in gameState!");
                        gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                        return false;
                    }
                    
                    // Create the summoned entity using the factory's method
                    const summonedEntity = entityFactory.createSummonedEntity(
                        spell.summonData.creatureType,
                        target.x,
                        target.y,
                        gameState.player,
                        spell.summonData
                    );
                    
                    if (!summonedEntity) {
                        console.error(`Failed to create summoned entity of type ${spell.summonData.creatureType}`);
                        gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                        return false;
                    }
                    
                    // Add to game entities
                    gameState.addEntity(summonedEntity);
                    
                    // Display message
                    gameState.addMessage(`You cast ${spell.spellName} and summon a ${summonedEntity.name}!`, "important");
                    
                    // Set up event listener to check when summon expires
                    const checkSummonExpiration = () => {
                        // If entity no longer exists in game, remove the listener
                        if (!gameState.entities.has(summonedEntity.id)) {
                            eventBus.off('turnProcessed', checkSummonExpiration);
                            return;
                        }
                        
                        // Check if the summon has expired
                        const summonedBy = summonedEntity.getComponent('SummonedByComponent');
                        if (summonedBy && summonedBy.isExpired) {
                            gameState.addMessage(`Your summoned ${summonedEntity.name} fades away.`);
                            gameState.removeEntity(summonedEntity.id);
                            eventBus.off('turnProcessed', checkSummonExpiration);
                        }
                    };
                    
                    // Register the check to run each turn
                    eventBus.on('turnProcessed', checkSummonExpiration);
                    
                    return true;
                } catch (error) {
                    console.error("Error in summon spell:", error);
                    gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                    return false;
                }
            }
        });
        
        // Summon Hydra spell - use generic summoning system with stationary fire-breathing behavior
        this.registerSpell('summonhydra', {
            targetType: 'location',
            target: (spell, callback) => {
                gameState.addMessage(`Choose a location to summon your Hydra. Press ESC to cancel.`, "important");
                
                // Start targeting mode
                targetingSystem.startTargeting(spell, callback);
            },
            cast: (spell, target) => {
                try {
                    console.log("Original spell data:", spell);
                    
                    // Add summonData if it doesn't exist
                    if (!spell.summonData) {
                        console.log("Adding missing summonData to spell");
                        spell.summonData = {
                            creatureType: "hydra",
                            name: "Summoned Hydra",
                            duration: spell.duration || 30,
                            isStationary: true,
                            attackRange: 6,
                            attackElement: "fire",
                            intelligenceScaling: {
                                hp: 0.8,
                                strength: 0.4,
                                defense: 0.2,
                                intelligence: 0.5
                            }
                        };
                    } else {
                        // Ensure the hydra is stationary
                        spell.summonData.isStationary = true;
                    }
                    
                    // Provide info to player about the hydra's behavior
                    gameState.addMessage("You begin the summoning ritual for a Hydra...", "important");
                    
                    // Use the generic summon spell handler with this specific spell data
                    const success = this.castSpell('summon', spell, target);
                    
                    if (success) {
                        gameState.addMessage("The Hydra will remain in place and attack enemies with fire breath.", "info");
                    }
                    
                    return success;
                } catch (error) {
                    console.error("Error in summonhydra spell:", error);
                    gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                    return false;
                }
            }
        });
    }

    /**
     * Determine if a spell exists in the registry
     * @param {string} spellId - The spell ID to check
     * @returns {boolean} True if the spell exists
     */
    hasSpell(spellId) {
        return this.spellEffects.has(spellId);
    }
    
    /**
     * Get the implementation for a spell
     * @param {string} spellId - The spell ID to get
     * @returns {object|null} The spell implementation or null if not found
     */
    getSpellImplementation(spellId) {
        return this.spellEffects.get(spellId) || null;
    }

    /**
     * Cast a spell
     * @param {string} spellId - ID of the spell to cast
     * @param {object} spell - The spell data object
     * @param {object} target - Optional target information
     * @returns {boolean} True if the spell was cast successfully
     */
    castSpell(spellId, spell, target = null) {
        if (!this.hasSpell(spellId)) {
            console.error(`No implementation found for spell: ${spellId}`);
            return false;
        }

        const implementation = this.spellEffects.get(spellId);

        // Check if this spell needs a target
        if (implementation.targetType === 'entity' && !target) {
            // Start targeting mode if we have a targeting method
            if (implementation.target) {
                implementation.target(spell, (selectedTarget) => {
                    // Once target is selected, cast the spell with that target
                    implementation.cast(spell, selectedTarget);
                });
                return true; // Return true as we've started the targeting process
            }
            return false; // No targeting method available
        }

        // Cast the spell directly for self-targeting spells
        return implementation.cast(spell, target);
    }
}

// Create and export a singleton instance
const spellLogic = new SpellLogic();
export default spellLogic;