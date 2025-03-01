import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';

/**
 * Register aura-based spells
 * @param {object} spellLogic - The spell logic system
 */
export function registerAuraSpells(spellLogic) {
    // Listen for map transitions and reapply active auras
    eventBus.on('mapChanged', () => {
        if (gameState.player && gameState.player.activeAuras) {
            reapplyActiveAuras(spellLogic);
        }
    });

    // Add listener for game initialization to set up player aura tracking
    eventBus.on('gameInitialized', () => {
        if (gameState.player && !gameState.player.activeAuras) {
            gameState.player.activeAuras = [];
        }
    });

    // Generic aura spell handler
    spellLogic.registerSpell('aura', createAuraSpell());
    
    // Map specific aura spells to the generic aura handler
    const auraSpells = ['flameaura', 'frostaura'];
    auraSpells.forEach(spellId => {
        spellLogic.registerSpell(spellId, {
            targetType: 'self',
            cast: function(spell) {
                // Use the generic aura spell handler with this specific spell data
                return spellLogic.castSpell('aura', spell);
            }
        });
    });
    
    // Frost Wave spell - a circular expanding wave of ice
    spellLogic.registerSpell('frostwave', {
        targetType: 'self',
        cast: function(spell) {
            // Use mana
            const mana = gameState.player.getComponent('ManaComponent');
            if (!mana.useMana(spell.manaCost)) {
                gameState.addMessage(`You don't have enough mana to cast ${spell.spellName}.`);
                return false;
            }
            
            // Calculate damage based on player intelligence
            const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
            const damage = spell.baseDamage + Math.floor(intelligence * 0.4);
            
            gameState.addMessage(`You cast ${spell.spellName}, sending a wave of freezing energy in all directions!`, "important");
            
            // Create wave visual effect
            const renderSystem = gameState.renderSystem;
            renderSystem.createSpellEffect('wave', 'ice', {
                x: gameState.player.position.x,
                y: gameState.player.position.y,
                radius: spell.aoeRadius + 0.5,
                duration: 1500
            });
            
            // Apply damage to entities in range
            const playerX = gameState.player.position.x;
            const playerY = gameState.player.position.y;
            const entities = gameState.getEntitiesWithComponents('HealthComponent', 'PositionComponent');
            let affectedCount = 0;
            
            for (const entity of entities) {
                // Skip player
                if (entity === gameState.player) continue;
                
                const entityPos = entity.getComponent('PositionComponent');
                const dx = Math.abs(entityPos.x - playerX);
                const dy = Math.abs(entityPos.y - playerY);
                
                // If entity is within wave radius
                if (dx <= spell.aoeRadius && dy <= spell.aoeRadius) {
                    // Apply damage
                    const health = entity.getComponent('HealthComponent');
                    const isDead = health.takeDamage(damage);
                    affectedCount++;
                    
                    // Create impact effect
                    setTimeout(() => {
                        renderSystem.createSpellEffect('impact', 'ice', {
                            x: entityPos.x,
                            y: entityPos.y,
                            duration: 600
                        });
                    }, 400 + (Math.random() * 200));
                    
                    // Apply slow effect
                    if (Math.random() < 0.8) {
                        gameState.addMessage(`${entity.name} is slowed by the freezing wave!`);
                    }
                    
                    // Handle death
                    if (isDead && !health.immortal) {
                        spellLogic.handleEntityDeath(entity, `${entity.name} is frozen solid!`);
                    }
                }
            }
            
            // Result message
            if (affectedCount === 0) {
                gameState.addMessage("The frost wave expands outward, but hits nothing.");
            } else {
                gameState.addMessage(`The frost wave hits ${affectedCount} ${affectedCount === 1 ? 'enemy' : 'enemies'}!`);
            }
            
            return true;
        }
    });
}

/**
 * Create the aura spell implementation
 */
