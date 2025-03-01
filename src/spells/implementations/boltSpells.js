import gameState from '../../core/gameState.js';
import { targetingSystem } from '../../systems/targetingSystem.js';
import { findEntityAtPosition, handleNPCTargeting, handleEntityDeath } from '../helpers.js';

/**
 * Register bolt-type spells that shoot projectiles at targets
 * @param {object} spellLogic - The spell logic system
 */
export function registerBoltSpells(spellLogic) {
    // Register damage bolt spells
    spellLogic.registerBoltSpell('firebolt', 'fire', 0.5, 'incinerated', 'small explosion of fire');
    spellLogic.registerBoltSpell('frostbolt', 'ice', 0.4, 'freezes and shatters', 'burst of freezing cold', true);
    spellLogic.registerBoltSpell('icespear', 'ice', 0.5, 'frozen solid', 'icy explosion', true);
}

/**
 * Create a standard bolt spell (firebolt, frostbolt, etc)
 */
export function createBoltSpell(spellId, element, intelligenceScale, deathMessage, missMessage, hasSlowEffect = false) {
    return {
        targetType: 'location',
        target: (spell, callback) => {
            gameState.addMessage(`Choose a location for your ${spell.name} spell. Press ESC to cancel.`, "important");
            targetingSystem.startTargeting(spell, callback);
        },
        cast: function(spell, target) {
            // Use mana
            const mana = gameState.player.getComponent('ManaComponent');
            mana.useMana(spell.manaCost);
            
            // Calculate damage based on player intelligence
            const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
            const damage = spell.baseDamage + Math.floor(intelligence * intelligenceScale);
            
            const renderSystem = gameState.renderSystem;
            const playerPos = gameState.player.position;
            
            // Create bolt effect (always create visual regardless of target)
            renderSystem.createSpellEffect('bolt', element, {
                sourceX: playerPos.x,
                sourceY: playerPos.y,
                targetX: target.x,
                targetY: target.y,
                duration: element === 'ice' ? 450 : 500 
            });
            
            // Find entity at the target position
            const targetEntity = findEntityAtPosition(target);
            
            // If no entity with health at target, the spell still casts but hits nothing
            if (!targetEntity) {
                // Create impact effect
                setTimeout(() => {
                    renderSystem.createSpellEffect('impact', element, {
                        x: target.x,
                        y: target.y,
                        duration: element === 'ice' ? 700 : 600
                    });
                }, element === 'ice' ? 350 : 400);
                
                gameState.addMessage(`You cast ${spell.name} at the location, creating a ${missMessage}.`);
                return true;
            }
            
            // Handle NPC targeting
            if (!handleNPCTargeting(targetEntity, spell)) {
                return true; // User canceled attack, but spell still cast
            }
            
            // Create impact effect
            setTimeout(() => {
                renderSystem.createSpellEffect('impact', element, {
                    x: target.x,
                    y: target.y,
                    duration: element === 'ice' ? 700 : 600
                });
            }, element === 'ice' ? 350 : 400);
            
            // Apply damage
            const targetHealth = targetEntity.getComponent('HealthComponent');
            console.log(`[BoltSpell] Applying ${damage} ${element} damage to ${targetEntity.name}`);
            console.log(`[BoltSpell] Target HP before: ${targetHealth.hp}/${targetHealth.maxHp}, immortal: ${targetHealth.immortal}`);
            
            // Take damage and get result
            const damageResult = targetHealth.takeDamage(damage);
            const isDead = damageResult.isDead;
            
            console.log(`[BoltSpell] Target HP after: ${targetHealth.hp}/${targetHealth.maxHp}`);
            console.log(`[BoltSpell] Damage result:`, damageResult);
            console.log(`[BoltSpell] isDead:`, isDead);
            
            // Show damage message
            gameState.addMessage(`You cast ${spell.name} and hit ${targetEntity.name} for ${damage} damage!`);
            
            // Handle slow effect for ice spells
            if (hasSlowEffect && Math.random() < 0.75) {
                gameState.addMessage(`${targetEntity.name} is slowed by the frost!`);
            }
            
            // Special handling for immortal entities
            if (targetHealth.immortal) {
                console.log(`[BoltSpell] ${targetEntity.name} is immortal, will remain standing`);
                gameState.addMessage(`${targetEntity.name} takes the hit but remains standing.`);
                return true;
            }
            
            // Handle death if applicable
            if (isDead) {
                console.log(`[BoltSpell] ${targetEntity.name} is dead from the spell damage!`);
                handleEntityDeath(targetEntity, `${targetEntity.name} is ${deathMessage}!`);
            }
            
            return true;
        }
    };
}