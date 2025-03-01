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
                console.log(`[AI] ${entity.name} can use the real spell implementation for ${context.spellId}`);
                return monsterSpellcaster.castRealSpell(entity, context);
            } else {
                // No real spell implementation, use the hardcoded behavior
                console.log(`[AI] ${entity.name} using fallback spell implementation for ${context.spellId}`);
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

    // Hardcoded spell implementation
    _castHardcodedSpell(entity, context) {
        // Check if this is a self-targeting spell
        let spell = null;
        // Get spell defaults from our list
        const spellDefaults = {
            'firebolt': {
                name: 'Firebolt',
                manaCost: 5,
                baseDamage: 8,
                element: 'fire',
                range: 6,
                isSelfTargeting: false,
                message: 'hurls a bolt of fire at',
                deathMessage: 'is incinerated by'
            },
            'fireball': {
                name: 'Fireball',
                manaCost: 12,
                baseDamage: 14,
                element: 'fire',
                range: 6,
                aoeRadius: 2,
                isSelfTargeting: false,
                message: 'hurls a fireball at',
                deathMessage: 'is incinerated by'
            },
            'shockbolt': {
                name: 'Shock Bolt',
                manaCost: 5,
                baseDamage: 6,
                element: 'lightning',
                range: 5,
                isSelfTargeting: false,
                message: 'sends a bolt of electricity at',
                deathMessage: 'is electrocuted by'
            },
            'icespear': {
                name: 'Ice Spear',
                manaCost: 7,
                baseDamage: 10,
                element: 'ice',
                range: 5,
                isSelfTargeting: false,
                message: 'launches a spear of ice at',
                deathMessage: 'is frozen solid by'
            },
            'frostaura': {
                name: 'Frost Aura',
                manaCost: 2,
                baseDamage: 2,
                element: 'ice',
                range: 1,
                aoeRadius: 3,
                duration: 12,
                isSelfTargeting: true
            },
            'healing': {
                name: 'Minor Healing',
                manaCost: 8,
                healAmount: 12,
                element: 'life',
                range: 0,
                isSelfTargeting: true
            },
            'summonhydra': {
                name: 'Summon Hydra',
                manaCost: 15,
                baseDamage: 0,
                element: 'nature',
                range: 3,
                isSelfTargeting: false,
                message: 'summons a hydra near',
                deathMessage: 'is killed by',
                // Special flags for summoning
                isSummoning: true,
                summonType: 'hydra'
            },
            'summon_hydra': {
                name: 'Summon Hydra',
                manaCost: 15,
                baseDamage: 0,
                element: 'nature',
                range: 3,
                isSelfTargeting: false,
                message: 'summons a hydra near',
                deathMessage: 'is killed by',
                // Special flags for summoning
                isSummoning: true,
                summonType: 'hydra'
            },
            'spawnnewhead': {
                name: 'Spawn New Head',
                manaCost: 10,
                baseDamage: 0,
                element: 'nature',
                range: 1,
                isSelfTargeting: true,
                message: 'grows a new hydra head',
                // Special flags for hydra spawning
                isHydraSpawning: true
            }
        };
        
        // Look up spell from defaults
        spell = spellDefaults[context.spellId] || null;
        const isSelfTargeting = spell && spell.isSelfTargeting;
        
        // For non-self-targeting spells, we need a target
        if (!isSelfTargeting && !context.target) return { success: false };
        
        // Get components
        const stats = entity.getComponent('StatsComponent');
        const manaComp = entity.getComponent('ManaComponent');
        const spellsComp = entity.getComponent('SpellsComponent');
        
        // For non-self spells, target must have health
        if (!isSelfTargeting) {
            const targetHealth = context.target.getComponent('HealthComponent');
            if (!targetHealth) return { success: false };
        }
        
        if (!stats || !manaComp) return { success: false };
        
        if (spellsComp && spellsComp.knownSpells && spellsComp.knownSpells.has(context.spellId)) {
            // Get the spell from entity's known spells
            spell = spellsComp.knownSpells.get(context.spellId);
        } else {
            // Fallback to hardcoded spells if not found
            const spellDefaults = {
                'firebolt': {
                    name: 'Firebolt',
                    manaCost: 5,
                    baseDamage: 8,
                    element: 'fire',
                    range: 6,
                    intelligenceScale: 0.5,
                    message: 'hurls a bolt of fire',
                    deathMessage: 'is incinerated'
                },
                'fireball': {
                    name: 'Fireball',
                    manaCost: 12,
                    baseDamage: 14,
                    element: 'fire',
                    range: 6,
                    aoeRadius: 2,
                    intelligenceScale: 0.6,
                    message: 'hurls a fireball',
                    deathMessage: 'is incinerated'
                },
                'shockbolt': {
                    name: 'Shock Bolt',
                    manaCost: 5,
                    baseDamage: 6,
                    element: 'lightning',
                    range: 5,
                    intelligenceScale: 0.7,
                    message: 'sends a bolt of electricity',
                    deathMessage: 'is electrocuted'
                },
                'icespear': {
                    name: 'Ice Spear',
                    manaCost: 7,
                    baseDamage: 10,
                    element: 'ice',
                    range: 5,
                    intelligenceScale: 0.6,
                    message: 'launches a spear of ice',
                    deathMessage: 'is frozen solid'
                },
                'summonhydra': {
                    name: 'Summon Hydra',
                    manaCost: 15,
                    baseDamage: 0,
                    element: 'nature',
                    range: 3,
                    isSelfTargeting: false,
                    message: 'summons a hydra near',
                    deathMessage: 'is killed by',
                    // Special flags for summoning
                    isSummoning: true,
                    summonType: 'hydra'
                }
            };
            
            spell = spellDefaults[context.spellId];
            if (!spell) return { success: false };
        }
        
        // Check mana cost
        if (manaComp.mana < spell.manaCost) {
            gameState.addMessage(`${entity.name} tries to cast ${spell.name} but lacks sufficient mana!`);
            return { success: false, reason: 'insufficientMana' };
        }
        
        // Consume mana
        manaComp.mana -= spell.manaCost;
        
        // Get positions for the spell effect
        const entityPosComp = entity.getComponent('PositionComponent');
        const targetPosComponent = context.target?.getComponent('PositionComponent');
        
        // Create visual spell effect - only for non-self targeting spells like bolts
        if (gameState.renderSystem && entityPosComp && !spell.isSelfTargeting && targetPosComponent) {
            console.log(`[AI] Creating ${spell.element || 'magical'} spell effect for ${entity.name}`);
            
            // Create bolt effect
            gameState.renderSystem.createSpellEffect('bolt', spell.element || 'fire', {
                sourceX: entityPosComp.x,
                sourceY: entityPosComp.y,
                targetX: targetPosComponent.x,
                targetY: targetPosComponent.y,
                duration: 500
            });
            
            // Create impact effect after delay
            setTimeout(() => {
                gameState.renderSystem.createSpellEffect('impact', spell.element || 'fire', {
                    x: targetPosComponent.x,
                    y: targetPosComponent.y,
                    duration: 600
                });
            }, 400);
        }
        
        // Handle special spell types
        if (spell.isHydraSpawning || context.spellId === 'spawnnewhead') {
            // Hydra head spawning logic...
            // (This is simplified for brevity)
            gameState.addMessage(`${entity.name} tries to grow a new head!`);
            return { success: true };
        }
        
        if (spell.isSummoning || context.spellId === 'summonhydra' || context.spellId === 'summon_hydra') {
            // Summoning logic...
            // (This is simplified for brevity)
            gameState.addMessage(`${entity.name} tries to summon a hydra!`);
            return { success: true, spellId: context.spellId };
        }
        
        // For self-targeting spells like auras or healing
        if (spell.isSelfTargeting) {
            // Self-targeting spell logic...
            // (This is simplified for brevity)
            gameState.addMessage(`${entity.name} casts a self-targeting spell!`);
            return { success: true, spellId: context.spellId };
        }
        
        // For attack spells
        // Calculate damage based on intelligence
        const baseDamage = spell.baseDamage + Math.floor(stats.intelligence * (spell.intelligenceScale || 0.5));
        
        // Add damage variance (±20%)
        const variance = 0.2;
        const multiplier = 1 + (Math.random() * variance * 2 - variance);
        const finalDamage = Math.max(1, Math.floor(baseDamage * multiplier));
        
        // Get target health again since we know it's not a self-targeting spell
        const targetHealth = context.target.getComponent('HealthComponent');
        
        // Apply damage
        const result = targetHealth.takeDamage ? 
            targetHealth.takeDamage(finalDamage) : 
            { damage: finalDamage, isDead: targetHealth.hp <= finalDamage };
        
        // Apply damage manually if takeDamage didn't work
        if (!result) {
            targetHealth.hp -= finalDamage;
            if (targetHealth.hp <= 0) targetHealth.hp = 0;
        }
        
        // Show spell message
        gameState.addMessage(`${entity.name} ${spell.message || 'casts a spell'} at ${context.target.name} for ${finalDamage} damage!`);
        
        // Check if target died
        const isDead = result?.isDead || targetHealth.hp <= 0;
        if (isDead) {
            gameState.addMessage(`${context.target.name} ${spell.deathMessage || 'is slain'} by ${entity.name}'s ${spell.name}!`);
            
            // If target is not the player, remove it
            if (context.target !== gameState.player && !context.inArenaCombat) {
                gameState.removeEntity(context.target.id);
            }
        }
        
        return { 
            success: true, 
            damage: finalDamage, 
            isDead: isDead,
            spellId: context.spellId
        };
    }
    
    // Execute a behavior
    execute(behaviorId, entity, context = {}) {
        const behavior = this.behaviors.get(behaviorId);
        if (!behavior) {
            console.error(`Behavior '${behaviorId}' not found!`);
            return { success: false, reason: 'behaviorNotFound' };
        }
        
        return behavior(entity, context);
    }
}

// Create a singleton instance
const aiBehaviorManager = new AIBehaviorManager();

export default aiBehaviorManager;