export function createAuraSpell() {
    return {
        targetType: 'self',
        cast: function(spell) {
            // Use mana for initial cast
            const mana = gameState.player.getComponent('ManaComponent');
            if (!mana.useMana(spell.manaCost)) {
                gameState.addMessage(`You don't have enough mana to cast ${spell.spellName}.`);
                return false;
            }
            
            // Calculate damage based on player intelligence
            const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
            const baseDamage = spell.baseDamage ? (spell.baseDamage + Math.floor(intelligence * 0.3)) : 0;
            
            // Get aura configuration
            const element = spell.element || 'neutral';
            const duration = spell.duration || 5;
            const aoeRadius = spell.aoeRadius || 1;
            const turnCost = spell.turnCost || 1;
            const effects = spell.effects || [];
            
            // Set up element-specific messages
            const messages = getAuraMessages(element);
            
            // Display initial cast message
            gameState.addMessage(messages.cast, "important");
            
            // Create visual effect for the aura
            const renderSystem = gameState.renderSystem;
            const persistentAura = renderSystem.createSpellEffect('persistent-aura', element, {
                x: gameState.player.position.x,
                y: gameState.player.position.y,
                radius: aoeRadius + 0.5,
                duration: duration * 1000
            });
            
            // Store current turn to track duration
            const startTurn = gameState.turn;
            
            // Store aura data on player for persistence across map changes
            if (!gameState.player.activeAuras) {
                gameState.player.activeAuras = [];
            }
            
            // Create aura data object for persistence
            const auraData = {
                spellId: spell.id,
                spell: { ...spell },
                element,
                startTurn,
                duration,
                aoeRadius,
                turnCost,
                effects,
                baseDamage,
                messages,
                visualEffect: persistentAura
            };
            
            // Add to active auras
            gameState.player.activeAuras.push(auraData);
            
            // Set up the aura effect function
            const auraEffect = () => {
                // Check if player still exists
                if (!gameState.player) {
                    eventBus.off('turnProcessed', auraEffect);
                    return;
                }
                
                // Check if spell has expired
                if (gameState.turn > startTurn + duration) {
                    eventBus.off('turnProcessed', auraEffect);
                    gameState.addMessage(messages.expire, "info");
                    this.removeAuraVisualEffect(persistentAura, "duration expiry");
                    auraData.visualEffect = null;
                    
                    // Remove from player's active auras
                    removeActiveAura(auraData);
                    return;
                }
                
                // Use mana per turn to maintain the aura
                if (!mana.useMana(turnCost)) {
                    eventBus.off('turnProcessed', auraEffect);
                    gameState.addMessage(messages.noMana, "info");
                    this.removeAuraVisualEffect(persistentAura, "mana depletion");
                    auraData.visualEffect = null;
                    
                    // Remove from player's active auras
                    removeActiveAura(auraData);
                    return;
                }
                
                // Count remaining turns
                const remainingTurns = (startTurn + duration) - gameState.turn;
                
                // Track if we affected any entities this turn
                let affectedEntities = false;
                
                // Process aura damage if this is a damaging aura
                if (baseDamage > 0 && effects.includes('damage')) {
                    processAuraDamage.call(this, spell, baseDamage, aoeRadius, element, messages);
                    affectedEntities = true;
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
                        }, duration * 1000);
                    }
                }
                
                // If we didn't affect any entities this turn, show a generic message
                if (!affectedEntities) {
                    gameState.addMessage(`${messages.tick} (${remainingTurns} turns remaining)`);
                }
            };
            
            // Store aura effect function reference for cleanup
            auraData.auraEffect = auraEffect;
            
            // Register the aura effect to run each turn
            eventBus.on('turnProcessed', auraEffect);
            
            // Also trigger the aura effect immediately for the first turn
            setTimeout(() => {
                auraEffect();
            }, 100);
            
            return true;
        }
    };
}

/**
 * Process damage for an aura spell
 */
