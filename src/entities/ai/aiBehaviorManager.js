// aiBehaviorManager.js - A fixed version of the AI Behavior Manager

import gameState from '../../core/gameState.js';
import monsterSpellcaster from './monsterSpellcaster.js';

// AI Behavior State Machine - reusable, data-driven AI
class AIBehaviorManager {
    constructor() {
        this.behaviors = new Map();
        this.registerCoreActions();
    }

    // Register a behavior handler
    registerBehavior(id, handler) {
        this.behaviors.set(id, handler);
    }

    // Core action handlers that all AI types can use
    registerCoreActions() {
        // Movement actions
        this.registerBehavior('moveTowardTarget', (entity, context) => {
            const pos = entity.getComponent('PositionComponent');
            const targetPos = context.target?.getComponent('PositionComponent');
            
            if (!pos || !targetPos) return { success: false };
            
            // Calculate direction to move
            const dx = Math.sign(targetPos.x - pos.x);
            const dy = Math.sign(targetPos.y - pos.y);
            
            // Try to move in primary direction first
            if (Math.abs(targetPos.x - pos.x) > Math.abs(targetPos.y - pos.y)) {
                // Try x direction first
                if (!this._isPositionBlocked(pos.x + dx, pos.y)) {
                    pos.x += dx;
                } else if (!this._isPositionBlocked(pos.x, pos.y + dy)) {
                    pos.y += dy;
                }
            } else {
                // Try y direction first
                if (!this._isPositionBlocked(pos.x, pos.y + dy)) {
                    pos.y += dy;
                } else if (!this._isPositionBlocked(pos.x + dx, pos.y)) {
                    pos.x += dx;
                }
            }
            
            return { success: true };
        });
        
        this.registerBehavior('moveAwayFromTarget', (entity, context) => {
            const pos = entity.getComponent('PositionComponent');
            const targetPos = context.target?.getComponent('PositionComponent');
            
            if (!pos || !targetPos) return { success: false };
            
            // Move in the opposite direction
            const dx = Math.sign(pos.x - targetPos.x);
            const dy = Math.sign(pos.y - targetPos.y);
            
            // Try to move in primary direction first
            if (Math.abs(targetPos.x - pos.x) > Math.abs(targetPos.y - pos.y)) {
                // Try x direction first
                if (!this._isPositionBlocked(pos.x + dx, pos.y)) {
                    pos.x += dx;
                } else if (!this._isPositionBlocked(pos.x, pos.y + dy)) {
                    pos.y += dy;
                }
            } else {
                // Try y direction first
                if (!this._isPositionBlocked(pos.x, pos.y + dy)) {
                    pos.y += dy;
                } else if (!this._isPositionBlocked(pos.x + dx, pos.y)) {
                    pos.x += dx;
                }
            }
            
            return { success: true };
        });
        
        this.registerBehavior('moveRandomly', (entity, context) => {
            const dx = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
            const dy = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
            
            const pos = entity.getComponent('PositionComponent');
            if (pos) {
                if (!this._isPositionBlocked(pos.x + dx, pos.y + dy)) {
                    pos.x += dx;
                    pos.y += dy;
                }
            }
            
            return { success: true };
        });
        
        // Combat actions
        this.registerBehavior('meleeAttack', (entity, context) => {
            if (!context.target) return { success: false };
            
            // Target must have health
            const targetHealth = context.target.getComponent('HealthComponent');
            const stats = entity.getComponent('StatsComponent');
            
            if (!targetHealth || !stats) return { success: false };
            
            // Check if target can dodge based on DV
            const targetStats = context.target.getComponent('StatsComponent');
            const targetDV = targetStats ? targetStats.dv : 0;
            
            // Calculate dodge chance - 5% per DV point
            if (targetDV > 0) {
                const dodgeChance = Math.min(75, targetDV * 5);
                if (Math.random() * 100 <= dodgeChance) {
                    // Target dodged the attack
                    gameState.addMessage(`${context.target.name} nimbly dodges ${entity.name}'s attack!`);
                    return { success: false, dodged: true };
                }
            }
            
            // Calculate base damage
            let damage = stats.strength;
            
            // Apply randomization to damage (±20%)
            const variance = 0.2;
            const multiplier = 1 + (Math.random() * variance * 2 - variance);
            damage = Math.floor(damage * multiplier);
            
            // Apply damage with PV/defense reduction
            const result = targetHealth.takeDamage ? 
                targetHealth.takeDamage(damage) : 
                { damage: damage, isDead: targetHealth.hp <= damage };
            
            // Apply damage manually if takeDamage didn't work
            if (!result) {
                let actualDamage = damage;
                // Simple defense reduction
                if (targetStats) {
                    actualDamage = Math.max(1, damage - Math.floor(targetStats.defense / 2));
                }
                targetHealth.hp -= actualDamage;
                if (targetHealth.hp <= 0) targetHealth.hp = 0;
            }
            
            const actualDamage = result?.damage || damage;
            const isDead = result?.isDead || targetHealth.hp <= 0;
            
            // Show attack message
            gameState.addMessage(`${entity.name} attacks ${context.target.name} for ${actualDamage} damage!`);
            
            // Check if target died
            if (isDead) {
                gameState.addMessage(`${context.target.name} is slain by ${entity.name}!`);
                
                // If target is not the player, remove it
                if (context.target !== gameState.player && !context.inArenaCombat) {
                    gameState.removeEntity(context.target.id);
                }
            }
            
            return { 
                success: true, 
                damage: actualDamage, 
                isDead: isDead 
            };
        });
        
        // Cast a spell
        this.registerBehavior('castSpell', (entity, context) => {
            if (!context.spellId) return { success: false };
            
            // Check for spellLogic system first, which will let us use the proper player spells
            if (gameState.spellLogic && gameState.spellLogic.hasSpell(context.spellId)) {
                // Use the real spell implementation with monsterSpellcaster helper
                return monsterSpellcaster.castRealSpell(entity, context);
            } else {
                // No real spell implementation, use the hardcoded behavior
                return this._castHardcodedSpell(entity, context);
            }
        });
    }
    
