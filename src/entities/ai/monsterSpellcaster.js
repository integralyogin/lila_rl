// monsterSpellcaster.js - Responsible for letting monsters cast real spells
import gameState from '../../core/gameState.js';

// Helper for handling monster spellcasting with real spell logic
const monsterSpellcaster = {
    // Update monster AI to use real spells
    setupMonsterForRealSpells: function(monster) {
        if (!monster) return;
        
        // Get the AI component
        const aiComp = monster.getComponent('AIComponent');
        if (!aiComp) return;
        
        // Set a flag to indicate this monster can use real spells
        aiComp.useRealSpells = true;
        
        // Add a spell priorities object if it doesn't exist
        if (!aiComp.spellPriorities) {
            aiComp.spellPriorities = {};
        }
        
        // Read AI data from the JSON template
        const template = this.getMonsterTemplate(monster.id);
        if (template && template.ai && template.ai.spellPriorities) {
            aiComp.spellPriorities = template.ai.spellPriorities;
        }
        
        // Configure default spell priorities based on monster type
        if (monster.name === 'Fire Mage' && !aiComp.spellPriorities.fireball) {
            aiComp.spellPriorities.fireball = { priority: 1, cooldown: 3 };
        }
        
        console.log(`[AI] Set up monster ${monster.name} for real spells. Priorities:`, aiComp.spellPriorities);
    },
    
    // Get a monster template from monster data
    getMonsterTemplate: function(monsterId) {
        if (!gameState.monsterTemplates || !monsterId) return null;
        
        // Find the monster template
        return gameState.monsterTemplates.find(m => m.id === monsterId);
    },
    // Cast a spell using the real spell logic system
    castRealSpell: function(entity, context) {
        if (!gameState.spellLogic || !context.spellId) return { success: false };
        
        // Get components
        const stats = entity.getComponent('StatsComponent');
        const manaComp = entity.getComponent('ManaComponent');
        const casterPos = entity.getComponent('PositionComponent');
        
        if (!stats || !manaComp || !casterPos) return { success: false };
        
        // Create a spell object to pass to the spell logic system
        const spellObj = {
            spellId: context.spellId,
            manaCost: 0, // Will be determined by the spell system
            caster: entity,
            casterStats: stats,
            casterPos: casterPos,
            isMonsterCast: true // Flag to indicate this is cast by a monster, not the player
        };
        
        // Get the target position if we have a target
        let targetPosComp = null;
        if (context.target) {
            targetPosComp = context.target.getComponent('PositionComponent');
            if (!targetPosComp) return { success: false };
        }
        
        // Check the spell type to determine how to provide the target
        const spellImpl = gameState.spellLogic.getSpellImplementation(context.spellId);
        if (!spellImpl) {
            console.error(`[AI] No implementation found for spell: ${context.spellId}`);
            return { success: false };
        }
        
        // Different spells need different kinds of targets
        let target = null;
        
        if (spellImpl.targetType === 'entity') {
            // Entity-targeted spells need the target entity
            if (!context.target) return { success: false };
            target = context.target;
        } 
        else if (spellImpl.targetType === 'location') {
            // Location-targeted spells need a position
            if (context.spellId === 'fireball') {
                // For fireball, we want to target the player's position
                if (gameState.player && gameState.player.position) {
                    target = {
                        x: gameState.player.position.x,
                        y: gameState.player.position.y
                    };
                } else if (targetPosComp) {
                    target = { x: targetPosComp.x, y: targetPosComp.y };
                } else {
                    return { success: false };
                }
            } else if (targetPosComp) {
                // Use the target's position for location-based spells
                target = { x: targetPosComp.x, y: targetPosComp.y };
            } else {
                return { success: false };
            }
        }
        
        // Ensure we have a target if needed
        if ((spellImpl.targetType === 'entity' || spellImpl.targetType === 'location') && !target) {
            return { success: false };
        }
        
        // Prepare a modified spell object with monster-specific info
        // This is important because many spell implementations assume they're being cast by the player
        // We need to add the monster's stats and position
        const monsterSpell = {
            ...spellObj,
            // Include standard spell info that the player spells expect
            baseDamage: spellImpl.baseDamage || 10,
            manaCost: spellImpl.manaCost || 5,
            range: spellImpl.range || 6,
            aoeRadius: spellImpl.aoeRadius || 2,
            element: spellImpl.element || 'fire',
            name: spellImpl.name || context.spellId
        };
        
        // Check if we have enough mana
        const manaCost = spellImpl ? (spellImpl.manaCost || 12) : (monsterSpell.manaCost || 12);
        
        // Debug mana levels for Fire Mage
        if (entity.type === 'fire_mage') {
            console.log(`[Spellcaster] Fire Mage mana check: ${manaComp.mana}/${manaComp.maxMana}, needs ${manaCost}`);
        }
        
        // Special case for Fire Mage - give it more mana if needed
        if (entity.type === 'fire_mage' && manaComp.mana < manaCost) {
            console.log(`[Spellcaster] Fire Mage has insufficient mana (${manaComp.mana}). Refilling!`);
            manaComp.mana = Math.max(manaComp.mana, manaCost + 10);
            manaComp.maxMana = Math.max(manaComp.maxMana, 90);
        }
        
        // Standard check
        if (manaComp.mana < manaCost) {
            gameState.addMessage(`${entity.name} tries to cast ${context.spellId} but lacks sufficient mana!`);
            return { success: false, reason: 'insufficientMana' };
        }
        
        // Consume mana before casting
        manaComp.mana -= manaCost;
        
        // Special fireball handling
        if (context.spellId === 'fireball') {
            console.log(`[AI] ${entity.name} casting fireball at position (${target.x}, ${target.y})`);
            
            // Create custom fireball implementation for monsters
            // Create visual effects
            const renderSystem = gameState.renderSystem;
            
            // Create bolt effect
            renderSystem.createSpellEffect('bolt', 'fire', {
                sourceX: casterPos.x,
                sourceY: casterPos.y,
                targetX: target.x,
                targetY: target.y,
                duration: 600
            });
            
            // Create explosion effects with delay
            setTimeout(() => {
                // Impact at target location
                renderSystem.createSpellEffect('impact', 'fire', {
                    x: target.x,
                    y: target.y,
                    radius: monsterSpell.aoeRadius,
                    duration: 800
                });
                
                // Wave effect for explosion
                renderSystem.createSpellEffect('wave', 'fire', {
                    x: target.x,
                    y: target.y,
                    radius: monsterSpell.aoeRadius + 0.5,
                    duration: 700
                });
            }, 550);
            
            // Calculate damage based on monster intelligence
            const intelligence = stats.intelligence;
            const damage = monsterSpell.baseDamage + Math.floor(intelligence * 0.6);
            
            gameState.addMessage(`${entity.name} casts Fireball, hurling a ball of fire that explodes!`);
            
            // Apply damage to entities in radius
            const entities = gameState.getEntitiesWithComponents('HealthComponent', 'PositionComponent');
            let hitCount = 0;
            
            // Apply damage to all entities in range
            for (const targetEntity of entities) {
                // Skip the caster
                if (targetEntity === entity) continue;
                
                const targetEntityPos = targetEntity.getComponent('PositionComponent');
                const dx = Math.abs(targetEntityPos.x - target.x);
                const dy = Math.abs(targetEntityPos.y - target.y);
                
                // If entity is within radius (using chess board distance)
                if (dx <= monsterSpell.aoeRadius && dy <= monsterSpell.aoeRadius) {
                    // Apply damage
                    const health = targetEntity.getComponent('HealthComponent');
                    const isDead = health.takeDamage(damage);
                    hitCount++;
                    
                    // Create impact effects at each hit entity
                    setTimeout(() => {
                        renderSystem.createSpellEffect('impact', 'fire', {
                            x: targetEntityPos.x,
                            y: targetEntityPos.y,
                            duration: 500
                        });
                    }, 650);
                    
                    // Skip special handling for immortal entities
                    if (health.immortal) continue;
                    
                    // Handle death
                    if (isDead) {
                        gameState.addMessage(`${targetEntity.name} is incinerated by the blast!`);
                        
                        // If target is not the player, remove it
                        if (targetEntity !== gameState.player && !context.inArenaCombat) {
                            gameState.removeEntity(targetEntity.id);
                        }
                    } else {
                        gameState.addMessage(`${targetEntity.name} takes ${damage} damage from the fire blast!`);
                    }
                }
            }
            
            // Result message
            if (hitCount === 0) {
                gameState.addMessage("The fireball explodes but hits nothing.");
            } else {
                gameState.addMessage(`The fireball hits ${hitCount} ${hitCount === 1 ? 'target' : 'targets'}!`);
            }
            
            return { 
                success: true, 
                spellId: context.spellId,
                hitCount: hitCount
            };
        }
        
        // For other spells, try to use the standard spell logic system
        try {
            // Log additional faction and behavior data for debugging
            const ai = entity.getComponent('AIComponent');
            const faction = ai ? ai.faction : 'unknown';
            const behavior = ai ? ai.behaviorType : 'unknown';
            
            console.log(`[AI] ${entity.name} (${faction}/${behavior}) trying to cast ${context.spellId} using spell logic system`);
            
            // Get the implementation again to be safe
            const spellImpl = gameState.spellLogic.getSpellImplementation(context.spellId);
            
            // Check if the spell has a cast method
            if (spellImpl && typeof spellImpl.cast === 'function') {
                // We need to modify the usual spell cast flow since it's designed for the player
                // Many spell implementations have assumptions about the caster being the player
                
                // For bolt spells we need special handling
                if (context.spellId === 'firebolt' || context.spellId === 'frostbolt' || context.spellId === 'icespear') {
                    gameState.addMessage(`${entity.name} casts ${monsterSpell.name}!`);
                    
                    // Create visual effects
                    if (gameState.renderSystem && casterPos && targetPosComp) {
                        // Create bolt effect
                        gameState.renderSystem.createSpellEffect('bolt', monsterSpell.element, {
                            sourceX: casterPos.x,
                            sourceY: casterPos.y,
                            targetX: targetPosComp.x,
                            targetY: targetPosComp.y,
                            duration: 600
                        });
                        
                        // Create impact effect with delay
                        setTimeout(() => {
                            gameState.renderSystem.createSpellEffect('impact', monsterSpell.element, {
                                x: targetPosComp.x,
                                y: targetPosComp.y,
                                duration: 600
                            });
                        }, 500);
                    }
                    
                    // Calculate damage
                    const intelligence = stats.intelligence;
                    const damage = monsterSpell.baseDamage + Math.floor(intelligence * 0.6);
                    
                    // Apply damage to target
                    const targetHealth = context.target.getComponent('HealthComponent');
                    if (targetHealth) {
                        const isDead = targetHealth.takeDamage(damage);
                        
                        // Show damage message
                        gameState.addMessage(`${context.target.name} takes ${damage} damage!`);
                        
                        // Handle death
                        if (isDead) {
                            if (monsterSpell.element === 'fire') {
                                gameState.addMessage(`${context.target.name} is incinerated by the blast!`);
                            } else if (monsterSpell.element === 'ice') {
                                gameState.addMessage(`${context.target.name} is frozen solid!`);
                            } else {
                                gameState.addMessage(`${context.target.name} is killed!`);
                            }
                            
                            // If target is not the player, remove it
                            if (context.target !== gameState.player && !context.inArenaCombat) {
                                gameState.removeEntity(context.target.id);
                            }
                        }
                        
                        return { 
                            success: true, 
                            damage: damage,
                            isDead: isDead,
                            spellId: context.spellId
                        };
                    }
                }
                
                // For other spells that we can't easily adapt, try to use the spell logic system directly
                // This may or may not work depending on the spell implementation
                const result = spellImpl.cast.call(gameState.spellLogic, monsterSpell, target);
                return { 
                    success: !!result,
                    spellId: context.spellId 
                };
            }
        } catch (error) {
            console.error(`[AI] Error casting spell ${context.spellId} with spell logic:`, error);
        }
        
        // If we got here, casting failed
        return { success: false };
    }
};

export default monsterSpellcaster;