function processAuraDamage(spell, baseDamage, aoeRadius, element, messages) {
    // Get entities around player
    const playerX = gameState.player.position.x;
    const playerY = gameState.player.position.y;
    
    // Get entities from gameState
    let entities = [];
    if (gameState.entities instanceof Map) {
        entities = Array.from(gameState.entities.values()).filter(entity => 
            entity && 
            entity !== gameState.player && 
            entity.getComponent && 
            entity.getComponent('HealthComponent') && 
            entity.getComponent('PositionComponent')
        );
    } else {
        entities = gameState.getEntitiesWithComponents('HealthComponent', 'PositionComponent');
    }
    
    // Check each entity
    for (const entity of entities) {
        // Skip the player
        if (entity === gameState.player) continue;
        
        const entityPos = entity.getComponent('PositionComponent');
        if (!entityPos) continue;
        
        // Extra verification of position component
        if (typeof entityPos.x !== 'number' || typeof entityPos.y !== 'number') continue;
        
        const dx = Math.abs(entityPos.x - playerX);
        const dy = Math.abs(entityPos.y - playerY);
        const distance = Math.max(dx, dy);
        
        // If entity is within aura radius
        if (distance <= aoeRadius) {
            // Check if entity has health component
            const health = entity.getComponent('HealthComponent');
            if (health) {
                // Apply damage
                const isDead = health.takeDamage(baseDamage);
                
                // Create visual effect for the damage
                const renderSystem = gameState.renderSystem;
                renderSystem.createSpellEffect('impact', element, {
                    x: entityPos.x,
                    y: entityPos.y,
                    duration: 600
                });
                
                // Log the damage
                const customDamageMessage = messages.damage
                    .replace('{target}', entity.name)
                    .replace('{damage}', baseDamage);
                gameState.addMessage(customDamageMessage);
                
                // Special handling for immortal entities
                if (health.immortal) {
                    gameState.addMessage(`${entity.name} takes the hit but remains standing.`);
                    continue;
                }
                
                // Handle entity death
                if (isDead) {
                    const customDeathMessage = messages.death.replace('{target}', entity.name);
                    this.handleEntityDeath(entity, customDeathMessage);
                }
            }
        }
    }
}

/**
 * Removes an aura from the player's active auras list
 * @param {object} auraData - The aura data to remove
 */
function removeActiveAura(auraData) {
    if (!gameState.player || !gameState.player.activeAuras) return;
    
    const index = gameState.player.activeAuras.findIndex(aura => 
        aura.spellId === auraData.spellId && 
        aura.startTurn === auraData.startTurn
    );
    
    if (index !== -1) {
        gameState.player.activeAuras.splice(index, 1);
    }
}

/**
 * Reapplies all active auras after a map change
 * @param {object} spellLogic - The spell logic system
 */
function reapplyActiveAuras(spellLogic) {
    if (!gameState.player || !gameState.player.activeAuras || !gameState.player.activeAuras.length) return;
    
    console.log(`Reapplying ${gameState.player.activeAuras.length} active auras after map change`);
    
    // First, clean up all existing event listeners to prevent duplicates
    gameState.player.activeAuras.forEach(auraData => {
        if (auraData.auraEffect) {
            eventBus.off('turnProcessed', auraData.auraEffect);
            auraData.auraEffect = null;
        }
        
        // If there's a visual effect reference from previous map, remove it
        if (auraData.visualEffect) {
            spellLogic.removeAuraVisualEffect(auraData.visualEffect, "map change");
            auraData.visualEffect = null;
        }
    });
    
    // Now reapply each aura with fresh event listeners and visuals
    gameState.player.activeAuras.forEach(auraData => {
        // Create new visual effect for the aura
        const renderSystem = gameState.renderSystem;
        const persistentAura = renderSystem.createSpellEffect('persistent-aura', auraData.element, {
            x: gameState.player.position.x,
            y: gameState.player.position.y,
            radius: auraData.aoeRadius + 0.5,
            duration: auraData.duration * 1000
        });
        
        // Store visual effect reference for cleanup
        auraData.visualEffect = persistentAura;
        
        // Get mana component
        const mana = gameState.player.getComponent('ManaComponent');
        if (!mana) return;
        
        // Create new aura effect function
        const auraEffect = () => {
            // Check if player still exists
            if (!gameState.player) {
                eventBus.off('turnProcessed', auraEffect);
                return;
            }
            
            // Check if spell has expired
            if (gameState.turn > auraData.startTurn + auraData.duration) {
                eventBus.off('turnProcessed', auraEffect);
                gameState.addMessage(auraData.messages.expire, "info");
                spellLogic.removeAuraVisualEffect(persistentAura, "duration expiry");
                
                // Remove from player's active auras
                removeActiveAura(auraData);
                return;
            }
            
            // Use mana per turn to maintain the aura
            if (!mana.useMana(auraData.turnCost)) {
                eventBus.off('turnProcessed', auraEffect);
                gameState.addMessage(auraData.messages.noMana, "info");
                spellLogic.removeAuraVisualEffect(persistentAura, "mana depletion");
                
                // Remove from player's active auras
                removeActiveAura(auraData);
                return;
            }
            
            // Count remaining turns
            const remainingTurns = (auraData.startTurn + auraData.duration) - gameState.turn;
            
            // Track if we affected any entities this turn
            let affectedEntities = false;
            
            // Process aura damage if this is a damaging aura
            if (auraData.baseDamage > 0 && auraData.effects.includes('damage')) {
                processAuraDamage.call(spellLogic, auraData.spell, auraData.baseDamage, 
                    auraData.aoeRadius, auraData.element, auraData.messages);
                affectedEntities = true;
            }
            
            // Handle healing effects
            if (auraData.effects.includes('heal') && !affectedEntities) {
                const healAmount = Math.floor(auraData.baseDamage * 0.5) || 1;
                const playerHealth = gameState.player.getComponent('HealthComponent');
                
                if (playerHealth && playerHealth.hp < playerHealth.maxHp) {
                    playerHealth.heal(healAmount);
                    gameState.addMessage(`Your aura restores ${healAmount} health.`);
                    affectedEntities = true;
                }
            }
            
            // If we didn't affect any entities this turn, show a generic message
            if (!affectedEntities) {
                gameState.addMessage(`${auraData.messages.tick} (${remainingTurns} turns remaining)`);
            }
        };
        
        // Store new aura effect function reference for cleanup
        auraData.auraEffect = auraEffect;
        
        // Register the aura effect to run each turn
        eventBus.on('turnProcessed', auraEffect);
        
        // Also trigger the aura effect immediately
        setTimeout(() => {
            auraEffect();
        }, 100);
    });
}

