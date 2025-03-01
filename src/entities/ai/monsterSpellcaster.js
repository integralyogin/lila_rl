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
        
        console.log(`[MonsterSpellcaster] Setup ${monster.name} to use REAL spells. This will override any fallback spell implementations.`);
        
        // Add a spell priorities object if it doesn't exist
        if (!aiComp.spellPriorities) {
            aiComp.spellPriorities = {};
        }
        
        // Read AI data from the JSON template
        const template = this.getMonsterTemplate(monster.id);
        if (template && template.ai && template.ai.spellPriorities) {
            aiComp.spellPriorities = template.ai.spellPriorities;
        }
        
        // Get the known spells from the SpellsComponent
        const spellsComp = monster.getComponent('SpellsComponent');
        if (spellsComp && spellsComp.knownSpells) {
            // Get the first spell ID to set as default priority
            const firstSpellId = Array.from(spellsComp.knownSpells.keys())[0];
            if (firstSpellId && !aiComp.spellPriorities[firstSpellId]) {
                aiComp.spellPriorities[firstSpellId] = { priority: 1, cooldown: 3 };
            }
        }
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
        
        // Create a complete spell object to pass to the spell logic system
        const spellObj = {
            spellId: context.spellId,
            manaCost: 0, // Will be determined by the spell system
            caster: entity,
            casterStats: stats,
            casterPos: casterPos,
            isMonsterCast: true // Flag to indicate this is cast by a monster, not the player
        };
        
        let spellName = context.spellId;
        let spellElement = 'arcane';
        let spellData = null;
        
        // Look up full spell data from spellbooks if available
        const spellsComponent = entity.getComponent('SpellsComponent');
        if (spellsComponent && spellsComponent.hasSpell(context.spellId)) {
            spellData = spellsComponent.getSpell(context.spellId);
            if (spellData) {
                // Copy all properties from the spell data
                Object.assign(spellObj, spellData);
                
                // Ensure we have the spell ID preserved
                spellObj.spellId = context.spellId;
                
                // Extract critical spell data for later use
                spellName = spellData.name || spellData.spellName || context.spellId;
                spellElement = spellData.element || 'arcane';
                
                console.log(`Monster using spell data: ${spellName}, element: ${spellElement}`);
            }
        }
        
        // Check the spell type to determine how to provide the target
        const spellImpl = gameState.spellLogic.getSpellImplementation(context.spellId);
        if (!spellImpl) {
            console.error(`[AI] No implementation found for spell: ${context.spellId}`);
            return { success: false };
        }
        
        // Determine if this is a self-targeted spell
        const isSelfTargeted = spellImpl.targetType === 'self' || 
                              spellObj.targetSelf === true || 
                              spellImpl.targetSelf === true ||
                              context.spellId === 'frostaura'; // Special case for frost aura
        
        // Different spells need different kinds of targets
        let target = null;
        
        if (isSelfTargeted) {
            // Self-targeted spells use the caster as the target
            target = { x: casterPos.x, y: casterPos.y };
        }
        else if (spellImpl.targetType === 'entity') {
            // Entity-targeted spells need the target entity
            if (!context.target) return { success: false };
            
            // Get the target position
            const targetPosComp = context.target.getComponent('PositionComponent');
            if (!targetPosComp) return { success: false };
            
            target = context.target;
        } 
        else if (spellImpl.targetType === 'location') {
            // Location-targeted spells need a position
            if (context.target && context.target.position) {
                // Use the enemy position directly if available
                target = { 
                    x: context.target.position.x, 
                    y: context.target.position.y 
                };
            }
            else if (context.target) {
                // Get the target position component
                const targetPosComp = context.target.getComponent('PositionComponent');
                if (targetPosComp) {
                    target = { x: targetPosComp.x, y: targetPosComp.y };
                } else {
                    return { success: false };
                }
            }
            else {
                return { success: false };
            }
        }
        
        // Ensure we have a target if needed (self-targeted spells already have a target)
        if (!isSelfTargeted && (spellImpl.targetType === 'entity' || spellImpl.targetType === 'location') && !target) {
            return { success: false };
        }
        
        // Prepare a modified spell object with monster-specific info
        // This is important because many spell implementations assume they're being cast by the player
        // We need to add the monster's stats and position
        const monsterSpell = {
            ...spellObj,
            // Include standard spell info that the player spells expect
            baseDamage: spellObj.baseDamage || spellImpl.baseDamage || 10,
            manaCost: spellObj.manaCost || spellImpl.manaCost || 5,
            range: spellObj.range || spellImpl.range || 6,
            aoeRadius: spellObj.aoeRadius || spellImpl.aoeRadius || 2,
            element: spellElement,
            name: spellName
        };
        
        // Check if we have enough mana
        const manaCost = spellObj.manaCost || (spellImpl ? spellImpl.manaCost : 12);
        
        // Standard mana check
        if (manaComp.mana < manaCost) {
            gameState.addMessage(`${entity.name} tries to cast ${spellName} but lacks sufficient mana!`);
            return { success: false, reason: 'insufficientMana' };
        }
        
        // Consume mana before casting
        manaComp.mana -= manaCost;
        
        // Handle self-targeted spells (auras, buffs, etc.)
        if (isSelfTargeted) {
            gameState.addMessage(`${entity.name} casts ${spellName} on itself!`);
            
            // Create visual effects around the caster
            if (gameState.renderSystem) {
                // Aura effect around the caster
                gameState.renderSystem.createSpellEffect('aura', spellElement, {
                    x: casterPos.x,
                    y: casterPos.y,
                    radius: 1,
                    duration: 1000
                });
            }
            
            // For self-targeted spells, let the spell implementation handle the effects
            try {
                const result = spellImpl.cast.call(gameState.spellLogic, monsterSpell, { x: casterPos.x, y: casterPos.y });
                return {
                    success: !!result,
                    spellId: context.spellId,
                    spellName: spellName,
                    element: spellElement,
                    isSelfTargeted: true
                };
            } catch (error) {
                console.error(`[AI] Error casting self-targeted spell ${context.spellId}:`, error);
                return { success: false, error: error.message };
            }
        }
        
        // Special spell handling for AOE spells
        const isAoeSpell = spellObj.aoeRadius && spellObj.aoeRadius > 1;
        
        if (isAoeSpell) {
            // Create custom implementation for monster AOE spells
            const renderSystem = gameState.renderSystem;
            
            // Ensure we have the correct target position
            const targetPos = {
                x: target.x || target.position?.x,
                y: target.y || target.position?.y
            };
            
            console.log(`Monster casting ${spellName} with element: ${spellElement}`);
            
            // Create bolt effect - ensure we're using the right position
            renderSystem.createSpellEffect('bolt', spellElement, {
                sourceX: casterPos.x,
                sourceY: casterPos.y,
                targetX: targetPos.x,
                targetY: targetPos.y,
                duration: 600
            });
            
            // Create explosion effects with delay
            setTimeout(() => {
                // Impact at target location
                renderSystem.createSpellEffect('impact', spellElement, {
                    x: targetPos.x,
                    y: targetPos.y,
                    radius: monsterSpell.aoeRadius,
                    duration: 800
                });
                
                // Wave effect for explosion
                renderSystem.createSpellEffect('wave', spellElement, {
                    x: targetPos.x,
                    y: targetPos.y,
                    radius: monsterSpell.aoeRadius + 0.5,
                    duration: 700
                });
            }, 550);
            
            // Calculate damage based on monster intelligence
            const intelligence = stats.intelligence;
            const damage = monsterSpell.baseDamage + Math.floor(intelligence * 0.6);
            
            // Dynamic message based on the spell element and name
            let spellDesc = "";
            if (spellElement === 'ice') {
                spellDesc = `launching a spear of ${spellElement} that shatters on impact!`;
            } else if (spellElement === 'fire') {
                spellDesc = `hurling a ball of ${spellElement} energy that explodes!`;
            } else if (spellElement === 'lightning') {
                spellDesc = `calling down a bolt of ${spellElement} that arcs to nearby targets!`;
            } else {
                spellDesc = `unleashing a burst of ${spellElement} energy!`;
            }
            
            gameState.addMessage(`${entity.name} casts ${spellName}, ${spellDesc}`);
            
            // Apply damage to entities in radius
            const entities = gameState.getEntitiesWithComponents('HealthComponent', 'PositionComponent');
            let hitCount = 0;
            
            // Apply damage to all entities in range
            for (const targetEntity of entities) {
                // Skip the caster
                if (targetEntity === entity) continue;
                
                const targetEntityPos = targetEntity.getComponent('PositionComponent');
                const dx = Math.abs(targetEntityPos.x - targetPos.x);
                const dy = Math.abs(targetEntityPos.y - targetPos.y);
                
                // If entity is within radius (using chess board distance)
                if (dx <= monsterSpell.aoeRadius && dy <= monsterSpell.aoeRadius) {
                    // Apply damage
                    const health = targetEntity.getComponent('HealthComponent');
                    const isDead = health.takeDamage(damage);
                    hitCount++;
                    
                    // Create impact effects at each hit entity
                    setTimeout(() => {
                        renderSystem.createSpellEffect('impact', spellElement, {
                            x: targetEntityPos.x,
                            y: targetEntityPos.y,
                            duration: 500
                        });
                    }, 650);
                    
                    // Skip special handling for immortal entities
                    if (health.immortal) continue;
                    
                    // Handle death
                    if (isDead) {
                        // Death message based on spell element
                        if (spellElement === 'fire') {
                            gameState.addMessage(`${targetEntity.name} is incinerated by the blast!`);
                        } else if (spellElement === 'ice') {
                            gameState.addMessage(`${targetEntity.name} is frozen solid and shatters!`);
                        } else if (spellElement === 'lightning') {
                            gameState.addMessage(`${targetEntity.name} is electrocuted by the blast!`);
                        } else {
                            gameState.addMessage(`${targetEntity.name} is destroyed by the blast!`);
                        }
                        
                        // If target is not the player, remove it
                        if (targetEntity !== gameState.player && !context.inArenaCombat) {
                            gameState.removeEntity(targetEntity.id);
                        }
                    } else {
                        // Damage message based on spell element
                        gameState.addMessage(`${targetEntity.name} takes ${damage} damage from the ${spellElement} blast!`);
                    }
                }
            }
            
            // Result message based on spell type
            if (hitCount === 0) {
                gameState.addMessage(`The ${spellElement} blast hits nothing.`);
            } else {
                gameState.addMessage(`The ${spellName} hits ${hitCount} ${hitCount === 1 ? 'target' : 'targets'}!`);
            }
            
            return { 
                success: true, 
                spellId: context.spellId,
                spellName: spellName,
                element: spellElement,
                hitCount: hitCount
            };
        }
        
        // For bolt/direct damage spells
        const isBoltSpell = spellObj.range && spellObj.range > 1;
        
        if (isBoltSpell && target) {
            gameState.addMessage(`${entity.name} casts ${spellName}!`);
            
            // Create visual effects
            if (gameState.renderSystem && casterPos) {
                // Get target position, handling different target types
                const targetPos = {
                    x: target.x || target.position?.x,
                    y: target.y || target.position?.y
                };
                
                // Create bolt effect
                gameState.renderSystem.createSpellEffect('bolt', spellElement, {
                    sourceX: casterPos.x,
                    sourceY: casterPos.y,
                    targetX: targetPos.x,
                    targetY: targetPos.y,
                    duration: 600
                });
                
                // Create impact effect with delay
                setTimeout(() => {
                    gameState.renderSystem.createSpellEffect('impact', spellElement, {
                        x: targetPos.x,
                        y: targetPos.y,
                        duration: 600
                    });
                }, 500);
            }
            
            // Calculate damage
            const intelligence = stats.intelligence;
            const damage = monsterSpell.baseDamage + Math.floor(intelligence * 0.6);
            
            // Apply damage to target
            if (context.target) {
                const targetHealth = context.target.getComponent('HealthComponent');
                if (targetHealth) {
                    const isDead = targetHealth.takeDamage(damage);
                    
                    // Show damage message
                    gameState.addMessage(`${context.target.name} takes ${damage} damage!`);
                    
                    // Handle death
                    if (isDead) {
                        if (spellElement === 'fire') {
                            gameState.addMessage(`${context.target.name} is incinerated by the blast!`);
                        } else if (spellElement === 'ice') {
                            gameState.addMessage(`${context.target.name} is frozen solid!`);
                        } else if (spellElement === 'lightning') {
                            gameState.addMessage(`${context.target.name} is electrocuted!`);
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
                        spellId: context.spellId,
                        spellName: spellName,
                        element: spellElement
                    };
                }
            }
        }
        
        // For other spells, try to use the standard spell logic system directly
        try {
            // Add message about casting the spell
            gameState.addMessage(`${entity.name} casts ${spellName}!`);
            
            // Call the spell implementation directly
            const result = spellImpl.cast.call(gameState.spellLogic, monsterSpell, target);
            
            return { 
                success: !!result,
                spellId: context.spellId,
                spellName: spellName,
                element: spellElement
            };
        } catch (error) {
            console.error(`[AI] Error casting spell ${context.spellId} with spell logic:`, error);
        }
        
        // If we got here, casting failed
        return { success: false };
    }
};

export default monsterSpellcaster;
