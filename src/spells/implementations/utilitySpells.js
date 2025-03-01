import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';

/**
 * Register utility spells like healing, teleportation, etc.
 * @param {object} spellLogic - The spell logic system
 */
export function registerUtilitySpells(spellLogic) {
    // Polymorph spell - transforms enemy into a harmless sheep
    spellLogic.registerSpell('polymorph', {
        targetType: 'entity',
        
        // Method for targeting before casting
        target: function(spell, callback) {
            // Enable targeting mode - this will be handled by the targeting system
            const targetingSystem = gameState.getSystem('TargetingSystem');
            if (targetingSystem) {
                targetingSystem.startTargeting({
                    range: spell.range || 5,
                    targetType: 'enemy',
                    onSelect: callback
                });
                return true;
            }
            return false;
        },
        
        // Actual spell implementation
        cast: function(spell, target) {
            if (!target || !target.entity) {
                gameState.addMessage("You need a valid target for this spell.");
                return false;
            }
            
            const targetEntity = target.entity;
            
            // Don't allow polymorphing already polymorphed targets
            if (targetEntity.hasComponent('PolymorphComponent')) {
                gameState.addMessage(`${targetEntity.name} is already transformed!`);
                return false;
            }
            
            // Don't polymorph bosses, very large creatures, or non-living things
            if (targetEntity.hasComponent('BossComponent') || 
                (targetEntity.renderable && targetEntity.renderable.char === 'D') || 
                !targetEntity.hasComponent('HealthComponent')) {
                gameState.addMessage(`${targetEntity.name} resists the polymorph spell!`);
                return false;
            }
            
            // Use mana
            const mana = gameState.player.getComponent('ManaComponent');
            if (!mana.useMana(spell.manaCost)) {
                gameState.addMessage("You don't have enough mana.");
                return false;
            }
            
            // Calculate duration based on intelligence
            const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
            const duration = spell.duration + Math.floor(intelligence * 0.2);
            
            // Save original components
            const originalComponents = {
                renderable: targetEntity.hasComponent('RenderableComponent') ? 
                    { 
                        char: targetEntity.renderable.char,
                        color: targetEntity.renderable.color
                    } : null,
                attack: targetEntity.hasComponent('AttackComponent'),
                ai: targetEntity.hasComponent('AIComponent')
            };
            
            // Save original name
            const originalName = targetEntity.name;
            targetEntity.name = "Sheep";
            
            // Create polymorph component to track the transformation
            const polymorphComponent = new gameState.components.PolymorphComponent(duration, originalComponents);
            polymorphComponent.originalName = originalName;
            targetEntity.addComponent(polymorphComponent);
            
            // Modify appearance
            if (targetEntity.renderable) {
                targetEntity.renderable.char = 's';  // 's' for sheep
                targetEntity.renderable.color = '#ffffff';  // white color for sheep
            }
            
            // Remove attack capability
            if (targetEntity.hasComponent('AttackComponent')) {
                targetEntity.removeComponent('AttackComponent');
            }
            
            // Remove or disable AI
            if (targetEntity.hasComponent('AIComponent')) {
                targetEntity.removeComponent('AIComponent');
            }
            
            // Create visual effect
            if (gameState.renderSystem) {
                gameState.renderSystem.createSpellEffect('aura', 'arcane', {
                    x: targetEntity.position.x,
                    y: targetEntity.position.y,
                    radius: 1,
                    duration: 1000
                });
            }
            
            gameState.addMessage(`You transform ${originalName} into a harmless sheep!`);
            
            // Set up the reversion after duration expires
            setTimeout(() => {
                if (targetEntity && targetEntity.hasComponent('PolymorphComponent')) {
                    // Check if entity still exists and is still polymorphed
                    const polyComp = targetEntity.getComponent('PolymorphComponent');
                    
                    // Restore original name
                    targetEntity.name = polyComp.originalName;
                    
                    // Restore appearance
                    if (targetEntity.renderable && polyComp.originalComponents.renderable) {
                        targetEntity.renderable.char = polyComp.originalComponents.renderable.char;
                        targetEntity.renderable.color = polyComp.originalComponents.renderable.color;
                    }
                    
                    // Restore combat capability
                    if (polyComp.originalComponents.attack && !targetEntity.hasComponent('AttackComponent')) {
                        // We need to recreate the attack component - this is implementation-specific
                        const attackComp = new gameState.components.AttackComponent(5); // Default values
                        targetEntity.addComponent(attackComp);
                    }
                    
                    // Restore AI
                    if (polyComp.originalComponents.ai && !targetEntity.hasComponent('AIComponent')) {
                        // We need to recreate the AI component - this is implementation-specific
                        const aiComp = new gameState.components.AIComponent();
                        targetEntity.addComponent(aiComp);
                    }
                    
                    // Remove polymorph component
                    targetEntity.removeComponent('PolymorphComponent');
                    
                    // Visual effect for transformation back
                    if (gameState.renderSystem) {
                        gameState.renderSystem.createSpellEffect('aura', 'arcane', {
                            x: targetEntity.position.x,
                            y: targetEntity.position.y,
                            radius: 1,
                            duration: 1000
                        });
                    }
                    
                    gameState.addMessage(`${targetEntity.name} transforms back to normal!`);
                }
            }, duration * 1000); // Convert turns to milliseconds
            
            return true;
        }
    });
    // Nature spell (healing + temporary defense boost)
    spellLogic.registerSpell('nature', {
        targetType: 'self',
        cast: function(spell) {
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
    
    // Healing spell
    spellLogic.registerSpell('healing', {
        targetType: 'self',
        cast: function(spell, target) {
            // Determine if this is player or NPC casting
            const isCastByPlayer = !target;
            const caster = isCastByPlayer ? gameState.player : target?.entity;
            
            if (!caster) {
                console.error('No valid caster for healing spell');
                return false;
            }
            
            // Get health component of caster
            const healthComp = caster.getComponent('HealthComponent');
            
            if (!healthComp) {
                console.error('Caster has no health component');
                return false;
            }
            
            // Check if already at full health
            if (healthComp.hp >= healthComp.maxHp) {
                if (isCastByPlayer) {
                    gameState.addMessage("You're already at full health.");
                }
                return false; // Don't use mana if already at full health
            }
            
            // Use mana
            const manaComp = caster.getComponent('ManaComponent');
            if (!manaComp || !manaComp.useMana) {
                console.error('Caster has invalid mana component');
                return false;
            }
            
            if (!manaComp.useMana(spell.manaCost)) {
                if (isCastByPlayer) {
                    gameState.addMessage(`You don't have enough mana to cast ${spell.spellName || "healing"}.`);
                }
                return false;
            }
            
            // Calculate healing based on intelligence
            const statsComp = caster.getComponent('StatsComponent');
            const intelligence = statsComp ? statsComp.intelligence : 5;
            const healAmount = (spell.baseDamage || 12) + Math.floor(intelligence * 0.5);
            
            // Apply healing
            if (typeof healthComp.heal === 'function') {
                healthComp.heal(healAmount);
            } else {
                // Fallback if heal method doesn't exist
                healthComp.hp = Math.min(healthComp.hp + healAmount, healthComp.maxHp);
            }
            
            // Create a healing visual effect
            const renderSystem = gameState.renderSystem;
            const pos = caster.getComponent('PositionComponent') || caster.position;
            
            if (renderSystem && pos) {
                renderSystem.createSpellEffect('aura', 'nature', {
                    x: pos.x,
                    y: pos.y,
                    radius: 1,
                    duration: 1200
                });
            }
            
            // Show appropriate message
            if (isCastByPlayer) {
                gameState.addMessage(`You cast ${spell.spellName || "healing"} and heal for ${healAmount} HP.`);
            } else {
                gameState.addMessage(`${caster.name} casts a healing spell and recovers ${healAmount} HP.`);
            }
            
            return true;
        }
    });
    
    // Town Portal spell
    spellLogic.registerSpell('townportal', {
        targetType: 'self',
        cast: function(spell) {
            // Check if already in town
            if (gameState.location === 'town') {
                gameState.addMessage("You're already in town.");
                return false;
            }
            
            // Use mana
            const mana = gameState.player.getComponent('ManaComponent');
            mana.useMana(spell.manaCost);
            
            gameState.addMessage(`You cast ${spell.name} and are teleported back to town!`, "important");
            
            // Return to town
            eventBus.emit('returnToTown');
            return true;
        }
    });
    
    // Light spell
    spellLogic.registerSpell('light', {
        targetType: 'self',
        cast: function(spell) {
            // Use mana
            const mana = gameState.player.getComponent('ManaComponent');
            mana.useMana(spell.manaCost);
            
            // Increase visibility temporarily
            gameState.addMessage(`You cast ${spell.name}, illuminating the area around you.`);
            
            // Temporarily double the FOV radius
            const fovSystem = gameState.getSystem('FOVSystem');
            if (fovSystem) {
                const originalRadius = fovSystem.radius;
                fovSystem.radius *= 2;
                fovSystem.update();
                
                // Reset after 10 seconds
                setTimeout(() => {
                    fovSystem.radius = originalRadius;
                    fovSystem.update();
                    gameState.addMessage("The magical light fades.");
                }, 10000);
            }
            
            return true;
        }
    });
}