import gameState from '../../core/gameState.js';
import { targetingSystem } from '../../systems/targetingSystem.js';

/**
 * Register AoE (Area of Effect) spells like fireball
 * @param {object} spellLogic - The spell logic system
 */
export function registerAoESpells(spellLogic) {
    // Fireball spell - an area-of-effect explosion
    spellLogic.registerSpell('fireball', {
        targetType: 'location',
        target: (spell, callback) => {
            gameState.addMessage("Choose a location for your Fireball spell. Press ESC to cancel.", "important");
            targetingSystem.startTargeting(spell, callback);
        },
        cast: function(spell, target) {
            // Use mana
            const mana = gameState.player.getComponent('ManaComponent');
            mana.useMana(spell.manaCost);
            
            // Calculate damage based on player intelligence
            const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
            const damage = spell.baseDamage + Math.floor(intelligence * 0.6);
            
            gameState.addMessage(`You cast ${spell.name}, hurling a ball of fire that explodes at the target location!`);
            
            // Create visual effects
            const renderSystem = gameState.renderSystem;
            const playerPos = gameState.player.position;
            
            // Create bolt effect
            renderSystem.createSpellEffect('bolt', 'fire', {
                sourceX: playerPos.x,
                sourceY: playerPos.y,
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
                    radius: spell.aoeRadius,
                    duration: 800
                });
                
                // Wave effect for explosion
                renderSystem.createSpellEffect('wave', 'fire', {
                    x: target.x,
                    y: target.y,
                    radius: spell.aoeRadius + 0.5,
                    duration: 700
                });
            }, 550);
            
            // Apply damage to entities in radius
            let hitCount = applyAoEDamage(target, spell.aoeRadius, damage, 'fire', spellLogic);
            
            // Result message
            if (hitCount === 0) {
                gameState.addMessage("The fireball explodes but hits nothing.");
            } else {
                gameState.addMessage(`The fireball hits ${hitCount} ${hitCount === 1 ? 'enemy' : 'enemies'}!`);
            }
            
            return true;
        }
    });
}

/**
 * Apply AoE damage to entities within radius
 * @param {object} center - Center position {x,y} of the effect
 * @param {number} radius - Radius of the effect
 * @param {number} damage - Amount of damage to apply
 * @param {string} element - Element type for visual effects
 * @param {object} spellLogic - Reference to spell logic system
 * @returns {number} - Number of entities hit
 */
function applyAoEDamage(center, radius, damage, element, spellLogic) {
    const entities = gameState.getEntitiesWithComponents('HealthComponent', 'PositionComponent');
    let hitCount = 0;
    const renderSystem = gameState.renderSystem;
    
    // Apply damage to all entities in range
    for (const entity of entities) {
        // Skip the player
        if (entity === gameState.player) continue;
        
        const entityPos = entity.getComponent('PositionComponent');
        const dx = Math.abs(entityPos.x - center.x);
        const dy = Math.abs(entityPos.y - center.y);
        
        // If entity is within radius (using chess board distance)
        if (dx <= radius && dy <= radius) {
            // Apply damage
            const health = entity.getComponent('HealthComponent');
            const isDead = health.takeDamage(damage);
            hitCount++;
            
            // Create impact effects at each hit entity
            setTimeout(() => {
                renderSystem.createSpellEffect('impact', element, {
                    x: entityPos.x,
                    y: entityPos.y,
                    duration: 500
                });
            }, 650);
            
            // Special handling for immortal entities
            if (health.immortal) {
                gameState.addMessage(`${entity.name} takes the hit but remains standing.`);
                continue;
            }
            
            // Handle death
            if (isDead) {
                if (element === 'fire') {
                    spellLogic.handleEntityDeath(entity, `${entity.name} is incinerated by the blast!`);
                } else if (element === 'ice') {
                    spellLogic.handleEntityDeath(entity, `${entity.name} is frozen solid by the blast!`);
                } else {
                    spellLogic.handleEntityDeath(entity, `${entity.name} is destroyed by the blast!`);
                }
            } else {
                gameState.addMessage(`${entity.name} takes ${damage} damage from the ${element} blast!`);
            }
        }
    }
    
    return hitCount;
}