    // Utility method to check if a position is blocked
    _isPositionBlocked(x, y) {
        // Check map boundaries
        if (!gameState.map || 
            x < 0 || y < 0 || 
            x >= gameState.map.width || 
            y >= gameState.map.height) {
            return true;
        }
        
        // Check if the tile is blocked
        const tile = gameState.map.getTile(x, y);
        if (tile.blocked) {
            return true;
        }
        
        // Check if there's an entity blocking the position
        const entities = Array.from(gameState.entities.values());
        for (const entity of entities) {
            const pos = entity.position || entity.getComponent('PositionComponent');
            if (pos && pos.x === x && pos.y === y && 
                (entity.blockMovement || entity.getComponent('BlocksMovementComponent'))) {
                return true;
            }
        }
        
        return false;
    }

    // Simplified fallback for spell implementation
    // This is only used if the spell isn't defined in the main spell system
    _castHardcodedSpell(entity, context) {
        // Get components
        const stats = entity.getComponent('StatsComponent');
        const manaComp = entity.getComponent('ManaComponent');
        const spellsComp = entity.getComponent('SpellsComponent');
        const entityPosComp = entity.getComponent('PositionComponent');
        
        if (!stats || !manaComp || !entityPosComp) return { success: false };
        
        // Get spell info from entity's known spells if available
        let spell = null;
        if (spellsComp && spellsComp.knownSpells && spellsComp.knownSpells.has(context.spellId)) {
            spell = spellsComp.knownSpells.get(context.spellId);
        }
        
        // If no spell info available, create minimal defaults
        if (!spell) {
            spell = {
                name: context.spellId,
                manaCost: 5,
                baseDamage: 8,
                element: 'magic'
            };
        }
        
        // Check if we have a target for targeted spells
        if (!spell.isSelfTargeting && !context.target) return { success: false };
        
        // Check mana cost
        if (manaComp.mana < spell.manaCost) {
            gameState.addMessage(`${entity.name} tries to cast ${spell.name} but lacks sufficient mana!`);
            return { success: false, reason: 'insufficientMana' };
        }
        
        // Consume mana
        manaComp.mana -= spell.manaCost;
        
        // For targeted spells, apply simple damage
        if (!spell.isSelfTargeting && context.target) {
            const targetPosComponent = context.target.getComponent('PositionComponent');
            const targetHealth = context.target.getComponent('HealthComponent');
            
            if (targetHealth && targetPosComponent) {
                // Create visual effect
                if (gameState.renderSystem) {
                    // Create bolt effect
                    gameState.renderSystem.createSpellEffect('bolt', spell.element || 'magic', {
                        sourceX: entityPosComp.x,
                        sourceY: entityPosComp.y,
                        targetX: targetPosComponent.x,
                        targetY: targetPosComponent.y,
                        duration: 500
                    });
                    
                    // Create impact effect after delay
                    setTimeout(() => {
                        gameState.renderSystem.createSpellEffect('impact', spell.element || 'magic', {
                            x: targetPosComponent.x,
                            y: targetPosComponent.y,
                            duration: 600
                        });
                    }, 400);
                }
                
                // Calculate damage
                const damage = spell.baseDamage + Math.floor(stats.intelligence * 0.5);
                const isDead = targetHealth.takeDamage(damage);
                
                // Show messages
                gameState.addMessage(`${entity.name} casts ${spell.name} at ${context.target.name} for ${damage} damage!`);
                
                if (isDead) {
                    gameState.addMessage(`${context.target.name} is slain by ${entity.name}'s ${spell.name}!`);
                    
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
        } else {
            // Self-targeting spell
            gameState.addMessage(`${entity.name} casts ${spell.name}!`);
            return { success: true, spellId: context.spellId };
        }
        
        return { success: false };
    }
    
    // Execute a behavior
    execute(behaviorId, entity, context = {}) {
        const behavior = this.behaviors.get(behaviorId);
        if (!behavior) {
            return { success: false, reason: 'behaviorNotFound' };
        }
        
        return behavior(entity, context);
    }
}

// Create a singleton instance
const aiBehaviorManager = new AIBehaviorManager();

export default aiBehaviorManager;