/**
 * Get element-specific aura messages
 */
function getAuraMessages(element) {
    // Default messages
    let messages = {
        cast: `You surround yourself with a magical aura!`,
        tick: `Your aura pulses with energy.`,
        expire: `Your aura dissipates.`,
        noMana: `Your aura dissipates as you run out of mana.`,
        damage: `Your aura damages {target} for {damage}!`,
        death: `{target} is destroyed by your aura!`
    };
    
    // Element-specific messages
    const elementMessages = {
        fire: {
            cast: `You surround yourself with a blazing aura of fire!`,
            tick: `Your flame aura burns brightly.`,
            expire: `Your flame aura dissipates.`,
            noMana: `Your flame aura dissipates as you run out of mana.`,
            damage: `Your flame aura burns {target} for {damage} damage!`,
            death: `{target} is incinerated by your flame aura!`
        },
        ice: {
            cast: `You surround yourself with a freezing aura of ice!`,
            tick: `Your frost aura shimmmers coldly.`,
            expire: `Your frost aura melts away.`,
            noMana: `Your frost aura melts away as you run out of mana.`,
            damage: `Your frost aura freezes {target} for {damage} damage!`,
            death: `{target} is frozen solid by your frost aura!`
        },
        lightning: {
            cast: `Crackling electricity surrounds you in an aura of lightning!`,
            tick: `Your lightning aura crackles with energy.`,
            expire: `Your lightning aura fades away.`,
            noMana: `Your lightning aura shorts out as you run out of mana.`,
            damage: `Your lightning aura shocks {target} for {damage} damage!`,
            death: `{target} is electrocuted by your lightning aura!`
        },
        nature: {
            cast: `You surround yourself with a swirling aura of natural energy!`,
            tick: `Your nature aura pulses with life.`,
            expire: `Your nature aura returns to the earth.`,
            noMana: `Your nature aura withers as you run out of mana.`,
            damage: `Your nature aura lashes {target} for {damage} damage!`,
            death: `{target} is overwhelmed by your nature aura!`
        },
        radiant: {
            cast: `You surround yourself with a brilliant aura of holy light!`,
            tick: `Your radiant aura shines brightly.`,
            expire: `Your radiant aura fades away.`,
            noMana: `Your radiant aura dims as you run out of mana.`,
            damage: `Your radiant aura smites {target} for {damage} damage!`,
            death: `{target} is banished by your radiant aura!`
        },
        arcane: {
            cast: `You surround yourself with a shimmering aura of arcane energy!`,
            tick: `Your arcane aura hums with power.`,
            expire: `Your arcane aura dissipates.`,
            noMana: `Your arcane aura unravels as you run out of mana.`,
            damage: `Your arcane aura disrupts {target} for {damage} damage!`,
            death: `{target} is torn apart by your arcane aura!`
        }
    };
    
    // Return element-specific messages or defaults
    return elementMessages[element] || messages;
}